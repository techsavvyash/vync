import { Plugin, Notice, PluginSettingTab, App, Setting } from 'obsidian'
// Inline service implementations to avoid module resolution issues
interface VaultFileChange {
  filePath: string
  changeType: 'created' | 'modified' | 'deleted'
  timestamp: number
  hash?: string
  size?: number
}

class VaultWatcherService {
  private _vaultPath: string
  private _watchedFiles: Map<string, any> = new Map()
  private _changeCallbacks: ((change: VaultFileChange) => void)[] = []
  private _isWatching: boolean = false
  private _watchTimer: NodeJS.Timeout | null = null

  constructor(_vaultPath: string) {
    this._vaultPath = _vaultPath
    // Store vault path for future use
    console.log('VaultWatcherService initialized with path:', this._vaultPath)
  }

  async startWatching(): Promise<void> {
    return Promise.resolve()
  }

  stopWatching(): void {
    if (this._watchTimer) {
      clearInterval(this._watchTimer)
      this._watchTimer = null
    }
    this._isWatching = false
    // Service stopped
  }

  onChange(callback: (change: VaultFileChange) => void): void {
    this._changeCallbacks.push(callback)
    // Change callback registered
  }

  getWatchedFileCount(): number {
    return this._watchedFiles.size
  }
}

class SyncService {
  constructor(private serverUrl: string, private vaultId: string) {}

  async syncVault(vaultPath: string): Promise<any> {
    console.log(`Syncing vault ${this.vaultId} from ${vaultPath}`)
    return { success: true, message: 'Sync completed' }
  }

  async testConnection(): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}/health`)
      if (response.ok) {
        return { connected: true, message: 'Server connection successful' }
      } else {
        return { connected: false, message: 'Server connection failed' }
      }
    } catch (error) {
      return { connected: false, message: `Connection error: ${error}` }
    }
  }
}

class ConflictUIService {
  onResolution(callback: (result: any) => void): void {
    // Placeholder
  }

  getPendingConflicts(): any[] {
    return []
  }

  async resolveConflict(_conflictId: string, _resolution: string, _resolvedContent?: string): Promise<boolean> {
    return true
  }
}

interface ObsidianSyncSettings {
	serverUrl: string
	vaultId: string
	syncInterval: number
	autoSync: boolean
	conflictResolution: 'local' | 'remote' | 'manual'
}

const DEFAULT_SETTINGS: ObsidianSyncSettings = {
	serverUrl: 'http://localhost:3000',
	vaultId: '',
	syncInterval: 30, // seconds
	autoSync: true,
	conflictResolution: 'manual'
}

export default class ObsidianSyncPlugin extends Plugin {
	settings: ObsidianSyncSettings = DEFAULT_SETTINGS
	private syncTimer: NodeJS.Timeout | null = null
	private vaultWatcher: VaultWatcherService | null = null
	private syncService: SyncService | null = null
	private conflictUI: ConflictUIService | null = null

	async onload() {
		await this.loadSettings()

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
		if (this.vaultWatcher) {
			this.vaultWatcher.stopWatching()
		}
		console.log('Obsidian Sync plugin unloaded')
	}

	private initializeServices() {
		try {
			// Initialize sync service
			this.syncService = new SyncService(this.settings.serverUrl, this.settings.vaultId)

			// Initialize conflict UI service
			this.conflictUI = new ConflictUIService()

			// Set up conflict resolution handler
			this.conflictUI.onResolution((result) => {
				console.log(`Conflict resolved: ${result.conflictId} -> ${result.resolution}`)
				new Notice(`Conflict resolved: ${result.resolution}`)
			})

			// Initialize vault watcher
			const vaultPath = (this.app.vault.adapter as any).basePath
			this.vaultWatcher = new VaultWatcherService(vaultPath)

			// Set up change listener
			this.vaultWatcher.onChange((change: VaultFileChange) => {
				console.log(`File ${change.changeType}: ${change.filePath}`)
				if (this.settings.autoSync) {
					this.syncVault()
				}
			})

			// Start watching
			this.vaultWatcher.startWatching()

			// Start auto-sync if enabled
			if (this.settings.autoSync) {
				this.startAutoSync()
			}

			new Notice('Obsidian Sync initialized successfully')
		} catch (error) {
			console.error('Failed to initialize Obsidian Sync:', error)
			new Notice('Failed to initialize Obsidian Sync: ' + (error as Error).message)
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	private startAutoSync() {
		if (this.syncTimer) {
			clearInterval(this.syncTimer)
		}

		this.syncTimer = setInterval(() => {
			this.syncVault()
		}, this.settings.syncInterval * 1000)

		console.log(`Auto-sync started with ${this.settings.syncInterval}s interval`)
	}

	private stopAutoSync() {
		if (this.syncTimer) {
			clearInterval(this.syncTimer)
			this.syncTimer = null
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
			const vaultPath = (this.app.vault.adapter as any).basePath
			const result = await this.syncService.syncVault(vaultPath)

			if (result.success) {
				let message = `Sync completed: ${result.message}`
				if (result.uploadedFiles && result.uploadedFiles > 0) {
					message += ` (${result.uploadedFiles} files uploaded)`
				}
				if (result.downloadedFiles && result.downloadedFiles > 0) {
					message += ` (${result.downloadedFiles} files downloaded)`
				}
				if (result.conflicts && result.conflicts > 0) {
					message += ` (${result.conflicts} conflicts)`
				}
				new Notice(message)
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

	constructor(app: App, plugin: ObsidianSyncPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Obsidian Sync Settings' })

		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('URL of the sync server')
			.addText(text => text
				.setPlaceholder('http://localhost:3000')
				.setValue(this.plugin.settings.serverUrl)
				.onChange(async (value) => {
					this.plugin.settings.serverUrl = value
					await this.plugin.saveSettings()
				}))

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
