import type { SyncFile, ConflictInfo } from '../types'

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'manual'
  resolvedFile?: SyncFile
}

export class ConflictDetectorService {
  private conflicts: Map<string, ConflictInfo> = new Map()

  /**
   * Detect conflicts between local and remote file versions
   */
  public detectConflict(
    localFile: SyncFile,
    remoteFile: SyncFile
  ): ConflictInfo | null {
    // If files have the same hash, no conflict
    if (localFile.hash && remoteFile.hash && localFile.hash === remoteFile.hash) {
      return null
    }

    // If both files have been modified since last sync
    if (localFile.lastModified > 0 && remoteFile.lastModified > 0) {
      // Check if both have been modified recently (within last hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000)
      const localRecent = localFile.lastModified > oneHourAgo
      const remoteRecent = remoteFile.lastModified > oneHourAgo

      if (localRecent && remoteRecent) {
        // Both files modified recently - potential conflict
        const conflictId = `${localFile.vaultId}:${localFile.filePath}`
        const conflict: ConflictInfo = {
          fileId: conflictId,
          localVersion: localFile,
          remoteVersion: remoteFile,
          timestamp: Date.now()
        }

        this.conflicts.set(conflictId, conflict)
        return conflict
      }
    }

    // No conflict detected
    return null
  }

  /**
   * Get all pending conflicts
   */
  public getPendingConflicts(): ConflictInfo[] {
    return Array.from(this.conflicts.values())
  }

  /**
   * Get a specific conflict by ID
   */
  public getConflict(conflictId: string): ConflictInfo | null {
    return this.conflicts.get(conflictId) || null
  }

  /**
   * Resolve a conflict with a specific strategy
   */
  public resolveConflict(
    conflictId: string,
    resolution: ConflictResolution
  ): boolean {
    const conflict = this.conflicts.get(conflictId)
    if (!conflict) {
      return false
    }

    switch (resolution.strategy) {
      case 'local':
        // Keep local version - no action needed for remote
        break
      case 'remote':
        // Keep remote version - would need to download and replace local
        break
      case 'manual':
        if (resolution.resolvedFile) {
          // Use the manually resolved file
          // This would need to be uploaded to replace both versions
        }
        break
    }

    // Remove the conflict from pending list
    this.conflicts.delete(conflictId)
    return true
  }

  /**
   * Auto-resolve conflicts based on simple rules
   */
  public autoResolveConflict(conflictId: string): ConflictResolution | null {
    const conflict = this.conflicts.get(conflictId)
    if (!conflict) {
      return null
    }

    const { localVersion, remoteVersion } = conflict

    // Rule 1: If one file is significantly larger, keep the larger one
    if (localVersion.size && remoteVersion.size) {
      const sizeDifference = Math.abs(localVersion.size - remoteVersion.size)
      const largerThreshold = 1024 // 1KB difference threshold

      if (sizeDifference > largerThreshold) {
        return {
          strategy: localVersion.size > remoteVersion.size ? 'local' : 'remote'
        }
      }
    }

    // Rule 2: Keep the more recently modified file
    if (localVersion.lastModified !== remoteVersion.lastModified) {
      return {
        strategy: localVersion.lastModified > remoteVersion.lastModified ? 'local' : 'remote'
      }
    }

    // Rule 3: If files have different hashes but same size and modification time,
    // this might be a content conflict - require manual resolution
    if (localVersion.hash !== remoteVersion.hash &&
        localVersion.size === remoteVersion.size &&
        localVersion.lastModified === remoteVersion.lastModified) {
      return {
        strategy: 'manual'
      }
    }

    // Default: keep local version
    return {
      strategy: 'local'
    }
  }

  /**
   * Check if a file has conflicts
   */
  public hasConflict(filePath: string, vaultId: string): boolean {
    const conflictId = `${vaultId}:${filePath}`
    return this.conflicts.has(conflictId)
  }

  /**
   * Clear all conflicts (useful for testing or reset)
   */
  public clearConflicts(): void {
    this.conflicts.clear()
  }

  /**
   * Get conflict statistics
   */
  public getConflictStats(): {
    total: number
    resolved: number
    pending: number
  } {
    const total = this.conflicts.size
    // For now, all conflicts are pending since we don't track resolved ones
    return {
      total,
      resolved: 0,
      pending: total
    }
  }
}