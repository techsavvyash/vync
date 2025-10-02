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
  private fileIndex: Map<string, DriveFile> = new Map()

  constructor(storagePath: string = './local-storage') {
    this.storagePath = path.resolve(storagePath)
    this.initializeStorage()
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
    folderId?: string
  ): Promise<UploadResult> {
    try {
      // Generate unique file ID
      const fileId = crypto.randomUUID()
      const timestamp = new Date().toISOString()

      // Create file path
      const folderPath = folderId ? path.join(this.storagePath, folderId) : this.storagePath
      await fs.mkdir(folderPath, { recursive: true })

      const filePath = path.join(folderPath, `${fileId}_${fileName}`)

      // Write file
      await fs.writeFile(filePath, fileData)

      // Create file metadata
      const file: DriveFile = {
        id: fileId,
        name: fileName,
        mimeType,
        size: fileData.length,
        modifiedTime: timestamp,
        webContentLink: `file://${filePath}`,
        webViewLink: `file://${filePath}`
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

      // Find the actual file path
      const files = await fs.readdir(this.storagePath)
      const fileName = files.find(f => f.startsWith(`${fileId}_`))

      if (!fileName) {
        return {
          success: false,
          error: 'File data not found'
        }
      }

      const filePath = path.join(this.storagePath, fileName)
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

  public async listFiles(folderId?: string): Promise<ListResult> {
    try {
      const files: DriveFile[] = []

      if (folderId) {
        // List files in specific folder
        const folderPath = path.join(this.storagePath, folderId)
        try {
          const folderFiles = await fs.readdir(folderPath)
          for (const fileName of folderFiles) {
            if (fileName === 'index.json') continue

            const filePath = path.join(folderPath, fileName)
            const stats = await fs.stat(filePath)

            // Extract file ID from filename
            const fileId = fileName.split('_')[0]
            const originalName = fileName.substring(fileId.length + 1)

            const file: DriveFile = {
              id: fileId,
              name: originalName,
              mimeType: this.getMimeType(originalName),
              size: stats.size,
              modifiedTime: stats.mtime.toISOString(),
              webContentLink: `file://${filePath}`,
              webViewLink: `file://${filePath}`
            }

            files.push(file)
          }
        } catch (error) {
          // Folder doesn't exist
          console.log(`Folder ${folderId} not found`)
        }
      } else {
        // List all files from index
        files.push(...Array.from(this.fileIndex.values()))
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

      // Find and delete the actual file
      const files = await fs.readdir(this.storagePath)
      const fileName = files.find(f => f.startsWith(`${fileId}_`))

      if (fileName) {
        const filePath = path.join(this.storagePath, fileName)
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
      const file = this.fileIndex.get(fileId)
      if (!file) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      return {
        success: true,
        file
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