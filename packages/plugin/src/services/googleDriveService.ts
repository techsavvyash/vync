import { requestUrl } from 'obsidian'
import { GoogleDriveAuthService } from './googleDriveAuth'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  webContentLink?: string
  webViewLink?: string
}

export interface UploadResult {
  success: boolean
  fileId?: string
  error?: string
}

export interface DownloadResult {
  success: boolean
  data?: ArrayBuffer
  error?: string
}

export interface ListResult {
  success: boolean
  files?: DriveFile[]
  error?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
}

/**
 * Browser-compatible Google Drive service
 * Uses Obsidian's requestUrl instead of Node.js libraries
 */
export class GoogleDriveService {
  private vaultFolderCache: Map<string, string> = new Map()

  constructor(private authService: GoogleDriveAuthService) {}

  async isAuthenticated(): Promise<boolean> {
    return this.authService.isAuthenticated()
  }

  /**
   * Get or create a vault-specific folder in Google Drive
   */
  private async getOrCreateVaultFolder(vaultId: string): Promise<string | null> {
    console.log('  📁 Getting/creating vault folder...')
    console.log('    Vault ID:', vaultId)

    // Check cache first
    if (this.vaultFolderCache.has(vaultId)) {
      const cachedId = this.vaultFolderCache.get(vaultId)!
      console.log('    ✓ Found in cache:', cachedId)
      return cachedId
    }

    try {
      const folderName = `vault_${vaultId}`
      console.log('    Searching for folder:', folderName)

      const accessToken = await this.authService.getValidAccessToken()

      // Search for existing vault folder
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`

      const response = await requestUrl({
        url: searchUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const files = response.json.files || []

      if (files.length > 0) {
        const folderId = files[0].id
        console.log('    ✓ Found existing folder:', folderId)

        // Delete duplicates if any
        if (files.length > 1) {
          console.log('    🗑️  Found', files.length - 1, 'duplicate folder(s), deleting...')
          for (let i = 1; i < files.length; i++) {
            try {
              await this.deleteFile(files[i].id)
              console.log('    ✓ Deleted duplicate folder:', files[i].id)
            } catch (err) {
              console.warn('    ⚠️  Failed to delete duplicate folder:', err)
            }
          }
        }

        this.vaultFolderCache.set(vaultId, folderId)
        return folderId
      }

      // Create new vault folder
      console.log('    Creating new folder:', folderName)
      const createResponse = await requestUrl({
        url: 'https://www.googleapis.com/drive/v3/files',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      })

      const folderId = createResponse.json.id
      console.log('    ✓ Created new folder:', folderId)
      this.vaultFolderCache.set(vaultId, folderId)
      return folderId
    } catch (error) {
      console.error('    ❌ Error getting/creating vault folder:', error)
      return null
    }
  }

  /**
   * Create a folder in Google Drive
   */
  private async createFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    try {
      const accessToken = await this.authService.getValidAccessToken()

      const metadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      }

      if (parentFolderId) {
        metadata.parents = [parentFolderId]
      }

      const response = await requestUrl({
        url: 'https://www.googleapis.com/drive/v3/files',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      })

      console.log(`    📁 Created folder: ${folderName} (ID: ${response.json.id})`)
      return response.json.id
    } catch (error) {
      console.error('Error creating folder:', error)
      return null
    }
  }

  /**
   * Ensure a folder path exists (create if needed)
   */
  private async ensureFolderPath(folderPath: string, parentFolderId: string): Promise<string | null> {
    if (!folderPath) {
      return parentFolderId
    }

    try {
      const parts = folderPath.split('/').filter(p => p)

      if (parts.length === 0) {
        return parentFolderId
      }

      let currentParentId = parentFolderId
      const accessToken = await this.authService.getValidAccessToken()

      for (const folderName of parts) {
        // Search for existing folder
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false&fields=files(id,name)`

        const response = await requestUrl({
          url: searchUrl,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        const files = response.json.files || []
        let folderId: string | null = null

        if (files.length > 0) {
          folderId = files[0].id
          console.log(`    📁 Found existing folder: ${folderName} (ID: ${folderId})`)
        } else {
          folderId = await this.createFolder(folderName, currentParentId)
          if (!folderId) {
            console.error(`    ❌ Failed to create folder: ${folderName}`)
            return null
          }
        }

        currentParentId = folderId
      }

      return currentParentId
    } catch (error) {
      console.error('Error ensuring folder path:', error)
      return null
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    filePath: string,
    fileData: ArrayBuffer,
    mimeType: string,
    vaultId: string
  ): Promise<UploadResult> {
    console.log('  🔵 GoogleDriveService.uploadFile() called')
    console.log('    File path:', filePath)
    console.log('    MIME type:', mimeType)
    console.log('    Vault ID:', vaultId)
    console.log('    Data size:', fileData.byteLength, 'bytes')

    try {
      const accessToken = await this.authService.getValidAccessToken()

      // Get or create vault-specific folder
      const vaultFolderId = await this.getOrCreateVaultFolder(vaultId)
      if (!vaultFolderId) {
        return {
          success: false,
          error: 'Failed to get/create vault folder'
        }
      }

      // Parse the file path to get folder path and file name
      const pathParts = filePath.split('/')
      const fileName = pathParts.pop() || filePath
      const folderPath = pathParts.join('/')

      // Get or create the folder structure within the vault folder
      let targetFolderId = vaultFolderId
      if (folderPath) {
        console.log('    📁 Ensuring folder path exists:', folderPath)
        targetFolderId = await this.ensureFolderPath(folderPath, vaultFolderId) || vaultFolderId
        console.log('    Target folder ID:', targetFolderId)
      }

      // Check if file already exists
      console.log('    🔍 Checking for existing file...')
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${targetFolderId}' in parents and trashed=false&fields=files(id,name)`

      const searchResponse = await requestUrl({
        url: searchUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const existingFiles = searchResponse.json.files || []
      console.log('    Found', existingFiles.length, 'existing file(s)')

      let fileId: string

      if (existingFiles.length > 0) {
        // Update existing file
        fileId = existingFiles[0].id
        console.log('    ♻️  Updating existing file:', fileId)

        // Delete duplicates
        if (existingFiles.length > 1) {
          console.log('    🗑️  Deleting', existingFiles.length - 1, 'duplicate(s)...')
          for (let i = 1; i < existingFiles.length; i++) {
            try {
              await this.deleteFile(existingFiles[i].id)
              console.log('    ✓ Deleted duplicate:', existingFiles[i].id)
            } catch (err) {
              console.warn('    ⚠️  Failed to delete duplicate:', err)
            }
          }
        }

        // Update file content using multipart upload
        const boundary = '-------314159265358979323846'
        const delimiter = `\r\n--${boundary}\r\n`
        const closeDelimiter = `\r\n--${boundary}--`

        const base64Data = arrayBufferToBase64(fileData)

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify({ mimeType }) +
          delimiter +
          'Content-Type: ' + mimeType + '\r\n' +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64Data +
          closeDelimiter

        await requestUrl({
          url: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        })

        console.log('    ✅ File UPDATED')
      } else {
        // Create new file
        console.log('    ➕ Creating new file...')

        const boundary = '-------314159265358979323846'
        const delimiter = `\r\n--${boundary}\r\n`
        const closeDelimiter = `\r\n--${boundary}--`

        const base64Data = arrayBufferToBase64(fileData)

        const metadata = {
          name: fileName,
          mimeType: mimeType,
          parents: [targetFolderId]
        }

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: ' + mimeType + '\r\n' +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64Data +
          closeDelimiter

        const createResponse = await requestUrl({
          url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        })

        fileId = createResponse.json.id
        console.log('    ✅ File CREATED')
      }

      console.log('    File ID:', fileId)
      return {
        success: true,
        fileId
      }
    } catch (error) {
      console.error('    ❌ Error uploading file:', error)
      return {
        success: false,
        error: `Upload failed: ${error}`
      }
    }
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId: string): Promise<DownloadResult> {
    try {
      const accessToken = await this.authService.getValidAccessToken()

      const response = await requestUrl({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      return {
        success: true,
        data: response.arrayBuffer
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      return {
        success: false,
        error: `Download failed: ${error}`
      }
    }
  }

  /**
   * List files in Google Drive for a specific vault
   */
  async listFiles(vaultId: string): Promise<ListResult> {
    try {
      console.log('📋 Listing files from Google Drive...')
      console.log('  Vault ID:', vaultId)

      const accessToken = await this.authService.getValidAccessToken()

      // Get vault folder
      const vaultFolderId = await this.getOrCreateVaultFolder(vaultId)
      if (!vaultFolderId) {
        return {
          success: false,
          error: 'Failed to get vault folder'
        }
      }

      console.log('  📂 Vault folder ID:', vaultFolderId)

      // List all files (with pagination)
      const allFiles: DriveFile[] = []
      let pageToken: string | undefined = undefined
      let pageCount = 0

      do {
        pageCount++
        let url = `https://www.googleapis.com/drive/v3/files?q='${vaultFolderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'&fields=files(id,name,mimeType,modifiedTime,size,webContentLink,webViewLink),nextPageToken&pageSize=1000&orderBy=modifiedTime desc`

        if (pageToken) {
          url += `&pageToken=${pageToken}`
        }

        console.log(`  📄 Fetching page ${pageCount}...`)
        const response = await requestUrl({
          url,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        const files = response.json.files || []

        const pageFiles: DriveFile[] = files.map((file: any) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size || '0'),
          modifiedTime: file.modifiedTime,
          webContentLink: file.webContentLink,
          webViewLink: file.webViewLink
        }))

        allFiles.push(...pageFiles)
        console.log(`  ✓ Page ${pageCount}: ${pageFiles.length} file(s)`)

        pageToken = response.json.nextPageToken
      } while (pageToken)

      console.log(`  ✅ Total: ${allFiles.length} file(s) across ${pageCount} page(s)`)

      return {
        success: true,
        files: allFiles
      }
    } catch (error) {
      console.error('Error listing files:', error)
      return {
        success: false,
        error: `List files failed: ${error}`
      }
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId: string): Promise<DeleteResult> {
    try {
      const accessToken = await this.authService.getValidAccessToken()

      await requestUrl({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}`,
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      return {
        success: true
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      return {
        success: false,
        error: `Delete failed: ${error}`
      }
    }
  }

  /**
   * Get file metadata from Google Drive
   */
  async getFileMetadata(fileId: string): Promise<{ success: boolean; file?: DriveFile; error?: string }> {
    try {
      const accessToken = await this.authService.getValidAccessToken()

      const response = await requestUrl({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,webContentLink,webViewLink`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const file: DriveFile = {
        id: response.json.id,
        name: response.json.name,
        mimeType: response.json.mimeType,
        size: parseInt(response.json.size || '0'),
        modifiedTime: response.json.modifiedTime,
        webContentLink: response.json.webContentLink,
        webViewLink: response.json.webViewLink
      }

      return {
        success: true,
        file
      }
    } catch (error) {
      console.error('Error getting file metadata:', error)
      return {
        success: false,
        error: `Get metadata failed: ${error}`
      }
    }
  }
}

/**
 * Helper function to convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
