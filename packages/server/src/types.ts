export interface SyncFile {
  id: string
  vaultId: string
  filePath: string
  lastModified: number
  size: number
  hash?: string
}

export interface SyncMetadata {
  vaultId: string
  files: SyncFile[]
  lastSync: number
}

export interface UploadRequest {
  vaultId: string
  filePath: string
  fileData: ArrayBuffer
  lastModified: number
}

export interface ConflictInfo {
  fileId: string
  localVersion: SyncFile
  remoteVersion: SyncFile
  timestamp: number
}

export interface SyncResponse {
  success: boolean
  message: string
  data?: any
}