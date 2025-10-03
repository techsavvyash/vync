import { google } from 'googleapis'
import { drive_v3 } from 'googleapis'
import { promises as fs } from 'fs'
import path from 'path'

export class GoogleDriveService {
  private drive: drive_v3.Drive | null = null
  private auth: any = null

  constructor() {
    this.initializeAuth()
  }

  private async initializeAuth() {
    try {
      // For now, we'll use service account authentication
      // In production, you might want to use OAuth2 for user-specific access
      const credentialsPath = path.join(process.cwd(), 'credentials.json')

      // Check if credentials file exists
      try {
        await fs.access(credentialsPath)
        const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'))

        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.file']
        })

        this.drive = google.drive({ version: 'v3', auth: this.auth })
        console.log('Google Drive authentication initialized')
      } catch (error) {
        console.warn('Google Drive credentials not found. Please set up credentials.json')
        console.warn('For development, you can use OAuth2 flow or service account')
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive auth:', error)
    }
  }

  public isAuthenticated(): boolean {
    return this.drive !== null
  }

  public async uploadFile(
    fileName: string,
    fileData: Buffer,
    mimeType: string,
    folderId?: string
  ): Promise<string | null> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated')
    }

    try {
      const fileMetadata: any = {
        name: fileName,
        mimeType: mimeType
      }

      if (folderId) {
        fileMetadata.parents = [folderId]
      }

      const media = {
        mimeType: mimeType,
        body: fileData
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
      })

      return response.data.id || null
    } catch (error) {
      console.error('Error uploading file to Google Drive:', error)
      return null
    }
  }

  public async downloadFile(fileId: string): Promise<Buffer | null> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated')
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' })

      return Buffer.from(response.data as ArrayBuffer)
    } catch (error) {
      console.error('Error downloading file from Google Drive:', error)
      return null
    }
  }

  public async listFiles(folderId?: string): Promise<any[]> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated')
    }

    try {
      const params: any = {
        fields: 'files(id, name, mimeType, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      }

      if (folderId) {
        params.q = `'${folderId}' in parents`
      }

      const response = await this.drive.files.list(params)

      return response.data.files || []
    } catch (error) {
      console.error('Error listing files from Google Drive:', error)
      return []
    }
  }

  public async deleteFile(fileId: string): Promise<boolean> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated')
    }

    try {
      await this.drive.files.delete({ fileId })
      return true
    } catch (error) {
      console.error('Error deleting file from Google Drive:', error)
      return false
    }
  }

  public async createFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated')
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

      return response.data.id || null
    } catch (error) {
      console.error('Error creating folder in Google Drive:', error)
      return null
    }
  }

  public async findFolder(folderPath: string, parentFolderId?: string): Promise<string | null> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated')
    }

    try {
      // Split the path and find/create folders recursively
      const parts = folderPath.split('/').filter(p => p)

      if (parts.length === 0) {
        return parentFolderId || null
      }

      const folderName = parts[0]
      const remainingPath = parts.slice(1).join('/')

      // Search for existing folder
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      })

      let folderId: string | null = null

      if (response.data.files && response.data.files.length > 0) {
        // Folder exists
        folderId = response.data.files[0].id || null
      } else {
        // Create the folder
        folderId = await this.createFolder(folderName, parentFolderId)
      }

      // If there's more path to process, continue recursively
      if (folderId && remainingPath) {
        return await this.findFolder(remainingPath, folderId)
      }

      return folderId
    } catch (error) {
      console.error('Error finding/creating folder in Google Drive:', error)
      return null
    }
  }

  public async ensureFolderPath(folderPath: string): Promise<string | null> {
    // This method ensures the entire folder path exists, creating folders as needed
    return await this.findFolder(folderPath)
  }
}