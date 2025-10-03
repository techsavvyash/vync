import { Plugin, Notice, PluginSettingTab, App, Setting, TFile, TAbstractFile, Modal } from 'obsidian'
import { VaultWatcherService, VaultFileChange } from './services/vaultWatcher'
import { SyncService, SyncResult } from './services/syncService'
import { ConflictUIService } from './services/conflictUI'
import { SyncStateManager } from './services/syncState'
import { SyncIndexFile } from './services/syncIndexFile'
import { GoogleDriveAuthService, GoogleDriveTokens } from './services/googleDriveAuth'

interface VyncSettings {
	// Google Drive OAuth settings
	googleClientId: string
	googleClientSecret: string
	googleTokens: GoogleDriveTokens | null

	// Vault settings
	vaultId: string
	syncInterval: number
	autoSync: boolean
	conflictResolution: 'local' | 'remote' | 'manual'
	syncState?: any // Persisted sync state (deprecated, moved to JSON file)

	// Sync algorithm settings
	syncAgentId?: string // Unique ID for this device/plugin instance (for infinite loop prevention)
	pageToken?: string // Google Drive changes.list pageToken (for incremental sync)
}

const DEFAULT_SETTINGS: VyncSettings = {
	googleClientId: '',
	googleClientSecret: '',
	googleTokens: null,
	vaultId: '',
	syncInterval: 30, // seconds
	autoSync: true,
	conflictResolution: 'manual',
	syncState: null,
	syncAgentId: undefined, // Generated on first run
	pageToken: undefined // Initialized on first sync
}

export default class VyncPlugin extends Plugin {
	settings: VyncSettings = DEFAULT_SETTINGS

	// Google Drive services
	private googleAuthService: GoogleDriveAuthService | null = null

	// Sync services
	private syncTimer: NodeJS.Timeout | null = null // Periodic sync timer (5-10 min)
	private vaultWatcher: VaultWatcherService | null = null
	private syncService: SyncService | null = null
	private conflictUI: ConflictUIService | null = null
	private syncStateManager: SyncStateManager | null = null
	private syncIndexFile: SyncIndexFile | null = null // NEW: JSON file manager
	private pendingChanges: Set<string> = new Set() // Track files with pending changes
	private syncDebounceTimer: NodeJS.Timeout | null = null // Debounced sync (3s after last change)

	// OAuth callback server
	private callbackServer: any = null

	async onload() {
		await this.loadSettings()

		// Generate syncAgentId if it doesn't exist (for infinite loop prevention)
		if (!this.settings.syncAgentId) {
			this.settings.syncAgentId = this.generateUUID()
			await this.saveSettings()
			console.log('Generated new syncAgentId:', this.settings.syncAgentId)
		}

		// Initialize Google Drive
		await this.initializeGoogleDrive()

		// Add ribbon icon
		this.addRibbonIcon('sync', 'Vync', () => {
			this.syncVault()
		})

		// Add settings tab
		this.addSettingTab(new VyncSettingTab(this.app, this))

		// Initialize services
		this.initializeServices()

		// Add commands
		this.addCommand({
			id: 'sync-vault',
			name: 'Sync Vault',
			callback: () => {
				this.syncVault()
			}
		})

		this.addCommand({
			id: 'test-connection',
			name: 'Test Google Drive Connection',
			callback: async () => {
				if (this.googleAuthService?.isAuthenticated()) {
					new Notice('✓ Google Drive is authenticated and ready')
				} else {
					new Notice('✗ Google Drive not authenticated. Please authenticate in plugin settings.')
				}
			}
		})

		this.addCommand({
			id: 'reconcile-index',
			name: 'Reconcile Sync Index',
			callback: async () => {
				if (this.syncService) {
					new Notice('Reconciling sync index...')
					try {
						const newFiles = await this.syncService.reconcileIndex()
						if (newFiles > 0) {
							new Notice(`Found and uploaded ${newFiles} untracked file(s)`)
							await this.saveSyncState()
						} else {
							new Notice('Index is already in sync')
						}
					} catch (error) {
						new Notice('Failed to reconcile index: ' + (error as Error).message)
					}
				} else {
					new Notice('Sync service not initialized')
				}
			}
		})

		console.log('Vync plugin loaded')
	}

	onunload() {
		this.stopAutoSync()
		if (this.vaultWatcher) {
			this.vaultWatcher.stopWatching()
		}
		console.log('Vync plugin unloaded')
	}

	private async initializeServices() {
		try {
			console.log('Initializing services...')
			console.log('  Vault ID:', this.settings.vaultId || '(not set)')

			// Check if Google Drive is authenticated
			if (!this.googleAuthService?.isAuthenticated()) {
				console.warn('⚠️  Google Drive not authenticated - sync will not work')
				new Notice('Please authenticate with Google Drive in plugin settings')
				return
			}

			// Initialize sync index file manager
			this.syncIndexFile = new SyncIndexFile(this.app.vault)

			// Load sync state from JSON file (or migrate from old format)
			await this.loadSyncState()

			// Initialize sync service with vault reference and state manager
			// Note: No server URL needed - connects directly to Google Drive
			this.syncService = new SyncService(
				this.settings.vaultId,
				this.app.vault,
				this.googleAuthService,
				this.syncStateManager,
				this.settings.syncAgentId // Pass syncAgentId for echo detection
			)

			// Initialize conflict UI service
			this.conflictUI = new ConflictUIService(this.app, this.syncService)

			// Set up conflict resolution handler
			this.conflictUI.onResolution((result) => {
				console.log(`Conflict resolved: ${result.conflictId} -> ${result.resolution}`)
				new Notice(`Conflict resolved: ${result.resolution}`)
			})

			// Initialize vault watcher with Obsidian's vault
			this.vaultWatcher = new VaultWatcherService(this.app.vault)

			// Set up change listener
			this.vaultWatcher.onChange(async (change: VaultFileChange) => {
				if (change.isFolder) {
					// Handle folder changes with immediate sync
					console.log(`Folder ${change.changeType}: ${change.filePath}`)

					if (this.syncService && this.settings.autoSync) {
						try {
							switch (change.changeType) {
								case 'created':
									if (change.oldPath) {
										// This is a rename operation
										await this.syncService.handleFolderRename(change.oldPath, change.filePath)
									} else {
										// New folder created
										await this.syncService.handleFolderCreation(change.filePath)
									}
									await this.saveSyncState()
									break

								case 'deleted':
									// Folder deleted
									await this.syncService.handleFolderDeletion(change.filePath)
									await this.saveSyncState()
									break
							}
						} catch (error) {
							console.error(`Failed to handle folder ${change.changeType} for ${change.filePath}:`, error)
						}
					}
				} else {
					// Handle file changes
					console.log(`File ${change.changeType}: ${change.filePath}`)

					// Check if this is a rename operation (created with oldPath set)
					if (change.changeType === 'created' && change.oldPath && this.syncService && this.settings.autoSync) {
						// This is a file rename - handle immediately
						console.log(`  📝 File renamed: ${change.oldPath} → ${change.filePath}`)
						try {
							await this.syncService.handleFileRename(change.oldPath, change.filePath)
							await this.saveSyncState()
						} catch (error) {
							console.error(`Failed to handle file rename:`, error)
						}
					} else {
						// Track the change for debounced batch sync
						this.pendingChanges.add(change.filePath)
					}
				}

				// Trigger debounced sync to batch process all pending changes
				// This coalesces rapid changes and reduces API calls
				if (this.settings.autoSync && this.pendingChanges.size > 0) {
					this.debouncedSync()
				}
			})

			// Start watching
			this.vaultWatcher.startWatching()

			// Start auto-sync if enabled
			if (this.settings.autoSync) {
				this.startAutoSync()
			}

			// Perform initial sync on startup to check for remote changes
			this.performInitialSync()

			new Notice('Vync initialized successfully')
		} catch (error) {
			console.error('Failed to initialize Vync:', error)
			new Notice('Failed to initialize Vync: ' + (error as Error).message)
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	/**
	 * Load sync state from JSON file with migration from old format
	 */
	async loadSyncState() {
		if (!this.syncIndexFile) {
			console.error('❌ SyncIndexFile not initialized')
			return
		}

		// Try loading from JSON file first
		const state = await this.syncIndexFile.load()

		if (state) {
			// Successfully loaded from JSON file
			console.log('✅ Loaded sync state from JSON file')
			this.syncStateManager = new SyncStateManager(this.settings.vaultId)
			this.syncStateManager.setState(state)
		} else if (this.settings.syncState) {
			// Migrate from old plugin data format
			console.log('🔄 Migrating sync state from plugin data to JSON file...')
			const migratedState = await this.syncIndexFile.migrateFromPluginData(this.settings.syncState)
			this.syncStateManager = new SyncStateManager(this.settings.vaultId)
			this.syncStateManager.setState(migratedState)

			// Clear old format from settings
			this.settings.syncState = null
			await this.saveData(this.settings)
			console.log('✅ Migration complete, old format cleared from plugin data')
		} else {
			// No existing state - initialize fresh
			console.log('📝 Initializing new sync state')
			this.syncStateManager = new SyncStateManager(this.settings.vaultId)
		}
	}

	async saveSettings() {
		await this.saveData(this.settings)

		// Reinitialize Google Drive if credentials changed
		await this.initializeGoogleDrive()

		// Reinitialize services when settings change (especially vaultId or serverUrl)
		await this.initializeServices()
	}

	async saveSyncState() {
		// Save sync state to JSON file
		if (this.syncStateManager && this.syncIndexFile) {
			const state = this.syncStateManager.getState()
			await this.syncIndexFile.save(state)
		}
	}

	/**
	 * Initialize Google Drive authentication and client
	 */
	async initializeGoogleDrive() {
		if (!this.settings.googleClientId || !this.settings.googleClientSecret) {
			console.log('Google Drive credentials not configured')
			return
		}

		try {
			// Initialize auth service
			this.googleAuthService = new GoogleDriveAuthService(
				this.settings.googleClientId,
				this.settings.googleClientSecret
			)

			// Restore tokens if available
			if (this.settings.googleTokens) {
				this.googleAuthService.setTokens(this.settings.googleTokens)
				console.log('✅ Google Drive authentication restored from saved tokens')
			}
		} catch (error) {
			console.error('Failed to initialize Google Drive:', error)
			new Notice('Failed to initialize Google Drive: ' + (error as Error).message)
		}
	}

	/**
	 * Start OAuth flow
	 */
	async startGoogleDriveOAuth() {
		if (!this.googleAuthService) {
			new Notice('Please configure Google OAuth credentials first')
			return
		}

		try {
			const authUrl = this.googleAuthService.getAuthUrl()

			// Open auth URL in browser
			window.open(authUrl, '_blank')
			new Notice('Opening Google authentication in browser...')

			// Start local callback server to receive the OAuth code
			await this.startOAuthCallbackServer()
		} catch (error) {
			console.error('OAuth error:', error)
			new Notice('Failed to start OAuth: ' + (error as Error).message)
		}
	}

	/**
	 * Start a local HTTP server to receive OAuth callback
	 */
	async startOAuthCallbackServer() {
		// For Obsidian plugin, we'll use a simpler approach:
		// Show a modal for the user to paste the authorization code manually
		const modal = new OAuthCallbackModal(this.app, async (code: string) => {
			try {
				if (!this.googleAuthService) {
					throw new Error('Google Auth service not initialized')
				}

				new Notice('Exchanging authorization code...')
				const tokens = await this.googleAuthService.exchangeCodeForTokens(code)

				// Save tokens
				this.settings.googleTokens = tokens
				await this.saveData(this.settings)

				new Notice('✅ Successfully authenticated with Google Drive!')
				console.log('Google Drive authentication successful')
			} catch (error) {
				console.error('Failed to exchange auth code:', error)
				new Notice('Authentication failed: ' + (error as Error).message)
			}
		})
		modal.open()
	}

	/**
	 * Check Google Drive authentication status
	 */
	isGoogleDriveAuthenticated(): boolean {
		return this.googleAuthService?.isAuthenticated() || false
	}

	/**
	 * Sign out from Google Drive
	 */
	async signOutGoogleDrive() {
		if (this.googleAuthService) {
			try {
				await this.googleAuthService.revokeTokens()
				this.settings.googleTokens = null
				await this.saveData(this.settings)
				new Notice('Signed out from Google Drive')
			} catch (error) {
				console.error('Failed to sign out:', error)
				new Notice('Failed to sign out: ' + (error as Error).message)
			}
		}
	}

	private debouncedSync() {
		// Clear existing debounce timer
		if (this.syncDebounceTimer) {
			clearTimeout(this.syncDebounceTimer)
		}

		// Set new debounce timer (wait 3 seconds after last change)
		this.syncDebounceTimer = setTimeout(() => {
			if (this.pendingChanges.size > 0) {
				console.log(`Syncing ${this.pendingChanges.size} changed file(s)...`)
				this.syncVault()
			}
		}, 3000) // 3 second debounce
	}

	private startAutoSync() {
		if (this.syncTimer) {
			clearInterval(this.syncTimer)
		}

		this.syncTimer = setInterval(() => {
			// Only sync if there are pending changes
			if (this.pendingChanges.size > 0) {
				console.log(`Auto-sync: ${this.pendingChanges.size} pending change(s)`)
				this.syncVault()
			} else {
				console.log('Auto-sync: No changes, skipping')
			}
		}, this.settings.syncInterval * 1000)

		console.log(`Auto-sync started with ${this.settings.syncInterval}s interval`)
	}

	private stopAutoSync() {
		if (this.syncTimer) {
			clearInterval(this.syncTimer)
			this.syncTimer = null
		}
	}

	private async performInitialSync() {
		console.log('🚀 Performing initial sync on startup...')

		// Wait a bit for Obsidian to fully load
		await new Promise(resolve => setTimeout(resolve, 2000))

		if (!this.settings.vaultId) {
			console.log('  ⚠️ Vault ID not set, skipping initial sync')
			return
		}

		if (!this.syncService) {
			console.log('  ⚠️ Sync service not initialized, skipping initial sync')
			return
		}

		try {
			console.log('  📊 Checking for differences between local and remote...')
			const result = await this.syncService.syncVault()

			if (result.success) {
				if (result.downloadedFiles && result.downloadedFiles > 0) {
					console.log(`  ✅ Initial sync: Downloaded ${result.downloadedFiles} file(s) from remote`)
					new Notice(`Initial sync: Downloaded ${result.downloadedFiles} file(s) from remote`)
				} else if (result.uploadedFiles && result.uploadedFiles > 0) {
					console.log(`  ✅ Initial sync: Uploaded ${result.uploadedFiles} file(s) to remote`)
					new Notice(`Initial sync: Uploaded ${result.uploadedFiles} file(s) to remote`)
				} else {
					console.log('  ✅ Initial sync: Vault is up to date')
				}
			} else {
				console.error('  ❌ Initial sync failed:', result.message)
			}
		} catch (error) {
			console.error('  ❌ Initial sync error:', error)
		}
	}

	async syncVault() {
		if (!this.settings.vaultId) {
			new Notice('Please set a vault ID in the plugin settings')
			return
		}

		if (!this.syncService) {
			new Notice('Sync service not initialized')
			return
		}

		try {
			new Notice('Starting vault sync...')
			const result = await this.syncService.syncVault()

			if (result.success) {
				let message = `Sync completed`
				if (result.uploadedFiles && result.uploadedFiles > 0) {
					message += ` ↑${result.uploadedFiles}`
				}
				if (result.downloadedFiles && result.downloadedFiles > 0) {
					message += ` ↓${result.downloadedFiles}`
				}
				if (result.skippedFiles && result.skippedFiles > 0) {
					message += ` =${result.skippedFiles}`
				}
				if (result.conflicts && result.conflicts > 0) {
					message += ` ⚠${result.conflicts}`
				}
				new Notice(message)

				// Clear pending changes after successful sync
				this.pendingChanges.clear()
				console.log('Pending changes cleared')

				// Save sync state after successful sync
				await this.saveSyncState()
			} else {
				new Notice(`Sync failed: ${result.message}`)
			}
		} catch (error) {
			console.error('Sync error:', error)
			new Notice('Sync failed: ' + (error as Error).message)
		}
	}



	// Method to be called when settings change
	onSettingsChange() {
		if (this.settings.autoSync) {
			this.startAutoSync()
		} else {
			this.stopAutoSync()
		}
	}

	/**
	 * Generate a UUID v4 for syncAgentId
	 */
	private generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			const r = Math.random() * 16 | 0
			const v = c === 'x' ? r : (r & 0x3 | 0x8)
			return v.toString(16)
		})
	}
}

class VyncSettingTab extends PluginSettingTab {
	plugin: VyncPlugin

	constructor(app: App, plugin: VyncPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	async display(): Promise<void> {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Vync Settings' })

		// Info message about serverless architecture
		containerEl.createEl('p', {
			text: 'This plugin syncs your vault directly to Google Drive. No server required!',
			cls: 'setting-item-description'
		})

		// Google Drive Configuration Section
		containerEl.createEl('h3', { text: 'Google Drive Configuration' })

		new Setting(containerEl)
			.setName('Google Client ID')
			.setDesc('OAuth 2.0 Client ID from Google Cloud Console')
			.addText(text => text
				.setPlaceholder('Enter your Google Client ID')
				.setValue(this.plugin.settings.googleClientId)
				.onChange(async (value) => {
					this.plugin.settings.googleClientId = value
					await this.plugin.saveSettings()
				}))

		new Setting(containerEl)
			.setName('Google Client Secret')
			.setDesc('OAuth 2.0 Client Secret from Google Cloud Console')
			.addText(text => {
				text.setPlaceholder('Enter your Google Client Secret')
					.setValue(this.plugin.settings.googleClientSecret)
					.onChange(async (value) => {
						this.plugin.settings.googleClientSecret = value
						await this.plugin.saveSettings()
					})
				text.inputEl.type = 'password'
				return text
			})

		// Google Drive Authentication Section
		containerEl.createEl('h3', { text: 'Google Drive Authentication' })

		// Auth status display
		const authStatusSetting = new Setting(containerEl)
			.setName('Authentication Status')
			.setDesc(this.plugin.isGoogleDriveAuthenticated()
				? '✓ Authenticated with Google Drive'
				: '✗ Not authenticated')

		// Authenticate button
		if (!this.plugin.isGoogleDriveAuthenticated()) {
			authStatusSetting.addButton(button => button
				.setButtonText('Authenticate with Google Drive')
				.setCta()
				.onClick(async () => {
					await this.plugin.startGoogleDriveOAuth()
				}))
		} else {
			authStatusSetting.addButton(button => button
				.setButtonText('Sign Out')
				.setWarning()
				.onClick(async () => {
					await this.plugin.signOutGoogleDrive()
					this.display() // Refresh settings
				}))
		}

		// Vault Configuration Section
		containerEl.createEl('h3', { text: 'Vault Configuration' })

		new Setting(containerEl)
			.setName('Vault ID')
			.setDesc('Unique identifier for this vault')
			.addText(text => text
				.setPlaceholder('my-vault')
				.setValue(this.plugin.settings.vaultId)
				.onChange(async (value) => {
					this.plugin.settings.vaultId = value
					await this.plugin.saveSettings()
				}))

		// Sync Settings Section
		containerEl.createEl('h3', { text: 'Sync Settings' })

		new Setting(containerEl)
			.setName('Sync Interval')
			.setDesc('Auto-sync interval in seconds')
			.addSlider(slider => slider
				.setLimits(10, 300, 10)
				.setValue(this.plugin.settings.syncInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.syncInterval = value
					await this.plugin.saveSettings()
					this.plugin.onSettingsChange()
				}))

		new Setting(containerEl)
			.setName('Auto Sync')
			.setDesc('Automatically sync on file changes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value
					await this.plugin.saveSettings()
					this.plugin.onSettingsChange()
				}))

		new Setting(containerEl)
			.setName('Conflict Resolution')
			.setDesc('How to handle sync conflicts')
			.addDropdown(dropdown => dropdown
				.addOption('local', 'Keep local version')
				.addOption('remote', 'Keep remote version')
				.addOption('manual', 'Ask me each time')
				.setValue(this.plugin.settings.conflictResolution)
				.onChange(async (value: string) => {
					this.plugin.settings.conflictResolution = value as 'local' | 'remote' | 'manual'
					await this.plugin.saveSettings()
				}))

		// Add test connection button
		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Test connection to sync server')
			.addButton(button => button
				.setButtonText('Test Connection')
				.setCta()
				.onClick(() => {
					this.plugin.testConnection()
				}))
	}

}

// OAuth Callback Modal for manual code entry
class OAuthCallbackModal extends Modal {
	private callback: (code: string) => Promise<void>
	private codeInput: HTMLInputElement

	constructor(app: App, callback: (code: string) => Promise<void>) {
		super(app)
		this.callback = callback
	}

	onOpen() {
		const { contentEl } = this

		contentEl.createEl('h2', { text: 'Google Drive Authentication' })

		contentEl.createEl('p', {
			text: 'After authorizing in your browser, Google will redirect you to a page with an authorization code. Please copy and paste that code here:'
		})

		// Create input for authorization code
		this.codeInput = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Paste authorization code here'
		})
		this.codeInput.style.width = '100%'
		this.codeInput.style.padding = '8px'
		this.codeInput.style.marginTop = '10px'
		this.codeInput.style.marginBottom = '20px'

		// Add submit button
		const buttonContainer = contentEl.createDiv()
		buttonContainer.style.display = 'flex'
		buttonContainer.style.justifyContent = 'flex-end'
		buttonContainer.style.gap = '10px'

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' })
		cancelButton.addEventListener('click', () => {
			this.close()
		})

		const submitButton = buttonContainer.createEl('button', { text: 'Submit', cls: 'mod-cta' })
		submitButton.addEventListener('click', async () => {
			const code = this.codeInput.value.trim()
			if (code) {
				await this.callback(code)
				this.close()
			} else {
				new Notice('Please enter the authorization code')
			}
		})

		// Allow Enter key to submit
		this.codeInput.addEventListener('keypress', async (e) => {
			if (e.key === 'Enter') {
				const code = this.codeInput.value.trim()
				if (code) {
					await this.callback(code)
					this.close()
				}
			}
		})

		// Focus on input
		setTimeout(() => this.codeInput.focus(), 100)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
