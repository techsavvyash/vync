export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  webContentLink?: string | null
  webViewLink?: string | null
}

export interface UploadResult {
  success: boolean
  fileId?: string
  error?: string
}

export interface DownloadResult {
  success: boolean
  data?: Buffer
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

export interface IDriveService {
  /**
   * Test if the drive service is properly configured and can connect
   */
  testConnection(): Promise<{ connected: boolean; message: string }>

  /**
   * Upload a file to the drive
   */
  uploadFile(
    fileName: string,
    fileData: Buffer,
    mimeType: string,
    folderId?: string
  ): Promise<UploadResult>

  /**
   * Download a file from the drive
   */
  downloadFile(fileId: string): Promise<DownloadResult>

  /**
   * List files in the drive (optionally filtered by folder)
   */
  listFiles(folderId?: string): Promise<ListResult>

  /**
   * Delete a file from the drive
   */
  deleteFile(fileId: string): Promise<DeleteResult>

  /**
   * Get file metadata
   */
  getFileMetadata(fileId: string): Promise<{ success: boolean; file?: DriveFile; error?: string }>

  /**
   * Check if service is authenticated/configured
   */
  isAuthenticated(): boolean

  /**
   * Get service type (for logging/debugging)
   */
  getServiceType(): string
}