"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultWatcherService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
class VaultWatcherService {
    constructor(vaultPath) {
        this.watchedFiles = new Map();
        this.changeCallbacks = [];
        this.isWatching = false;
        this.watchTimer = null;
        this.vaultPath = vaultPath;
    }
    async startWatching() {
        if (this.isWatching)
            return;
        this.isWatching = true;
        console.log(`Starting vault watcher for: ${this.vaultPath}`);
        // Initial scan
        await this.initialScan();
        // Set up periodic checking
        this.watchTimer = setInterval(() => {
            this.checkForChanges();
        }, 2000); // Check every 2 seconds
    }
    stopWatching() {
        if (this.watchTimer) {
            clearInterval(this.watchTimer);
            this.watchTimer = null;
        }
        this.isWatching = false;
        this.watchedFiles.clear();
        console.log('Vault watcher stopped');
    }
    onChange(callback) {
        this.changeCallbacks.push(callback);
    }
    async initialScan() {
        try {
            const files = await this.scanDirectory(this.vaultPath);
            for (const file of files) {
                this.watchedFiles.set(file.path, file);
            }
            console.log(`Initial scan complete: ${files.length} files found`);
        }
        catch (error) {
            console.error('Error during initial scan:', error);
        }
    }
    async scanDirectory(dirPath) {
        const files = [];
        try {
            const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dirPath, entry.name);
                const relativePath = path_1.default.relative(this.vaultPath, fullPath);
                if (entry.name.startsWith('.'))
                    continue;
                if (entry.isDirectory()) {
                    const subFiles = await this.scanDirectory(fullPath);
                    files.push(...subFiles);
                }
                else if (entry.isFile() && this.isRelevantFile(entry.name)) {
                    try {
                        const fileInfo = await this.getFileInfo(fullPath, relativePath);
                        files.push(fileInfo);
                    }
                    catch (error) {
                        console.warn(`Failed to get info for ${fullPath}:`, error);
                    }
                }
            }
        }
        catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
        }
        return files;
    }
    async getFileInfo(fullPath, relativePath) {
        const stats = await fs_1.promises.stat(fullPath);
        const content = await fs_1.promises.readFile(fullPath, 'utf8');
        const hash = crypto_1.default.createHash('md5').update(content).digest('hex');
        return {
            path: relativePath,
            name: path_1.default.basename(relativePath),
            size: stats.size,
            mtime: stats.mtime.getTime(),
            hash
        };
    }
    async checkForChanges() {
        try {
            const currentFiles = await this.scanDirectory(this.vaultPath);
            const currentFileMap = new Map(currentFiles.map(f => [f.path, f]));
            // Check for new and modified files
            for (const currentFile of currentFiles) {
                const previousFile = this.watchedFiles.get(currentFile.path);
                if (!previousFile) {
                    this.notifyChange({
                        filePath: currentFile.path,
                        changeType: 'created',
                        timestamp: Date.now(),
                        hash: currentFile.hash,
                        size: currentFile.size
                    });
                }
                else if (previousFile.hash !== currentFile.hash) {
                    this.notifyChange({
                        filePath: currentFile.path,
                        changeType: 'modified',
                        timestamp: Date.now(),
                        hash: currentFile.hash,
                        size: currentFile.size
                    });
                }
            }
            // Check for deleted files
            for (const [filePath] of this.watchedFiles) {
                if (!currentFileMap.has(filePath)) {
                    this.notifyChange({
                        filePath,
                        changeType: 'deleted',
                        timestamp: Date.now()
                    });
                }
            }
            this.watchedFiles = currentFileMap;
        }
        catch (error) {
            console.error('Error checking for changes:', error);
        }
    }
    notifyChange(change) {
        for (const callback of this.changeCallbacks) {
            try {
                callback(change);
            }
            catch (error) {
                console.error('Error in change callback:', error);
            }
        }
    }
    isRelevantFile(fileName) {
        const relevantExtensions = ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg'];
        const extension = path_1.default.extname(fileName).toLowerCase();
        return relevantExtensions.includes(extension);
    }
    getWatchedFileCount() {
        return this.watchedFiles.size;
    }
}
exports.VaultWatcherService = VaultWatcherService;
