import { Plugin, Notice, PluginSettingTab, App, Setting, TFile, TAbstractFile } from 'obsidian'
import { VaultWatcherService, VaultFileChange } from './services/vaultWatcher'
import { SyncService, SyncResult } from './services/syncService'
import { ConflictUIService } from './services/conflictUI'
import { SyncStateManager } from './services/syncState'
import { SyncIndexFile } from './services/syncIndexFile'

interface ObsidianSyncSettings {
	serverUrl: string
	vaultId: string
	syncInterval: number
	autoSync: boolean
	conflictResolution: 'local' | 'remote' | 'manual'
	syncState?: any // Persisted sync state
}

const DEFAULT_SETTINGS: ObsidianSyncSettings = {
	serverUrl: 'http://localhost:3000',
	vaultId: '',
	syncInterval: 30, // seconds
	autoSync: true,
	conflictResolution: 'manual',
	syncState: null
}

export default class ObsidianSyncPlugin extends Plugin {
	settings: ObsidianSyncSettings = DEFAULT_SETTINGS
	private syncTimer: NodeJS.Timeout | null = null
	private remoteCheckTimer: NodeJS.Timeout | null = null // Scheduled remote check
	private vaultWatcher: VaultWatcherService | null = null
	private syncService: SyncService | null = null
	private conflictUI: ConflictUIService | null = null
	private syncStateManager: SyncStateManager | null = null
	private syncIndexFile: SyncIndexFile | null = null // NEW: JSON file manager
	private pendingChanges: Set<string> = new Set() // Track files with pending changes
	private syncDebounceTimer: NodeJS.Timeout | null = null

	async onload() {
		await this.loadSettings()

		// Check if server is running
		this.checkServerAndNotify()

		// Add ribbon icon
		this.addRibbonIcon('sync', 'Obsidian Sync', () => {
			this.syncVault()
		})

		// Add settings tab
		this.addSettingTab(new ObsidianSyncSettingTab(this.app, this))

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
			name: 'Test Server Connection',
			callback: () => {
				this.testConnection()
			}
		})

		console.log('Obsidian Sync plugin loaded')
	}

	onunload() {
		this.stopAutoSync()
		this.stopRemoteCheck()
		if (this.vaultWatcher) {
			this.vaultWatcher.stopWatching()
		}
		console.log('Obsidian Sync plugin unloaded')
	}

	private async initializeServices() {
		try {
			console.log('Initializing services...')
			console.log('  Server URL:', this.settings.serverUrl)
			console.log('  Vault ID:', this.settings.vaultId || '(not set)')

			// Initialize sync index file manager
			this.syncIndexFile = new SyncIndexFile(this.app.vault)

			// Load sync state from JSON file (or migrate from old format)
			await this.loadSyncState()

			// Initialize sync service with vault reference and state manager
			this.syncService = new SyncService(
				this.settings.serverUrl,
				this.settings.vaultId,
				this.app.vault,
				this.syncStateManager
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
			this.vaultWatcher.onChange((change: VaultFileChange) => {
				if (change.isFolder) {
					// Handle folder changes
					console.log(`Folder ${change.changeType}: ${change.filePath}`)

					if (change.oldPath && change.changeType === 'created') {
						// Folder renamed
						if (this.syncStateManager) {
							this.syncStateManager.renameFolder(change.oldPath, change.filePath)
							// Save sync state after folder rename
							this.saveSyncState()
						}
					} else if (change.changeType === 'deleted') {
						// Folder deleted
						if (this.syncStateManager) {
							this.syncStateManager.removeFolder(change.filePath)
						}
					}
				} else {
					// Handle file changes
					console.log(`File ${change.changeType}: ${change.filePath}`)
				}

				// Add to pending changes
				this.pendingChanges.add(change.filePath)

				if (this.settings.autoSync) {
					// Debounce sync to batch multiple rapid changes
					this.debouncedSync()
				}
			})

			// Start watching
			this.vaultWatcher.startWatching()

			// Start auto-sync if enabled
			if (this.settings.autoSync) {
				this.startAutoSync()
			}

			// Start scheduled remote check (every 2 minutes)
			this.startRemoteCheck()

			// Perform initial sync on startup to check for remote changes
			this.performInitialSync()

			new Notice('Obsidian Sync initialized successfully')
		} catch (error) {
			console.error('Failed to initialize Obsidian Sync:', error)
			new Notice('Failed to initialize Obsidian Sync: ' + (error as Error).message)
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

	private debouncedSync() {
		// Clear existing debounce timer
		if (this.syncDebounceTimer) {
			clearTimeout(this.syncDebounceTimer)
		}

		// Set new debounce timer (wait 2 seconds after last change)
		this.syncDebounceTimer = setTimeout(() => {
			if (this.pendingChanges.size > 0) {
				console.log(`Syncing ${this.pendingChanges.size} changed file(s)...`)
				this.syncVault()
			}
		}, 2000) // 2 second debounce
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

	private startRemoteCheck() {
		// Clear existing timer
		if (this.remoteCheckTimer) {
			clearInterval(this.remoteCheckTimer)
		}

		console.log('🔍 Starting remote check timer (every 2 minutes)...')

		// Check remote every 2 minutes
		this.remoteCheckTimer = setInterval(async () => {
			console.log('⏰ Remote check timer fired')

			if (!this.syncStateManager || !this.syncService) {
				console.log('  ⚠️ syncStateManager or syncService not initialized, skipping')
				return
			}

			const needsCheck = this.syncStateManager.needsRemoteCheck(2 * 60 * 1000)
			console.log(`  needsRemoteCheck: ${needsCheck}`)

			// Only check if we haven't checked recently
			if (needsCheck) {
				console.log('  🔍 Scheduled remote check: Checking for remote changes...')

				try {
					// Trigger a sync (which will check remote and download if needed)
					const result = await this.syncService.syncVault()

					if (result.downloadedFiles && result.downloadedFiles > 0) {
						new Notice(`Downloaded ${result.downloadedFiles} file(s) from remote`)
					}
				} catch (error) {
					console.error('  ❌ Remote check failed:', error)
				}
			} else {
				console.log('  ⏭️ Remote check: Recently checked, skipping')
			}
		}, 2 * 60 * 1000) // Every 2 minutes

		console.log('✅ Remote check timer started (every 2 minutes)')
	}

	private stopRemoteCheck() {
		if (this.remoteCheckTimer) {
			clearInterval(this.remoteCheckTimer)
			this.remoteCheckTimer = null
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

	async testConnection() {
		if (!this.syncService) {
			new Notice('Sync service not initialized')
			return
		}

		try {
			const connection = await this.syncService.testConnection()
			if (connection.connected) {
				new Notice(`Server connection successful: ${connection.message}`)
			} else {
				new Notice(`Server connection failed: ${connection.message}`)
			}
		} catch (error) {
			new Notice('Connection test failed: ' + (error as Error).message)
		}
	}

	async checkAuthStatus(): Promise<{ authenticated: boolean; method?: string; message?: string }> {
		try {
			const response = await fetch(`${this.settings.serverUrl}/auth/status`)
			if (response.ok) {
				return await response.json()
			} else {
				return { authenticated: false, message: 'Failed to check auth status' }
			}
		} catch (error) {
			return { authenticated: false, message: `Auth check failed: ${error}` }
		}
	}

	openAuthPage() {
		window.open(`${this.settings.serverUrl}/auth/google`, '_blank')
		new Notice('Opening authentication page in browser...')
	}

	private async checkServerAndNotify() {
		const authStatus = await this.checkAuthStatus()

		if (!authStatus.authenticated) {
			setTimeout(() => {
				new Notice(
					'Obsidian Sync: Server not connected. Please start the server and authenticate with Google Drive.',
					10000
				)
			}, 2000)
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
}

class ObsidianSyncSettingTab extends PluginSettingTab {
	plugin: ObsidianSyncPlugin
	private authStatusEl: HTMLElement | null = null

	constructor(app: App, plugin: ObsidianSyncPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	async display(): Promise<void> {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Obsidian Sync Settings' })

		// Server Configuration Section
		containerEl.createEl('h3', { text: 'Server Configuration' })

		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('URL of the sync server')
			.addText(text => text
				.setPlaceholder('http://localhost:3000')
				.setValue(this.plugin.settings.serverUrl)
				.onChange(async (value) => {
					this.plugin.settings.serverUrl = value
					await this.plugin.saveSettings()
					// Refresh auth status when server URL changes
					this.updateAuthStatus()
				}))

		// Authentication Status Section
		containerEl.createEl('h3', { text: 'Authentication' })

		// Auth status display
		const authStatusSetting = new Setting(containerEl)
			.setName('Google Drive Authentication')
			.setDesc('Current authentication status')

		this.authStatusEl = authStatusSetting.descEl.createDiv()
		this.authStatusEl.setText('Checking authentication status...')

		// Check auth button
		authStatusSetting.addButton(button => button
			.setButtonText('Check Status')
			.onClick(async () => {
				await this.updateAuthStatus()
			}))

		// Authenticate button
		authStatusSetting.addButton(button => button
			.setButtonText('Authenticate')
			.setCta()
			.onClick(() => {
				this.plugin.openAuthPage()
			}))

		// Initial auth status check
		this.updateAuthStatus()

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

	async updateAuthStatus(): Promise<void> {
		if (!this.authStatusEl) return

		this.authStatusEl.setText('Checking...')
		this.authStatusEl.style.color = '#888'

		const status = await this.plugin.checkAuthStatus()

		if (status.authenticated) {
			this.authStatusEl.setText(`✓ Authenticated via ${status.method || 'OAuth2'}`)
			this.authStatusEl.style.color = '#4caf50'
		} else {
			this.authStatusEl.setText(`✗ Not authenticated - ${status.message || 'Please authenticate with Google Drive'}`)
			this.authStatusEl.style.color = '#f44336'
		}
	}
}
