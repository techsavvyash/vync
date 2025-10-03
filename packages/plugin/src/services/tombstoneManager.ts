import { Vault } from 'obsidian'

/**
 * Tombstone entry for tracking deleted files
 */
export interface Tombstone {
  fileId: string // Google Drive file ID
  filePath: string // Original file path
  deletedAt: number // Timestamp when deleted
  deletedBy: string // syncAgentId of device that deleted it
}

/**
 * Tombstone Manager
 * Handles soft-deletion of files with a grace period before permanent removal
 * Prevents "zombie files" from reappearing when offline devices sync
 */
export class TombstoneManager {
  private tombstones: Map<string, Tombstone> = new Map()
  private vault: Vault
  private tombstoneFile = '.obsidian/sync-tombstones.json'
  private gracePeriodMs: number

  constructor(vault: Vault, gracePeriodDays: number = 30) {
    this.vault = vault
    this.gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000 // Convert days to milliseconds
  }

  /**
   * Load tombstones from the JSON file
   */
  async load(): Promise<void> {
    try {
      const exists = await this.vault.adapter.exists(this.tombstoneFile)
      if (!exists) {
        console.log('No tombstone file found, starting fresh')
        return
      }

      const data = await this.vault.adapter.read(this.tombstoneFile)
      const parsed = JSON.parse(data)

      if (parsed && typeof parsed === 'object') {
        this.tombstones = new Map(Object.entries(parsed))
        console.log(`Loaded ${this.tombstones.size} tombstone(s)`)
      }
    } catch (error) {
      console.error('Failed to load tombstones:', error)
    }
  }

  /**
   * Save tombstones to the JSON file
   */
  async save(): Promise<void> {
    try {
      const data = JSON.stringify(Object.fromEntries(this.tombstones), null, 2)
      await this.vault.adapter.write(this.tombstoneFile, data)
      console.log(`Saved ${this.tombstones.size} tombstone(s)`)
    } catch (error) {
      console.error('Failed to save tombstones:', error)
    }
  }

  /**
   * Add a tombstone for a deleted file
   */
  async addTombstone(fileId: string, filePath: string, syncAgentId: string): Promise<void> {
    const tombstone: Tombstone = {
      fileId,
      filePath,
      deletedAt: Date.now(),
      deletedBy: syncAgentId
    }

    this.tombstones.set(fileId, tombstone)
    await this.save()

    console.log(`📌 Added tombstone for: ${filePath} (ID: ${fileId})`)
  }

  /**
   * Check if a file has a tombstone
   */
  hasTombstone(fileId: string): boolean {
    return this.tombstones.has(fileId)
  }

  /**
   * Get a tombstone by file ID
   */
  getTombstone(fileId: string): Tombstone | undefined {
    return this.tombstones.get(fileId)
  }

  /**
   * Get all tombstones
   */
  getAllTombstones(): Tombstone[] {
    return Array.from(this.tombstones.values())
  }

  /**
   * Get tombstones that are past the grace period (ready for permanent deletion)
   */
  getExpiredTombstones(): Tombstone[] {
    const now = Date.now()
    const expired: Tombstone[] = []

    for (const tombstone of this.tombstones.values()) {
      if (now - tombstone.deletedAt > this.gracePeriodMs) {
        expired.push(tombstone)
      }
    }

    return expired
  }

  /**
   * Remove a tombstone (after permanent deletion)
   */
  async removeTombstone(fileId: string): Promise<void> {
    const tombstone = this.tombstones.get(fileId)
    if (tombstone) {
      this.tombstones.delete(fileId)
      await this.save()
      console.log(`🗑️  Removed tombstone for: ${tombstone.filePath} (ID: ${fileId})`)
    }
  }

  /**
   * Clean up old tombstones (past grace period)
   * Returns the list of file IDs that should be permanently deleted
   */
  async cleanupExpiredTombstones(): Promise<string[]> {
    const expired = this.getExpiredTombstones()
    const fileIdsToDelete: string[] = []

    for (const tombstone of expired) {
      fileIdsToDelete.push(tombstone.fileId)
      await this.removeTombstone(tombstone.fileId)
    }

    if (fileIdsToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${fileIdsToDelete.length} expired tombstone(s)`)
    }

    return fileIdsToDelete
  }

  /**
   * Get statistics about tombstones
   */
  getStats(): {
    total: number
    expired: number
    recent: number
    gracePeriodDays: number
  } {
    const expired = this.getExpiredTombstones()

    return {
      total: this.tombstones.size,
      expired: expired.length,
      recent: this.tombstones.size - expired.length,
      gracePeriodDays: this.gracePeriodMs / (24 * 60 * 60 * 1000)
    }
  }
}
