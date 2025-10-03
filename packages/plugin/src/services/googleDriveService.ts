import { requestUrl } from 'obsidian'
import { GoogleDriveAuthService } from './googleDriveAuth'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  headRevisionId?: string // Authoritative version identifier
  appProperties?: Record<string, string> // Custom metadata for sync logic
  webContentLink?: string
  webViewLink?: string
}

export interface UploadResult {
  success: boolean
  fileId?: string
  headRevisionId?: string
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
    vaultId: string,
    appProperties?: Record<string, string>
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
      let headRevisionId: string | undefined

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

        const fileMetadata: any = { mimeType }
        if (appProperties) {
          fileMetadata.appProperties = appProperties
        }

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(fileMetadata) +
          delimiter +
          'Content-Type: ' + mimeType + '\r\n' +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64Data +
          closeDelimiter

        const updateResponse = await requestUrl({
          url: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,headRevisionId`,
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        })

        console.log('    ✅ File UPDATED')
        headRevisionId = updateResponse.json.headRevisionId
      } else {
        // Create new file
        console.log('    ➕ Creating new file...')

        const boundary = '-------314159265358979323846'
        const delimiter = `\r\n--${boundary}\r\n`
        const closeDelimiter = `\r\n--${boundary}--`

        const base64Data = arrayBufferToBase64(fileData)

        const metadata: any = {
          name: fileName,
          mimeType: mimeType,
          parents: [targetFolderId]
        }

        if (appProperties) {
          metadata.appProperties = appProperties
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
          url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,headRevisionId',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        })

        fileId = createResponse.json.id
        headRevisionId = createResponse.json.headRevisionId
        console.log('    ✅ File CREATED')
      }

      console.log('    File ID:', fileId)
      console.log('    Head Revision ID:', headRevisionId)
      return {
        success: true,
        fileId,
        headRevisionId
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
        let url = `https://www.googleapis.com/drive/v3/files?q='${vaultFolderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'&fields=files(id,name,mimeType,modifiedTime,size,headRevisionId,appProperties,webContentLink,webViewLink),nextPageToken&pageSize=1000&orderBy=modifiedTime desc`

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
          headRevisionId: file.headRevisionId,
          appProperties: file.appProperties,
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
   * Get start page token for changes.list API
   * This represents the current state of the Drive and is used for incremental sync
   */
  async getStartPageToken(): Promise<{ success: boolean; pageToken?: string; error?: string }> {
    try {
      const accessToken = await this.authService.getValidAccessToken()

      const response = await requestUrl({
        url: 'https://www.googleapis.com/drive/v3/changes/startPageToken',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      return {
        success: true,
        pageToken: response.json.startPageToken
      }
    } catch (error) {
      console.error('Error getting start page token:', error)
      return {
        success: false,
        error: `Failed to get start page token: ${error}`
      }
    }
  }

  /**
   * Get changes since the given page token
   * This is more efficient than listing all files
   */
  async getChanges(pageToken: string, vaultId: string): Promise<{
    success: boolean
    changes?: Array<{ fileId: string; file?: DriveFile; removed?: boolean }>
    newPageToken?: string
    error?: string
  }> {
    try {
      console.log('📥 Fetching changes from Google Drive...')
      console.log('  Page token:', pageToken)

      const accessToken = await this.authService.getValidAccessToken()

      // Get vault folder to filter changes
      const vaultFolderId = await this.getOrCreateVaultFolder(vaultId)
      if (!vaultFolderId) {
        return {
          success: false,
          error: 'Failed to get vault folder'
        }
      }

      const changes: Array<{ fileId: string; file?: DriveFile; removed?: boolean }> = []
      let currentPageToken = pageToken
      let hasMore = true

      while (hasMore) {
        const response = await requestUrl({
          url: `https://www.googleapis.com/drive/v3/changes?pageToken=${currentPageToken}&fields=changes(fileId,removed,file(id,name,mimeType,modifiedTime,size,headRevisionId,appProperties,parents)),newStartPageToken,nextPageToken&pageSize=1000`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        const responseChanges = response.json.changes || []
        console.log(`  Found ${responseChanges.length} change(s) in this page`)

        // Filter changes to only include files in our vault folder
        for (const change of responseChanges) {
          // Check if file is removed or if it's in our vault folder
          if (change.removed) {
            changes.push({
              fileId: change.fileId,
              removed: true
            })
          } else if (change.file && change.file.parents && change.file.parents.includes(vaultFolderId)) {
            // Only include files, not folders
            if (change.file.mimeType !== 'application/vnd.google-apps.folder') {
              changes.push({
                fileId: change.fileId,
                file: {
                  id: change.file.id,
                  name: change.file.name,
                  mimeType: change.file.mimeType,
                  size: parseInt(change.file.size || '0'),
                  modifiedTime: change.file.modifiedTime,
                  headRevisionId: change.file.headRevisionId,
                  appProperties: change.file.appProperties
                }
              })
            }
          }
        }

        // Check if there are more pages
        if (response.json.nextPageToken) {
          currentPageToken = response.json.nextPageToken
        } else {
          hasMore = false
          currentPageToken = response.json.newStartPageToken
        }
      }

      console.log(`  ✅ Total changes affecting vault: ${changes.length}`)

      return {
        success: true,
        changes,
        newPageToken: currentPageToken
      }
    } catch (error) {
      console.error('Error getting changes:', error)
      return {
        success: false,
        error: `Failed to get changes: ${error}`
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
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,headRevisionId,appProperties,webContentLink,webViewLink`,
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
        headRevisionId: response.json.headRevisionId,
        appProperties: response.json.appProperties,
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
