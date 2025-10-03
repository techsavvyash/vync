// @ts-nocheck
import { google } from 'googleapis'
import { drive_v3 } from 'googleapis'
import { promises as fs } from 'fs'
import path from 'path'
import { Readable } from 'stream'
import {
  IDriveService,
  DriveFile,
  UploadResult,
  DownloadResult,
  ListResult,
  DeleteResult
} from './IDriveService'

export class GoogleDriveService implements IDriveService {
  private drive: drive_v3.Drive | null = null
  private auth: any = null
  private vaultFolderCache: Map<string, string> = new Map() // vaultId -> folderId
  private oauth2Client: any = null

  constructor() {
    this.initializeAuth()
  }

  /**
   * Get OAuth2 client for user authentication
   * @param redirectUri Optional redirect URI (auto-detected from request if not provided)
   */
  public getOAuth2Client(redirectUri?: string) {
    // Always recreate if redirectUri is provided (for dynamic URLs)
    if (redirectUri && this.oauth2Client) {
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        console.warn('OAuth2 credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
        return null
      }

      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      return this.oauth2Client
    }

    if (!this.oauth2Client) {
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      // Use environment variable or default to localhost for development
      const defaultRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'

      if (!clientId || !clientSecret) {
        console.warn('OAuth2 credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
        return null
      }

      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri || defaultRedirectUri)
    }
    return this.oauth2Client
  }

  /**
   * Generate OAuth2 authorization URL
   * @param redirectUri Optional redirect URI for dynamic URL generation
   */
  public getAuthUrl(redirectUri?: string): string {
    const oauth2Client = this.getOAuth2Client(redirectUri)
    if (!oauth2Client) {
      throw new Error('OAuth2 not configured')
    }

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    })
  }

  /**
   * Set OAuth2 tokens from authorization code
   */
  public async setOAuthTokens(code: string): Promise<void> {
    const oauth2Client = this.getOAuth2Client()
    if (!oauth2Client) {
      throw new Error('OAuth2 not configured')
    }

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Initialize drive with OAuth client
    this.drive = google.drive({ version: 'v3', auth: oauth2Client })
    this.auth = oauth2Client

    console.log('OAuth2 tokens set successfully')
  }

  /**
   * Load OAuth2 tokens from storage
   */
  public async loadOAuthTokens(tokens: any): Promise<void> {
    const oauth2Client = this.getOAuth2Client()
    if (!oauth2Client) {
      throw new Error('OAuth2 not configured')
    }

    oauth2Client.setCredentials(tokens)
    this.drive = google.drive({ version: 'v3', auth: oauth2Client })
    this.auth = oauth2Client

    console.log('OAuth2 tokens loaded from storage')
  }

  /**
   * Get current OAuth tokens (for storage)
   */
  public getOAuthTokens(): any {
    return this.oauth2Client?.credentials || null
  }

  /**
   * Set access token directly from Authorization header (for per-request auth)
   * This allows using tokens from plugin without storing them on server
   * No CLIENT_ID/CLIENT_SECRET needed - just uses the access token directly
   */
  public setAccessToken(accessToken: string): void {
    // Create a minimal OAuth2 client just to hold the access token
    // We don't need CLIENT_ID/CLIENT_SECRET since the token is already valid
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: accessToken
    })

    this.drive = google.drive({ version: 'v3', auth: oauth2Client })
    this.auth = oauth2Client
  }

  private async getOrCreateVaultFolder(vaultId: string): Promise<string | null> {
    if (!this.drive) {
      console.error('  ❌ Drive not initialized')
      return null
    }

    console.log('  📁 Getting/creating vault folder...')
    console.log('    Vault ID:', vaultId)

    // Check cache first
    if (this.vaultFolderCache.has(vaultId)) {
      const cachedId = this.vaultFolderCache.get(vaultId)!
      console.log('    ✓ Found in cache:', cachedId)
      return cachedId
    }

    try {
      // Search for existing vault folder
      const folderName = `vault_${vaultId}`
      console.log('    Searching for folder:', folderName)

      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      })

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id!
        console.log('    ✓ Found existing folder:', folderId)
        console.log('    Folder name:', response.data.files[0].name)

        // If there are duplicate folders, delete the extras
        if (response.data.files.length > 1) {
          console.log('    🗑️  Found', response.data.files.length - 1, 'duplicate folder(s), deleting...')
          for (let i = 1; i < response.data.files.length; i++) {
            try {
              await this.drive.files.delete({ fileId: response.data.files[i].id! })
              console.log('    ✓ Deleted duplicate folder:', response.data.files[i].id)
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
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      }

      const folder = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      })

      const folderId = folder.data.id!
      console.log('    ✓ Created new folder:', folderId)
      this.vaultFolderCache.set(vaultId, folderId)
      return folderId
    } catch (error) {
      console.error('    ❌ Error getting/creating vault folder for', vaultId)
      console.error('    Error details:', error)
      return null
    }
  }

  private async initializeAuth() {
    try {
      // Try OAuth2 first (preferred for user authentication)
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        console.log('OAuth2 credentials configured - waiting for user authentication')
        console.log('Visit /auth/google to authenticate')

        // Try to load saved tokens
        const tokensPath = path.join(process.cwd(), 'oauth-tokens.json')
        try {
          await fs.access(tokensPath)
          const tokens = JSON.parse(await fs.readFile(tokensPath, 'utf8'))
          await this.loadOAuthTokens(tokens)
          console.log('✅ Google Drive OAuth2 authenticated from saved tokens')
          return
        } catch (error) {
          console.log('No saved OAuth tokens found - user needs to authenticate')
        }
        return
      }

      // Fallback to service account (limited - no storage quota)
      const credentialsPath = path.join(process.cwd(), 'credentials.json')

      try {
        await fs.access(credentialsPath)
        const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'))

        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.file']
        })

        this.drive = google.drive({ version: 'v3', auth: this.auth })
        console.log('⚠️  Google Drive service account initialized (limited storage)')
        console.log('   Consider using OAuth2 for full access')
      } catch (error) {
        console.warn('Google Drive credentials not found')
        console.warn('Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET for OAuth2')
        console.warn('Or provide credentials.json for service account')
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive auth:', error)
    }
  }

  public isAuthenticated(): boolean {
    return this.drive !== null
  }

  public getServiceType(): string {
    return 'Google Drive'
  }

  public async testConnection(): Promise<{ connected: boolean; message: string }> {
    if (!this.drive) {
      return {
        connected: false,
        message: 'Google Drive not authenticated. Please set up credentials.json'
      }
    }

    try {
      // Try to list files to test connection
      await this.drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)'
      })

      return {
        connected: true,
        message: 'Google Drive connection successful'
      }
    } catch (error) {
      return {
        connected: false,
        message: `Google Drive connection failed: ${error}`
      }
    }
  }

  public async uploadFile(
    filePath: string,
    fileData: Buffer,
    mimeType: string,
    vaultId?: string
  ): Promise<UploadResult> {
    console.log('  🔵 GoogleDriveService.uploadFile() called')
    console.log('    File path:', filePath)
    console.log('    MIME type:', mimeType)
    console.log('    Vault ID:', vaultId)
    console.log('    Data size:', fileData.length, 'bytes')

    if (!this.drive) {
      console.error('    ❌ Drive not authenticated')
      return {
        success: false,
        error: 'Google Drive not authenticated'
      }
    }

    if (!vaultId) {
      console.error('    ❌ Vault ID missing')
      return {
        success: false,
        error: 'Vault ID is required for upload'
      }
    }

    try {
      // Get or create vault-specific folder
      const vaultFolderId = await this.getOrCreateVaultFolder(vaultId)
      if (!vaultFolderId) {
        console.error('    ❌ Failed to get vault folder')
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

      // Check if file already exists in this folder
      console.log('    🔍 Checking for existing file...')
      const existingFileResponse = await this.drive.files.list({
        q: `name='${fileName}' and '${targetFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      })

      const existingFiles = existingFileResponse.data.files || []
      console.log('    Found', existingFiles.length, 'existing file(s)')

      // Convert Buffer to Stream for Google Drive API
      console.log('    🔄 Converting Buffer to Stream...')
      const stream = Readable.from(fileData)

      const media = {
        mimeType: mimeType,
        body: stream
      }

      let response: any

      if (existingFiles.length > 0) {
        // Update existing file
        const existingFileId = existingFiles[0].id!
        console.log('    ♻️  Updating existing file:', existingFileId)

        // If there are multiple duplicates, delete the extras
        if (existingFiles.length > 1) {
          console.log('    🗑️  Deleting', existingFiles.length - 1, 'duplicate(s)...')
          for (let i = 1; i < existingFiles.length; i++) {
            try {
              await this.drive.files.delete({ fileId: existingFiles[i].id! })
              console.log('    ✓ Deleted duplicate:', existingFiles[i].id)
            } catch (err) {
              console.warn('    ⚠️  Failed to delete duplicate:', err)
            }
          }
        }

        response = await this.drive.files.update({
          fileId: existingFileId,
          media: media,
          fields: 'id, name, parents, webViewLink'
        })

        console.log('    ✅ File UPDATED')
      } else {
        // Create new file
        console.log('    ➕ Creating new file...')
        const fileMetadata: any = {
          name: fileName,
          mimeType: mimeType,
          parents: [targetFolderId]
        }

        response = await this.drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, parents, webViewLink'
        })

        console.log('    ✅ File CREATED')
      }

      console.log('    File ID:', response.data.id)
      console.log('    File name:', response.data.name)
      console.log('    Parents:', response.data.parents)
      console.log('    View link:', response.data.webViewLink)

      return {
        success: true,
        fileId: response.data.id
      }
    } catch (error) {
      console.error('    ❌ Error uploading file to Google Drive')
      console.error('    Error type:', error?.constructor?.name)
      console.error('    Error message:', error?.message || error)
      console.error('    Full error:', JSON.stringify(error, null, 2))
      return {
        success: false,
        error: `Upload failed: ${error}`
      }
    }
  }

  public async downloadFile(fileId: string): Promise<DownloadResult> {
    if (!this.drive) {
      return {
        success: false,
        error: 'Google Drive not authenticated'
      }
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' })

      return {
        success: true,
        data: Buffer.from(response.data as ArrayBuffer)
      }
    } catch (error) {
      console.error('Error downloading file from Google Drive:', error)
      return {
        success: false,
        error: `Download failed: ${error}`
      }
    }
  }

  public async listFiles(vaultId?: string): Promise<ListResult> {
    if (!this.drive) {
      return {
        success: false,
        error: 'Google Drive not authenticated'
      }
    }

    try {
      console.log('📋 Listing files from Google Drive...')
      if (vaultId) {
        console.log('  Vault ID:', vaultId)
      }

      const params: any = {
        fields: 'files(id, name, mimeType, modifiedTime, size, webContentLink, webViewLink), nextPageToken',
        orderBy: 'modifiedTime desc',
        pageSize: 1000 // Max allowed by Google Drive API
      }

      if (vaultId) {
        // Get vault folder and list files within it
        const vaultFolderId = await this.getOrCreateVaultFolder(vaultId)
        if (!vaultFolderId) {
          return {
            success: false,
            error: 'Failed to get vault folder'
          }
        }
        // Exclude folders - only get actual files
        params.q = `'${vaultFolderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`
        console.log('  📂 Vault folder ID:', vaultFolderId)
        console.log('  🔍 Query:', params.q)
      } else {
        // List all files (for admin purposes) - also exclude folders
        params.q = `trashed=false and mimeType != 'application/vnd.google-apps.folder'`
        console.log('  🔍 Query:', params.q)
      }

      // Fetch all pages of results
      const allFiles: DriveFile[] = []
      let pageToken: string | undefined = undefined
      let pageCount = 0

      do {
        pageCount++
        if (pageToken) {
          params.pageToken = pageToken
        }

        console.log(`  📄 Fetching page ${pageCount}...`)
        const response = await this.drive.files.list(params)

        // Debug: Log ALL files/folders returned by Drive API before filtering
        console.log(`  🔍 DEBUG: Raw response from Drive API (page ${pageCount}):`)
        if (response.data.files && response.data.files.length > 0) {
          response.data.files.forEach(file => {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
            console.log(`    ${isFolder ? '📁' : '📄'} ${file.name} (${file.mimeType})`)
          })
        } else {
          console.log('    (no files returned)')
        }

        const pageFiles = (response.data.files || []).map(file => ({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          size: parseInt(file.size || '0'),
          modifiedTime: file.modifiedTime!,
          webContentLink: file.webContentLink as any,
          webViewLink: file.webViewLink as any
        }))

        allFiles.push(...pageFiles)
        console.log(`  ✓ Page ${pageCount}: ${pageFiles.length} file(s)`)

        // Log first few files for debugging
        if (pageCount === 1 && pageFiles.length > 0) {
          console.log('  📄 Sample files from first page:')
          pageFiles.slice(0, 5).forEach(file => {
            console.log(`    - ${file.name}`)
          })
          if (pageFiles.length > 5) {
            console.log(`    ... and ${pageFiles.length - 5} more`)
          }
        }

        pageToken = response.data.nextPageToken as string | undefined
      } while (pageToken)

      console.log(`  ✅ Total: ${allFiles.length} file(s) across ${pageCount} page(s)`)

      if (vaultId && allFiles.length > 0) {
        console.log(`  ℹ️  These files are inside vault folder: vault_${vaultId}`)
      }

      return {
        success: true,
        files: allFiles
      }
    } catch (error) {
      console.error('Error listing files from Google Drive:', error)
      return {
        success: false,
        error: `List files failed: ${error}`
      }
    }
  }

  public async deleteFile(fileId: string): Promise<DeleteResult> {
    if (!this.drive) {
      return {
        success: false,
        error: 'Google Drive not authenticated'
      }
    }

    try {
      await this.drive.files.delete({ fileId })
      return {
        success: true
      }
    } catch (error) {
      console.error('Error deleting file from Google Drive:', error)
      return {
        success: false,
        error: `Delete failed: ${error}`
      }
    }
  }

  public async getFileMetadata(fileId: string): Promise<{ success: boolean; file?: DriveFile; error?: string }> {
    if (!this.drive) {
      return {
        success: false,
        error: 'Google Drive not authenticated'
      }
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, modifiedTime, size, webContentLink, webViewLink'
      })

      const file: DriveFile = {
        id: response.data.id!,
        name: response.data.name!,
        mimeType: response.data.mimeType!,
        size: parseInt(response.data.size || '0'),
        modifiedTime: response.data.modifiedTime!,
        webContentLink: response.data.webContentLink as any,
        webViewLink: response.data.webViewLink as any
      }

      return {
        success: true,
        file
      }
    } catch (error) {
      console.error('Error getting file metadata from Google Drive:', error)
      return {
        success: false,
        error: `Get metadata failed: ${error}`
      }
    }
  }

  private async createFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    if (!this.drive) {
      return null
    }

    try {
      const fileMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      }

      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId]
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      })

      console.log(`    📁 Created folder: ${folderName} (ID: ${response.data.id})`)
      return response.data.id || null
    } catch (error) {
      console.error('Error creating folder in Google Drive:', error)
      return null
    }
  }

  private async ensureFolderPath(folderPath: string, parentFolderId: string): Promise<string | null> {
    if (!this.drive || !folderPath) {
      return parentFolderId
    }

    try {
      // Split the path and create folders recursively
      const parts = folderPath.split('/').filter(p => p)

      if (parts.length === 0) {
        return parentFolderId
      }

      let currentParentId = parentFolderId

      for (const folderName of parts) {
        // Search for existing folder
        const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`

        const response = await this.drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive'
        })

        let folderId: string | null = null

        if (response.data.files && response.data.files.length > 0) {
          // Folder exists
          folderId = response.data.files[0].id || null
          console.log(`    📁 Found existing folder: ${folderName} (ID: ${folderId})`)
        } else {
          // Create the folder
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
      console.error('Error ensuring folder path in Google Drive:', error)
      return null
    }
  }
}