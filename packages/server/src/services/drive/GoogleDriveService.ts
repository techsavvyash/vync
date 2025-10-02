// @ts-nocheck
import { google } from 'googleapis'
import { drive_v3 } from 'googleapis'
import { promises as fs } from 'fs'
import path from 'path'
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

  constructor() {
    this.initializeAuth()
  }

  private async initializeAuth() {
    try {
      const credentialsPath = path.join(process.cwd(), 'credentials.json')

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
    fileName: string,
    fileData: Buffer,
    mimeType: string,
    folderId?: string
  ): Promise<UploadResult> {
    if (!this.drive) {
      return {
        success: false,
        error: 'Google Drive not authenticated'
      }
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

      return {
        success: true,
        fileId: response.data.id
      }
    } catch (error) {
      console.error('Error uploading file to Google Drive:', error)
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

  public async listFiles(folderId?: string): Promise<ListResult> {
    if (!this.drive) {
      return {
        success: false,
        error: 'Google Drive not authenticated'
      }
    }

    try {
      const params: any = {
        fields: 'files(id, name, mimeType, modifiedTime, size, webContentLink, webViewLink)',
        orderBy: 'modifiedTime desc'
      }

      if (folderId) {
        params.q = `'${folderId}' in parents`
      }

      const response = await this.drive.files.list(params)

      const files: DriveFile[] = (response.data.files || []).map(file => ({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: parseInt(file.size || '0'),
        modifiedTime: file.modifiedTime!,
        webContentLink: file.webContentLink as any,
        webViewLink: file.webViewLink as any
      }))

      return {
        success: true,
        files
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
}