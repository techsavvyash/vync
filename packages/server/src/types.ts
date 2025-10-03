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

// Delta sync types
export interface FileSyncState {
  path: string
  lastSyncedHash: string
  lastSyncedTime: number
  lastSyncedSize: number
  createdTime?: number
  extension?: string
  remoteFileId?: string
  remoteMtime?: number
  remoteHash?: string
  firstSyncedTime?: number
  syncCount?: number
  lastError?: string
  conflictCount?: number
}

export interface SyncDeltaRequest {
  vaultId: string
  localIndex: {
    files: Record<string, FileSyncState>
    folders?: Record<string, any>
  }
}

export interface DownloadCandidate {
  id: string
  filePath: string
  reason: 'missing_local' | 'remote_newer' | 'hash_mismatch'
  remoteMtime: number
  remoteSize: number
}

export interface UploadCandidate {
  filePath: string
  reason: 'missing_remote' | 'local_newer' | 'never_synced'
  localMtime: number
  localSize: number
}

export interface ConflictCandidate {
  filePath: string
  localMtime: number
  remoteMtime: number
  localHash: string
  remoteFileId: string
}

export interface SyncDelta {
  toDownload: DownloadCandidate[]
  toUpload: UploadCandidate[]
  conflicts: ConflictCandidate[]
  inSync: number
  totalRemote: number
  totalLocal: number
}

export interface SyncDeltaResponse extends SyncResponse {
  delta?: SyncDelta
}