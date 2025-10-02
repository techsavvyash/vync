"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictUIService = void 0;
class ConflictUIService {
    constructor() {
        this.conflicts = new Map();
        this.resolutionCallbacks = [];
    }
    onResolution(callback) {
        this.resolutionCallbacks.push(callback);
    }
    removeResolutionListener(callback) {
        const index = this.resolutionCallbacks.indexOf(callback);
        if (index > -1) {
            this.resolutionCallbacks.splice(index, 1);
        }
    }
    addConflict(conflict) {
        this.conflicts.set(conflict.id, conflict);
        console.log(`New conflict detected: ${conflict.filePath}`);
        this.displayConflictNotification(conflict);
    }
    getPendingConflicts() {
        return Array.from(this.conflicts.values());
    }
    getConflict(conflictId) {
        return this.conflicts.get(conflictId) || null;
    }
    async resolveConflict(conflictId, resolution, resolvedContent) {
        const conflict = this.conflicts.get(conflictId);
        if (!conflict) {
            console.error(`Conflict ${conflictId} not found`);
            return false;
        }
        // Create resolution result
        const result = {
            conflictId,
            resolution,
            ...(resolvedContent !== undefined && { resolvedContent })
        };
        // Notify all callbacks
        for (const callback of this.resolutionCallbacks) {
            try {
                callback(result);
            }
            catch (error) {
                console.error('Error in resolution callback:', error);
            }
        }
        // Remove conflict from pending list
        this.conflicts.delete(conflictId);
        console.log(`Conflict resolved: ${conflict.filePath} -> ${resolution}`);
        return true;
    }
    displayConflictNotification(conflict) {
        // Since we don't have access to Obsidian's UI components,
        // we'll use console output and basic prompts
        console.log('\n=== CONFLICT DETECTED ===');
        console.log(`File: ${conflict.filePath}`);
        console.log(`Local version: ${conflict.localVersion.size} bytes, modified: ${new Date(conflict.localVersion.lastModified).toLocaleString()}`);
        console.log(`Remote version: ${conflict.remoteVersion.size} bytes, modified: ${new Date(conflict.remoteVersion.lastModified).toLocaleString()}`);
        console.log('========================\n');
        // In a real implementation, this would show a modal dialog
        // For now, we'll auto-resolve based on the default strategy
        this.autoResolveConflict(conflict);
    }
    async autoResolveConflict(conflict) {
        // Simple auto-resolution logic
        const { localVersion, remoteVersion } = conflict;
        let resolution = 'manual';
        let resolvedContent;
        // Rule 1: If one version is significantly larger, keep it
        const sizeDifference = Math.abs(localVersion.size - remoteVersion.size);
        if (sizeDifference > 1024) { // 1KB difference threshold
            resolution = localVersion.size > remoteVersion.size ? 'local' : 'remote';
        }
        // Rule 2: Keep the more recently modified version
        else if (localVersion.lastModified !== remoteVersion.lastModified) {
            resolution = localVersion.lastModified > remoteVersion.lastModified ? 'local' : 'remote';
        }
        // Rule 3: If sizes are similar and modification times are close, require manual resolution
        else if (Math.abs(localVersion.lastModified - remoteVersion.lastModified) < 60000) { // Within 1 minute
            resolution = 'manual';
            // For manual resolution, we could merge the content or show a diff
            resolvedContent = this.mergeContent(localVersion.content, remoteVersion.content);
        }
        // Apply the resolution
        await this.resolveConflict(conflict.id, resolution, resolvedContent);
    }
    mergeContent(localContent, remoteContent) {
        // Simple merge strategy: combine both versions with conflict markers
        return `<<<<<<< LOCAL VERSION
${localContent}
=======
${remoteContent}
>>>>>>> REMOTE VERSION`;
    }
    // Method to display conflict resolution options (for manual resolution)
    displayConflictOptions(conflict) {
        console.log(`\nConflict Resolution Options for: ${conflict.filePath}`);
        console.log('1. Keep local version');
        console.log('2. Keep remote version');
        console.log('3. Merge manually');
        console.log('4. View diff');
        console.log('\nChoose an option (1-4):');
        // In a real implementation, this would show an interactive dialog
        // For now, we'll just log the options
    }
    // Method to show diff between versions
    showDiff(conflict) {
        console.log(`\n=== DIFF for ${conflict.filePath} ===`);
        console.log('--- LOCAL VERSION ---');
        console.log(conflict.localVersion.content.substring(0, 500) + (conflict.localVersion.content.length > 500 ? '...' : ''));
        console.log('\n--- REMOTE VERSION ---');
        console.log(conflict.remoteVersion.content.substring(0, 500) + (conflict.remoteVersion.content.length > 500 ? '...' : ''));
        console.log('========================\n');
    }
    // Method to get conflict statistics
    getConflictStats() {
        const total = this.conflicts.size;
        // For now, all conflicts are pending since we don't track resolved ones separately
        return {
            total,
            resolved: 0,
            pending: total
        };
    }
    // Method to clear all conflicts
    clearConflicts() {
        this.conflicts.clear();
        console.log('All conflicts cleared');
    }
}
exports.ConflictUIService = ConflictUIService;
