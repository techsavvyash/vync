import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import {
  IDriveService,
  DriveFile,
  UploadResult,
  DownloadResult,
  ListResult,
  DeleteResult
} from './IDriveService'

export class LocalDriveService implements IDriveService {
  private storagePath: string
  private fileIndex: Map<string, DriveFile & { vaultId: string }> = new Map()

  constructor(storagePath: string = './local-storage') {
    this.storagePath = path.resolve(storagePath)
    this.initializeStorage()
  }

  private getVaultPath(vaultId: string): string {
    return path.join(this.storagePath, 'vaults', vaultId)
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true })
      console.log(`Local drive storage initialized at: ${this.storagePath}`)

      // Load existing file index
      await this.loadFileIndex()
    } catch (error) {
      console.error('Failed to initialize local drive storage:', error)
    }
  }

  private async loadFileIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.storagePath, 'index.json')
      const indexData = await fs.readFile(indexPath, 'utf8')
      const index = JSON.parse(indexData)

      // Convert back to Map
      this.fileIndex = new Map(Object.entries(index))
    } catch (error) {
      // Index doesn't exist yet, that's okay
      console.log('No existing file index found, starting fresh')
    }
  }

  private async saveFileIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.storagePath, 'index.json')
      const indexData = JSON.stringify(Object.fromEntries(this.fileIndex), null, 2)
      await fs.writeFile(indexPath, indexData, 'utf8')
    } catch (error) {
      console.error('Failed to save file index:', error)
    }
  }

  public isAuthenticated(): boolean {
    return true // Local storage is always available
  }

  public getServiceType(): string {
    return 'Local File System'
  }

  public async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      await fs.access(this.storagePath)
      return {
        connected: true,
        message: `Local storage available at ${this.storagePath}`
      }
    } catch (error) {
      return {
        connected: false,
        message: `Local storage not accessible: ${error}`
      }
    }
  }

  public async uploadFile(
    fileName: string,
    fileData: Buffer,
    mimeType: string,
    vaultId?: string
  ): Promise<UploadResult> {
    try {
      if (!vaultId) {
        return {
          success: false,
          error: 'Vault ID is required for upload'
        }
      }

      // Generate unique file ID
      const fileId = crypto.randomUUID()
      const timestamp = new Date().toISOString()

      // Create vault-specific path
      const vaultPath = this.getVaultPath(vaultId)
      await fs.mkdir(vaultPath, { recursive: true })

      const filePath = path.join(vaultPath, `${fileId}_${fileName}`)

      // Write file
      await fs.writeFile(filePath, fileData)

      // Create file metadata with vaultId
      const file: DriveFile & { vaultId: string } = {
        id: fileId,
        name: fileName,
        mimeType,
        size: fileData.length,
        modifiedTime: timestamp,
        webContentLink: `file://${filePath}`,
        webViewLink: `file://${filePath}`,
        vaultId
      }

      // Add to index
      this.fileIndex.set(fileId, file)
      await this.saveFileIndex()

      return {
        success: true,
        fileId
      }
    } catch (error) {
      console.error('Error uploading file to local storage:', error)
      return {
        success: false,
        error: `Upload failed: ${error}`
      }
    }
  }

  public async downloadFile(fileId: string): Promise<DownloadResult> {
    try {
      const file = this.fileIndex.get(fileId)
      if (!file) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Find the actual file path in vault-specific folder
      const vaultPath = this.getVaultPath(file.vaultId)
      const files = await fs.readdir(vaultPath)
      const fileName = files.find(f => f.startsWith(`${fileId}_`))

      if (!fileName) {
        return {
          success: false,
          error: 'File data not found'
        }
      }

      const filePath = path.join(vaultPath, fileName)
      const data = await fs.readFile(filePath)

      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('Error downloading file from local storage:', error)
      return {
        success: false,
        error: `Download failed: ${error}`
      }
    }
  }

  public async listFiles(vaultId?: string): Promise<ListResult> {
    try {
      const files: DriveFile[] = []

      if (vaultId) {
        // List files for specific vault only
        const allFiles = Array.from(this.fileIndex.values())
        files.push(...allFiles.filter(f => f.vaultId === vaultId).map(f => {
          // Remove vaultId from returned files (it's internal metadata)
          const { vaultId: _, ...file } = f
          return file as DriveFile
        }))
      } else {
        // List all files from all vaults (for admin purposes)
        files.push(...Array.from(this.fileIndex.values()).map(f => {
          const { vaultId: _, ...file } = f
          return file as DriveFile
        }))
      }

      // Sort by modified time (newest first)
      files.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())

      return {
        success: true,
        files
      }
    } catch (error) {
      console.error('Error listing files from local storage:', error)
      return {
        success: false,
        error: `List files failed: ${error}`
      }
    }
  }

  public async deleteFile(fileId: string): Promise<DeleteResult> {
    try {
      const file = this.fileIndex.get(fileId)
      if (!file) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Find and delete the actual file from vault-specific folder
      const vaultPath = this.getVaultPath(file.vaultId)
      const files = await fs.readdir(vaultPath)
      const fileName = files.find(f => f.startsWith(`${fileId}_`))

      if (fileName) {
        const filePath = path.join(vaultPath, fileName)
        await fs.unlink(filePath)
      }

      // Remove from index
      this.fileIndex.delete(fileId)
      await this.saveFileIndex()

      return {
        success: true
      }
    } catch (error) {
      console.error('Error deleting file from local storage:', error)
      return {
        success: false,
        error: `Delete failed: ${error}`
      }
    }
  }

  public async getFileMetadata(fileId: string): Promise<{ success: boolean; file?: DriveFile; error?: string }> {
    try {
      const fileWithVault = this.fileIndex.get(fileId)
      if (!fileWithVault) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Remove vaultId from returned file
      const { vaultId: _, ...file } = fileWithVault

      return {
        success: true,
        file: file as DriveFile
      }
    } catch (error) {
      console.error('Error getting file metadata from local storage:', error)
      return {
        success: false,
        error: `Get metadata failed: ${error}`
      }
    }
  }

  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'json': 'application/json',
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript'
    }
    return mimeTypes[extension] || 'application/octet-stream'
  }

  // Utility methods for testing
  public async clearStorage(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath)
      for (const file of files) {
        if (file !== 'index.json') {
          await fs.unlink(path.join(this.storagePath, file))
        }
      }
      this.fileIndex.clear()
      await this.saveFileIndex()
    } catch (error) {
      console.error('Error clearing storage:', error)
    }
  }

  public getStoragePath(): string {
    return this.storagePath
  }

  public getFileCount(): number {
    return this.fileIndex.size
  }
}