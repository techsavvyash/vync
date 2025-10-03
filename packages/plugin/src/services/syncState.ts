/**
 * Sync State Manager
 * Tracks which files and folders have been synced and their last sync times
 * Enables incremental sync instead of full vault sync every time
 */

export interface SyncOperation {
  timestamp: number
  operation: 'upload' | 'download' | 'delete' | 'conflict'
  success: boolean
  error?: string
}

export interface FileSyncState {
  path: string
  lastSyncedHash: string
  lastSyncedTime: number
  lastSyncedSize: number
  lastSyncRevisionId?: string // Google Drive headRevisionId - authoritative version identifier
  createdTime?: number // NEW: File creation time (ctime)
  extension?: string // NEW: File extension for quick filtering
  remoteFileId?: string
  lastRemoteCheck?: number // When we last checked remote version
  remoteHash?: string // Last known remote hash
  remoteMtime?: number // Last known remote modification time
  remoteRevisionId?: string // Current remote headRevisionId
  // NEW: Enhanced tracking
  firstSyncedTime?: number // When file was first synced
  syncCount?: number // Number of times file has been synced
  lastError?: string // Last error encountered
  conflictCount?: number // Number of conflicts encountered
  history?: SyncOperation[] // Last 5 sync operations
}

export interface FolderSyncState {
  path: string
  lastSyncedTime: number
  remoteFolderId?: string
  lastRemoteCheck?: number // When we last checked remote version
  remoteMtime?: number // Last known remote modification time
  fileCount?: number // Number of files in folder (for quick change detection)
  subfolderCount?: number // Number of subfolders
}

export interface VaultSyncState {
  vaultId: string
  lastFullSync: number
  lastRemoteCheck: number // When we last checked remote for changes
  files: Map<string, FileSyncState>
  folders: Map<string, FolderSyncState> // NEW: Track folders
}

export class SyncStateManager {
  private state: VaultSyncState

  constructor(vaultId: string, initialState?: VaultSyncState) {
    if (initialState) {
      // Restore from saved state
      this.state = {
        ...initialState,
        lastRemoteCheck: initialState.lastRemoteCheck || 0,
        files: initialState.files instanceof Map
          ? initialState.files
          : new Map(Object.entries(initialState.files || {})),
        folders: initialState.folders instanceof Map
          ? initialState.folders
          : new Map(Object.entries(initialState.folders || {}))
      }
    } else {
      // Initialize new state
      this.state = {
        vaultId,
        lastFullSync: 0,
        lastRemoteCheck: 0,
        files: new Map(),
        folders: new Map()
      }
    }
  }

  /**
   * Check if a file needs to be synced based on hash and modification time
   */
  needsSync(filePath: string, currentHash: string, currentMtime: number, currentSize: number): boolean {
    const fileState = this.state.files.get(filePath)

    if (!fileState) {
      // Never synced before
      return true
    }

    // Check if file has changed
    if (fileState.lastSyncedHash !== currentHash) {
      return true
    }

    // Check if size changed (quick check)
    if (fileState.lastSyncedSize !== currentSize) {
      return true
    }

    // Check if modified time changed
    if (fileState.lastSyncedTime < currentMtime) {
      return true
    }

    return false
  }

  /**
   * Mark a file as synced with enhanced metadata
   */
  markSynced(
    filePath: string,
    hash: string,
    mtime: number,
    size: number,
    remoteFileId?: string,
    options?: {
      ctime?: number
      extension?: string
      operation?: 'upload' | 'download'
      revisionId?: string // Google Drive headRevisionId
    }
  ): void {
    const existing = this.state.files.get(filePath)
    const now = Date.now()
    const isFirstSync = !existing

    // Add operation to history
    const newOperation: SyncOperation = {
      timestamp: now,
      operation: options?.operation || 'upload',
      success: true
    }

    // Keep last 5 operations
    const history = existing?.history || []
    history.unshift(newOperation)
    if (history.length > 5) {
      history.pop()
    }

    this.state.files.set(filePath, {
      path: filePath,
      lastSyncedHash: hash,
      lastSyncedTime: mtime,
      lastSyncedSize: size,
      lastSyncRevisionId: options?.revisionId || existing?.lastSyncRevisionId,
      createdTime: options?.ctime || existing?.createdTime,
      extension: options?.extension || existing?.extension || this.getExtension(filePath),
      remoteFileId: remoteFileId || existing?.remoteFileId,
      lastRemoteCheck: existing?.lastRemoteCheck,
      remoteHash: existing?.remoteHash,
      remoteMtime: existing?.remoteMtime,
      remoteRevisionId: options?.revisionId || existing?.remoteRevisionId,
      firstSyncedTime: existing?.firstSyncedTime || now,
      syncCount: (existing?.syncCount || 0) + 1,
      lastError: undefined, // Clear error on successful sync
      conflictCount: existing?.conflictCount || 0,
      history
    })
  }

  /**
   * Get file extension from path
   */
  private getExtension(path: string): string {
    const lastDot = path.lastIndexOf('.')
    if (lastDot === -1) return ''
    return path.substring(lastDot).toLowerCase()
  }

  /**
   * Remove a file from sync state (when deleted)
   */
  removeFile(filePath: string): void {
    const existing = this.state.files.get(filePath)

    if (existing) {
      // Record deletion in history before removing
      const deleteOp: SyncOperation = {
        timestamp: Date.now(),
        operation: 'delete',
        success: true
      }

      const history = existing.history || []
      history.unshift(deleteOp)
      if (history.length > 5) {
        history.pop()
      }

      existing.history = history
    }

    this.state.files.delete(filePath)
  }

  /**
   * Get remote file ID for a synced file
   */
  getRemoteFileId(filePath: string): string | undefined {
    return this.state.files.get(filePath)?.remoteFileId
  }

  /**
   * Mark a sync error for a file
   */
  markSyncError(filePath: string, error: string, operation: 'upload' | 'download' | 'delete'): void {
    const existing = this.state.files.get(filePath)

    if (!existing) {
      // Create minimal entry for error tracking
      this.state.files.set(filePath, {
        path: filePath,
        lastSyncedHash: '',
        lastSyncedTime: 0,
        lastSyncedSize: 0,
        lastError: error,
        syncCount: 0,
        conflictCount: 0,
        history: [{
          timestamp: Date.now(),
          operation,
          success: false,
          error
        }]
      })
      return
    }

    // Update existing entry
    existing.lastError = error

    // Add to history
    const errorOp: SyncOperation = {
      timestamp: Date.now(),
      operation,
      success: false,
      error
    }

    const history = existing.history || []
    history.unshift(errorOp)
    if (history.length > 5) {
      history.pop()
    }

    existing.history = history
  }

  /**
   * Mark a conflict for a file
   */
  markConflict(filePath: string): void {
    const existing = this.state.files.get(filePath)

    if (!existing) {
      return
    }

    existing.conflictCount = (existing.conflictCount || 0) + 1

    // Add to history
    const conflictOp: SyncOperation = {
      timestamp: Date.now(),
      operation: 'conflict',
      success: false,
      error: 'Conflict detected: both local and remote modified'
    }

    const history = existing.history || []
    history.unshift(conflictOp)
    if (history.length > 5) {
      history.pop()
    }

    existing.history = history
  }

  /**
   * Get files with errors
   */
  getFilesWithErrors(): Array<{ path: string; error: string }> {
    const filesWithErrors: Array<{ path: string; error: string }> = []

    this.state.files.forEach((state, path) => {
      if (state.lastError) {
        filesWithErrors.push({ path, error: state.lastError })
      }
    })

    return filesWithErrors
  }

  /**
   * Get files with conflicts
   */
  getFilesWithConflicts(): Array<{ path: string; conflictCount: number }> {
    const filesWithConflicts: Array<{ path: string; conflictCount: number }> = []

    this.state.files.forEach((state, path) => {
      if (state.conflictCount && state.conflictCount > 0) {
        filesWithConflicts.push({ path, conflictCount: state.conflictCount })
      }
    })

    return filesWithConflicts
  }

  /**
   * Mark that a full sync was completed
   */
  markFullSyncCompleted(): void {
    this.state.lastFullSync = Date.now()
  }

  /**
   * Get time since last full sync
   */
  timeSinceLastFullSync(): number {
    return Date.now() - this.state.lastFullSync
  }

  /**
   * Check if a full sync is needed (e.g., after 24 hours)
   */
  needsFullSync(maxAge: number = 24 * 60 * 60 * 1000): boolean {
    return this.timeSinceLastFullSync() > maxAge
  }

  /**
   * Get all synced file paths
   */
  getSyncedFiles(): string[] {
    return Array.from(this.state.files.keys())
  }

  /**
   * Get count of synced files
   */
  getSyncedFileCount(): number {
    return this.state.files.size
  }

  /**
   * Serialize state for persistence
   */
  toJSON(): any {
    return {
      vaultId: this.state.vaultId,
      lastFullSync: this.state.lastFullSync,
      lastRemoteCheck: this.state.lastRemoteCheck,
      files: Object.fromEntries(this.state.files),
      folders: Object.fromEntries(this.state.folders)
    }
  }

  /**
   * Get statistics about sync state
   */
  getStats() {
    const filesWithErrors = this.getFilesWithErrors()
    const filesWithConflicts = this.getFilesWithConflicts()

    // Calculate sync counts by extension
    const extensionCounts: Record<string, number> = {}
    this.state.files.forEach((state) => {
      if (state.extension) {
        extensionCounts[state.extension] = (extensionCounts[state.extension] || 0) + 1
      }
    })

    // Calculate average sync count
    let totalSyncCount = 0
    this.state.files.forEach((state) => {
      totalSyncCount += state.syncCount || 0
    })
    const avgSyncCount = this.state.files.size > 0
      ? Math.round(totalSyncCount / this.state.files.size * 10) / 10
      : 0

    return {
      vaultId: this.state.vaultId,
      totalFilesSynced: this.state.files.size,
      totalFoldersTracked: this.state.folders.size,
      filesWithErrors: filesWithErrors.length,
      filesWithConflicts: filesWithConflicts.length,
      extensionCounts,
      avgSyncCount,
      lastFullSync: new Date(this.state.lastFullSync).toISOString(),
      timeSinceLastFullSync: this.timeSinceLastFullSync()
    }
  }

  /**
   * Clear all sync state (force full sync next time)
   */
  clear(): void {
    this.state.files.clear()
    this.state.folders.clear()
    this.state.lastFullSync = 0
    this.state.lastRemoteCheck = 0
  }

  /**
   * Update remote file information from metadata
   */
  updateRemoteFileInfo(filePath: string, remoteFileId: string, remoteMtime: number, remoteHash?: string, remoteRevisionId?: string): void {
    const existing = this.state.files.get(filePath)
    if (existing) {
      existing.lastRemoteCheck = Date.now()
      existing.remoteMtime = remoteMtime
      existing.remoteHash = remoteHash
      existing.remoteFileId = remoteFileId
      existing.remoteRevisionId = remoteRevisionId
    } else {
      // File exists remotely but not in our index - needs download
      this.state.files.set(filePath, {
        path: filePath,
        lastSyncedHash: '', // Unknown local hash
        lastSyncedTime: 0, // Never synced locally
        lastSyncedSize: 0,
        remoteFileId,
        lastRemoteCheck: Date.now(),
        remoteMtime,
        remoteHash,
        remoteRevisionId
      })
    }
  }

  /**
   * Mark that we checked remote for changes
   */
  markRemoteCheckCompleted(): void {
    this.state.lastRemoteCheck = Date.now()
  }

  /**
   * Check if we need to check remote (e.g., every 2 minutes)
   */
  needsRemoteCheck(intervalMs: number = 2 * 60 * 1000): boolean {
    return (Date.now() - this.state.lastRemoteCheck) > intervalMs
  }

  /**
   * Determine if a remote file needs to be downloaded
   * Returns: 'download' | 'conflict' | 'skip'
   */
  shouldDownloadRemoteFile(
    filePath: string,
    remoteFileId: string,
    remoteMtime: number,
    localExists: boolean,
    localMtime: number,
    localHash: string
  ): 'download' | 'conflict' | 'skip' {
    const fileState = this.state.files.get(filePath)

    // File doesn't exist locally - download it regardless of sync state
    if (!localExists) {
      console.log(`  → Download: ${filePath} (not in local vault)`)
      return 'download'
    }

    // File exists locally - check if it's been modified
    if (!fileState) {
      // File exists locally but never synced
      // Check if remote file ID matches - if no fileState, we should treat this as a new remote file to download
      // Unless there's actual local content that conflicts
      if (localHash && localHash.length > 0) {
        // Local file has content and was never synced - potential conflict
        console.log(`  → Conflict: ${filePath} (exists locally with content but never synced)`)
        return 'conflict'
      } else {
        // Local file is empty or doesn't have hash - safe to download
        console.log(`  → Download: ${filePath} (exists locally but empty/no sync state)`)
        return 'download'
      }
    }

    // Check if file was never actually synced locally
    if (fileState.lastSyncedTime === 0 && fileState.lastSyncedHash === '') {
      // File exists remotely but was never synced locally - needs download
      if (!localExists) {
        console.log(`  → Download: ${filePath} (remote file never synced, not in local vault)`)
        return 'download'
      } else {
        // File exists locally but was never synced - check if it conflicts
        if (localHash && localHash.length > 0) {
          console.log(`  → Conflict: ${filePath} (exists locally with content but never synced)`)
          return 'conflict'
        } else {
          console.log(`  → Download: ${filePath} (remote file never synced, empty local file)`)
          return 'download'
        }
      }
    }

    // Compare remote timestamp with what we last synced
    if (fileState.remoteMtime && remoteMtime <= fileState.remoteMtime) {
      // Remote hasn't changed since we last checked
      // But check if we have actually downloaded it before
      if (fileState.lastSyncedTime === 0) {
        console.log(`  → Download: ${filePath} (remote exists but never downloaded)`)
        return 'download'
      }
      console.log(`  → Skip: ${filePath} (remote unchanged)`)
      return 'skip'
    }

    // Remote is newer - check if local also changed
    const localChanged = (fileState.lastSyncedHash !== localHash) || (fileState.lastSyncedTime < localMtime)

    if (localChanged && remoteMtime > fileState.lastSyncedTime) {
      // CONFLICT: Both local and remote changed since last sync
      console.log(`  → Conflict: ${filePath} (both local and remote modified)`)
      return 'conflict'
    }

    if (remoteMtime > fileState.lastSyncedTime && !localChanged) {
      // Remote is newer, local unchanged - safe to download
      console.log(`  → Download: ${filePath} (remote newer, local unchanged)`)
      return 'download'
    }

    // Local is newer or same - skip download
    console.log(`  → Skip: ${filePath} (local is current)`)
    return 'skip'
  }

  /**
   * Get file state for a path
   */
  getFileState(filePath: string): FileSyncState | undefined {
    return this.state.files.get(filePath)
  }

  // ==================== FOLDER TRACKING METHODS ====================

  /**
   * Track a folder
   */
  trackFolder(folderPath: string, mtime: number, fileCount: number, subfolderCount: number, remoteFolderId?: string): void {
    this.state.folders.set(folderPath, {
      path: folderPath,
      lastSyncedTime: mtime,
      remoteFolderId,
      lastRemoteCheck: Date.now(),
      fileCount,
      subfolderCount
    })
  }

  /**
   * Update folder modification time
   */
  updateFolder(folderPath: string, mtime: number, fileCount?: number, subfolderCount?: number): void {
    const existing = this.state.folders.get(folderPath)
    if (existing) {
      existing.lastSyncedTime = mtime
      existing.lastRemoteCheck = Date.now()
      if (fileCount !== undefined) existing.fileCount = fileCount
      if (subfolderCount !== undefined) existing.subfolderCount = subfolderCount
    } else {
      this.trackFolder(folderPath, mtime, fileCount || 0, subfolderCount || 0)
    }
  }

  /**
   * Remove a folder from tracking (when deleted)
   */
  removeFolder(folderPath: string): void {
    this.state.folders.delete(folderPath)
  }

  /**
   * Get folder state
   */
  getFolderState(folderPath: string): FolderSyncState | undefined {
    return this.state.folders.get(folderPath)
  }

  /**
   * Get all tracked folders
   */
  getTrackedFolders(): string[] {
    return Array.from(this.state.folders.keys())
  }

  /**
   * Get count of tracked folders
   */
  getTrackedFolderCount(): number {
    return this.state.folders.size
  }

  /**
   * Check if a folder has changed (file count or subfolder count)
   */
  hasFolderChanged(folderPath: string, fileCount: number, subfolderCount: number): boolean {
    const folderState = this.state.folders.get(folderPath)

    if (!folderState) {
      // Never tracked before
      return true
    }

    // Check if counts changed
    if (folderState.fileCount !== fileCount || folderState.subfolderCount !== subfolderCount) {
      return true
    }

    return false
  }

  /**
   * Handle folder rename/move
   */
  renameFolder(oldPath: string, newPath: string): void {
    // Normalize folder paths to ensure they end with /
    const normalizedOldPath = oldPath.endsWith('/') ? oldPath : oldPath + '/'
    const normalizedNewPath = newPath.endsWith('/') ? newPath : newPath + '/'

    const folderState = this.state.folders.get(normalizedOldPath)

    if (folderState) {
      // Update folder path
      folderState.path = normalizedNewPath
      this.state.folders.set(normalizedNewPath, folderState)
      this.state.folders.delete(normalizedOldPath)

      // Update all files in the folder
      const filesToUpdate: Array<[string, FileSyncState]> = []

      this.state.files.forEach((fileState, filePath) => {
        if (filePath.startsWith(normalizedOldPath)) {
          const newFilePath = normalizedNewPath + filePath.substring(normalizedOldPath.length)
          fileState.path = newFilePath
          filesToUpdate.push([newFilePath, fileState])
          this.state.files.delete(filePath)
        }
      })

      // Add updated files back
      filesToUpdate.forEach(([path, state]) => {
        this.state.files.set(path, state)
      })

      console.log(`📁 Renamed folder: ${normalizedOldPath} → ${normalizedNewPath}`)
      console.log(`   Updated ${filesToUpdate.length} file(s) in folder`)
    }
  }

  /**
   * Get the entire vault sync state
   * Used by SyncIndexFile for persistence
   */
  getState(): VaultSyncState {
    return this.state
  }

  /**
   * Set the entire vault sync state
   * Used by SyncIndexFile when loading from disk
   */
  setState(state: VaultSyncState): void {
    this.state = state
  }
}
