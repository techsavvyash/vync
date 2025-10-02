"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
class VaultWatcherService {
    constructor(_vaultPath) {
        this._watchedFiles = new Map();
        this._changeCallbacks = [];
        this._isWatching = false;
        this._watchTimer = null;
        this._vaultPath = _vaultPath;
        // Store vault path for future use
        console.log('VaultWatcherService initialized with path:', this._vaultPath);
    }
    async startWatching() {
        return Promise.resolve();
    }
    stopWatching() {
        if (this._watchTimer) {
            clearInterval(this._watchTimer);
            this._watchTimer = null;
        }
        this._isWatching = false;
        // Service stopped
    }
    onChange(callback) {
        this._changeCallbacks.push(callback);
        // Change callback registered
    }
    getWatchedFileCount() {
        return this._watchedFiles.size;
    }
}
class SyncService {
    constructor(serverUrl, vaultId) {
        this.serverUrl = serverUrl;
        this.vaultId = vaultId;
    }
    async syncVault(vaultPath) {
        console.log(`Syncing vault ${this.vaultId} from ${vaultPath}`);

        try {
            // Get all files in the vault
            const files = await this.getVaultFiles(vaultPath);
            console.log(`Found ${files.length} files in vault`);

            if (files.length === 0) {
                return { success: true, message: 'No files to sync', uploadedFiles: 0 };
            }

            // Upload files to server
            const uploadResults = await this.uploadFiles(files);
            console.log(`Uploaded ${uploadResults.length} files`);

            // Check for remote changes
            const remoteFiles = await this.getRemoteFiles();
            console.log(`Found ${remoteFiles.length} remote files`);

            // Download new remote files
            const downloadResults = await this.downloadFiles(remoteFiles, vaultPath);
            console.log(`Downloaded ${downloadResults.length} files`);

            return {
                success: true,
                message: 'Sync completed successfully',
                uploadedFiles: uploadResults.length,
                downloadedFiles: downloadResults.length
            };

        } catch (error) {
            console.error('Sync error:', error);
            return { success: false, message: `Sync failed: ${error.message}` };
        }
    }

    async getVaultFiles(vaultPath) {
        const files = [];
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');

        function scanDirectory(dirPath) {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            const fileList = [];

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                const relativePath = path.relative(vaultPath, fullPath);

                // Skip hidden files and .obsidian directory
                if (item.name.startsWith('.') || item.name === '.obsidian') {
                    continue;
                }

                if (item.isDirectory()) {
                    fileList.push(...scanDirectory(fullPath));
                } else if (item.isFile()) {
                    // Only sync relevant file types
                    const ext = path.extname(item.name).toLowerCase();
                    if (['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
                        try {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            const stats = fs.statSync(fullPath);
                            const hash = crypto.createHash('md5').update(content).digest('hex');

                            fileList.push({
                                path: relativePath,
                                content: content,
                                size: stats.size,
                                hash: hash,
                                modifiedTime: stats.mtime.getTime()
                            });
                        } catch (error) {
                            console.warn(`Failed to read file ${fullPath}:`, error);
                        }
                    }
                }
            }

            return fileList;
        }

        return scanDirectory(vaultPath);
    }

    async uploadFiles(files) {
        const results = [];

        for (const file of files) {
            try {
                const response = await fetch(`${this.serverUrl}/sync/upload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Origin': 'app://obsidian.md'
                    },
                    body: JSON.stringify({
                        vaultId: this.vaultId,
                        filePath: file.path,
                        fileData: Buffer.from(file.content).toString('base64'),
                        lastModified: file.modifiedTime
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        results.push(result);
                        console.log(`✅ Uploaded: ${file.path}`);
                    } else {
                        console.warn(`❌ Failed to upload ${file.path}:`, result.message);
                    }
                } else {
                    console.warn(`❌ HTTP ${response.status} for ${file.path}`);
                }
            } catch (error) {
                console.error(`❌ Error uploading ${file.path}:`, error);
            }
        }

        return results;
    }

    async getRemoteFiles() {
        try {
            const response = await fetch(`${this.serverUrl}/sync/metadata/${this.vaultId}`, {
                headers: {
                    'Origin': 'app://obsidian.md'
                }
            });

            if (response.ok) {
                const result = await response.json();
                return result.files || [];
            } else {
                console.warn(`❌ Failed to get remote files: HTTP ${response.status}`);
                return [];
            }
        } catch (error) {
            console.error('❌ Error getting remote files:', error);
            return [];
        }
    }

    async downloadFiles(remoteFiles, vaultPath) {
        const results = [];
        const fs = require('fs');
        const path = require('path');

        for (const remoteFile of remoteFiles) {
            try {
                // Check if we need to download this file
                const localPath = path.join(vaultPath, remoteFile.filePath);
                const exists = fs.existsSync(localPath);

                if (!exists) {
                    // Download the file
                    const response = await fetch(`${this.serverUrl}/sync/download/${remoteFile.id}`, {
                        headers: {
                            'Origin': 'app://obsidian.md'
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data && result.data.fileData) {
                            // Ensure directory exists
                            const dir = path.dirname(localPath);
                            fs.mkdirSync(dir, { recursive: true });

                            // Write file
                            const content = Buffer.from(result.data.fileData, 'base64').toString();
                            fs.writeFileSync(localPath, content);

                            results.push(result);
                            console.log(`✅ Downloaded: ${remoteFile.filePath}`);
                        } else {
                            console.warn(`❌ Invalid download response for ${remoteFile.filePath}`);
                        }
                    } else {
                        console.warn(`❌ HTTP ${response.status} downloading ${remoteFile.filePath}`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error downloading ${remoteFile.filePath}:`, error);
            }
        }

        return results;
    }
    async testConnection() {
        try {
            const response = await fetch(`${this.serverUrl}/health`);
            if (response.ok) {
                return { connected: true, message: 'Server connection successful' };
            }
            else {
                return { connected: false, message: 'Server connection failed' };
            }
        }
        catch (error) {
            return { connected: false, message: `Connection error: ${error}` };
        }
    }
}
class ConflictUIService {
    onResolution(callback) {
        // Placeholder
    }
    getPendingConflicts() {
        return [];
    }
    async resolveConflict(_conflictId, _resolution, _resolvedContent) {
        return true;
    }
}
const DEFAULT_SETTINGS = {
    serverUrl: 'http://localhost:3000',
    vaultId: '',
    syncInterval: 30, // seconds
    autoSync: true,
    conflictResolution: 'manual'
};
class ObsidianSyncPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.settings = DEFAULT_SETTINGS;
        this.syncTimer = null;
        this.vaultWatcher = null;
        this.syncService = null;
        this.conflictUI = null;
    }
    async onload() {
        await this.loadSettings();
        // Add ribbon icon
        this.addRibbonIcon('sync', 'Obsidian Sync', () => {
            this.syncVault();
        });
        // Add settings tab
        this.addSettingTab(new ObsidianSyncSettingTab(this.app, this));
        // Initialize services
        this.initializeServices();
        // Add commands
        this.addCommand({
            id: 'sync-vault',
            name: 'Sync Vault',
            callback: () => {
                this.syncVault();
            }
        });
        this.addCommand({
            id: 'test-connection',
            name: 'Test Server Connection',
            callback: () => {
                this.testConnection();
            }
        });
        console.log('Obsidian Sync plugin loaded');
    }
    onunload() {
        this.stopAutoSync();
        if (this.vaultWatcher) {
            this.vaultWatcher.stopWatching();
        }
        console.log('Obsidian Sync plugin unloaded');
    }
    initializeServices() {
        try {
            // Initialize sync service
            this.syncService = new SyncService(this.settings.serverUrl, this.settings.vaultId);
            // Initialize conflict UI service
            this.conflictUI = new ConflictUIService();
            // Set up conflict resolution handler
            this.conflictUI.onResolution((result) => {
                console.log(`Conflict resolved: ${result.conflictId} -> ${result.resolution}`);
                new obsidian_1.Notice(`Conflict resolved: ${result.resolution}`);
            });
            // Initialize vault watcher
            const vaultPath = this.app.vault.adapter.basePath;
            this.vaultWatcher = new VaultWatcherService(vaultPath);
            // Set up change listener
            this.vaultWatcher.onChange((change) => {
                console.log(`File ${change.changeType}: ${change.filePath}`);
                if (this.settings.autoSync) {
                    this.syncVault();
                }
            });
            // Start watching
            this.vaultWatcher.startWatching();
            // Start auto-sync if enabled
            if (this.settings.autoSync) {
                this.startAutoSync();
            }
            new obsidian_1.Notice('Obsidian Sync initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize Obsidian Sync:', error);
            new obsidian_1.Notice('Failed to initialize Obsidian Sync: ' + error.message);
        }
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    startAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        this.syncTimer = setInterval(() => {
            this.syncVault();
        }, this.settings.syncInterval * 1000);
        console.log(`Auto-sync started with ${this.settings.syncInterval}s interval`);
    }
    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }
    async syncVault() {
        if (!this.settings.vaultId) {
            new obsidian_1.Notice('Please set a vault ID in the plugin settings');
            return;
        }
        if (!this.syncService) {
            new obsidian_1.Notice('Sync service not initialized');
            return;
        }
        try {
            new obsidian_1.Notice('Starting vault sync...');
            const vaultPath = this.app.vault.adapter.basePath;
            const result = await this.syncService.syncVault(vaultPath);
            if (result.success) {
                let message = `Sync completed: ${result.message}`;
                if (result.uploadedFiles && result.uploadedFiles > 0) {
                    message += ` (${result.uploadedFiles} files uploaded)`;
                }
                if (result.downloadedFiles && result.downloadedFiles > 0) {
                    message += ` (${result.downloadedFiles} files downloaded)`;
                }
                if (result.conflicts && result.conflicts > 0) {
                    message += ` (${result.conflicts} conflicts)`;
                }
                new obsidian_1.Notice(message);
            }
            else {
                new obsidian_1.Notice(`Sync failed: ${result.message}`);
            }
        }
        catch (error) {
            console.error('Sync error:', error);
            new obsidian_1.Notice('Sync failed: ' + error.message);
        }
    }
    async testConnection() {
        if (!this.syncService) {
            new obsidian_1.Notice('Sync service not initialized');
            return;
        }
        try {
            const connection = await this.syncService.testConnection();
            if (connection.connected) {
                new obsidian_1.Notice(`Server connection successful: ${connection.message}`);
            }
            else {
                new obsidian_1.Notice(`Server connection failed: ${connection.message}`);
            }
        }
        catch (error) {
            new obsidian_1.Notice('Connection test failed: ' + error.message);
        }
    }
    // Method to be called when settings change
    onSettingsChange() {
        if (this.settings.autoSync) {
            this.startAutoSync();
        }
        else {
            this.stopAutoSync();
        }
    }
}
exports.default = ObsidianSyncPlugin;
class ObsidianSyncSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Obsidian Sync Settings' });
        new obsidian_1.Setting(containerEl)
            .setName('Server URL')
            .setDesc('URL of the sync server')
            .addText(text => text
            .setPlaceholder('http://localhost:3000')
            .setValue(this.plugin.settings.serverUrl)
            .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('Vault ID')
            .setDesc('Unique identifier for this vault')
            .addText(text => text
            .setPlaceholder('my-vault')
            .setValue(this.plugin.settings.vaultId)
            .onChange(async (value) => {
            this.plugin.settings.vaultId = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('Sync Interval')
            .setDesc('Auto-sync interval in seconds')
            .addSlider(slider => slider
            .setLimits(10, 300, 10)
            .setValue(this.plugin.settings.syncInterval)
            .setDynamicTooltip()
            .onChange(async (value) => {
            this.plugin.settings.syncInterval = value;
            await this.plugin.saveSettings();
            this.plugin.onSettingsChange();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('Auto Sync')
            .setDesc('Automatically sync on file changes')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.autoSync)
            .onChange(async (value) => {
            this.plugin.settings.autoSync = value;
            await this.plugin.saveSettings();
            this.plugin.onSettingsChange();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('Conflict Resolution')
            .setDesc('How to handle sync conflicts')
            .addDropdown(dropdown => dropdown
            .addOption('local', 'Keep local version')
            .addOption('remote', 'Keep remote version')
            .addOption('manual', 'Ask me each time')
            .setValue(this.plugin.settings.conflictResolution)
            .onChange(async (value) => {
            this.plugin.settings.conflictResolution = value;
            await this.plugin.saveSettings();
        }));
        // Add test connection button
        new obsidian_1.Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Test connection to sync server')
            .addButton(button => button
            .setButtonText('Test Connection')
            .setCta()
            .onClick(() => {
            this.plugin.testConnection();
        }));
    }
}
