import { promises as fs } from 'fs'
import crypto from 'crypto'

export interface FileChange {
  filePath: string
  changeType: 'created' | 'modified' | 'deleted'
  timestamp: number
  hash?: string
  size?: number
}

export class FileWatcherService {
  private watchedPaths: Set<string> = new Set()
  private fileHashes: Map<string, string> = new Map()
  private fileSizes: Map<string, number> = new Map()
  private changeCallbacks: ((change: FileChange) => void)[] = []
  private isWatching: boolean = false

  constructor() {
    this.startWatching()
  }

  public watchPath(filePath: string): void {
    this.watchedPaths.add(filePath)
  }

  public unwatchPath(filePath: string): void {
    this.watchedPaths.delete(filePath)
    this.fileHashes.delete(filePath)
    this.fileSizes.delete(filePath)
  }

  public onChange(callback: (change: FileChange) => void): void {
    this.changeCallbacks.push(callback)
  }

  public removeChangeListener(callback: (change: FileChange) => void): void {
    const index = this.changeCallbacks.indexOf(callback)
    if (index > -1) {
      this.changeCallbacks.splice(index, 1)
    }
  }

  private async startWatching(): Promise<void> {
    if (this.isWatching) return

    this.isWatching = true
    console.log('File watcher started')

    // Initial scan of all watched paths
    await this.initialScan()

    // Set up periodic checking (since we don't have native file watching in this environment)
    setInterval(() => {
      this.checkForChanges()
    }, 2000) // Check every 2 seconds
  }

  private async initialScan(): Promise<void> {
    for (const filePath of this.watchedPaths) {
      try {
        await this.updateFileInfo(filePath)
      } catch (error) {
        console.warn(`Failed to scan file ${filePath}:`, error)
      }
    }
  }

  private async checkForChanges(): Promise<void> {
    for (const filePath of this.watchedPaths) {
      try {
        const exists = await this.fileExists(filePath)

        if (exists) {
          const currentHash = await this.calculateFileHash(filePath)
          const currentSize = await this.getFileSize(filePath)
          const previousHash = this.fileHashes.get(filePath)
          const previousSize = this.fileSizes.get(filePath)

          if (!previousHash) {
            // New file detected
            this.updateFileInfo(filePath)
            this.notifyChange({
              filePath,
              changeType: 'created',
              timestamp: Date.now(),
              hash: currentHash,
              size: currentSize
            })
          } else if (previousHash !== currentHash || previousSize !== currentSize) {
            // File modified
            this.updateFileInfo(filePath)
            this.notifyChange({
              filePath,
              changeType: 'modified',
              timestamp: Date.now(),
              hash: currentHash,
              size: currentSize
            })
          }
        } else if (this.fileHashes.has(filePath)) {
          // File was deleted
          this.fileHashes.delete(filePath)
          this.fileSizes.delete(filePath)
          this.notifyChange({
            filePath,
            changeType: 'deleted',
            timestamp: Date.now()
          })
        }
      } catch (error) {
        console.warn(`Error checking file ${filePath}:`, error)
      }
    }
  }

  private async updateFileInfo(filePath: string): Promise<void> {
    try {
      const hash = await this.calculateFileHash(filePath)
      const size = await this.getFileSize(filePath)

      this.fileHashes.set(filePath, hash)
      this.fileSizes.set(filePath, size)
    } catch (error) {
      console.warn(`Failed to update file info for ${filePath}:`, error)
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath)
      return crypto.createHash('md5').update(content).digest('hex')
    } catch (error) {
      throw new Error(`Failed to calculate hash for ${filePath}: ${error}`)
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath)
      return stats.size
    } catch (error) {
      throw new Error(`Failed to get size for ${filePath}: ${error}`)
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private notifyChange(change: FileChange): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(change)
      } catch (error) {
        console.error('Error in change callback:', error)
      }
    }
  }

  public getWatchedFiles(): string[] {
    return Array.from(this.watchedPaths)
  }

  public getFileInfo(filePath: string): { hash?: string; size?: number } {
    const hash = this.fileHashes.get(filePath)
    const size = this.fileSizes.get(filePath)
    return {
      ...(hash !== undefined && { hash }),
      ...(size !== undefined && { size })
    }
  }
}