import { Elysia } from 'elysia'
import type {
  SyncResponse,
  SyncMetadata,
  SyncDeltaRequest,
  SyncDeltaResponse,
  SyncDelta,
  DownloadCandidate,
  UploadCandidate,
  ConflictCandidate,
  FileSyncState
} from '../types'
import { DriveServiceFactory } from '../services/drive/DriveServiceFactory'

export const syncRoutes = new Elysia({ prefix: '/sync' })
  .get('/', () => 'Sync API is ready')
  .post('/upload', async ({ body, store }) => {
    try {
      console.log('\n📤 ========== UPLOAD REQUEST ==========')
      const uploadData = body as any
      console.log('  Vault ID:', uploadData.vaultId)
      console.log('  File Path:', uploadData.filePath)
      console.log('  File Data Length:', uploadData.fileData?.length || 0, 'chars')
      console.log('  Last Modified:', uploadData.lastModified)

      // Get the configured drive service from state or factory
      const driveService = (store as any)?.driveService || DriveServiceFactory.getDriveService()
      console.log('  Drive Service:', driveService.getServiceType())
      console.log('  Authenticated:', driveService.isAuthenticated())

      if (!driveService.isAuthenticated()) {
        console.error('❌ UPLOAD FAILED: Not authenticated')
        return {
          success: false,
          message: `${driveService.getServiceType()} not available. Please check configuration.`
        } as SyncResponse
      }

      if (!uploadData.fileData || !uploadData.filePath || !uploadData.vaultId) {
        console.error('❌ UPLOAD FAILED: Missing required fields')
        console.error('  Has fileData:', !!uploadData.fileData)
        console.error('  Has filePath:', !!uploadData.filePath)
        console.error('  Has vaultId:', !!uploadData.vaultId)
        return {
          success: false,
          message: 'Missing required fields: fileData, filePath, vaultId'
        } as SyncResponse
      }

      // Convert base64 or ArrayBuffer to Buffer
      let fileBuffer: Buffer
      console.log('  Converting file data...')
      console.log('  Data type:', typeof uploadData.fileData)

      if (typeof uploadData.fileData === 'string') {
        // Assume base64 encoded
        fileBuffer = Buffer.from(uploadData.fileData, 'base64')
        console.log('  ✓ Decoded from base64')
        console.log('  Buffer size:', fileBuffer.length, 'bytes')
      } else if (uploadData.fileData instanceof ArrayBuffer) {
        fileBuffer = Buffer.from(uploadData.fileData)
        console.log('  ✓ Converted from ArrayBuffer')
        console.log('  Buffer size:', fileBuffer.length, 'bytes')
      } else {
        console.error('❌ Invalid fileData format:', typeof uploadData.fileData)
        return {
          success: false,
          message: 'Invalid fileData format'
        } as SyncResponse
      }

      // Determine MIME type based on file extension
      const fileExtension = uploadData.filePath.split('.').pop()?.toLowerCase() || ''
      const mimeType = getMimeType(fileExtension)
      console.log('  File Extension:', fileExtension)
      console.log('  MIME Type:', mimeType)

      console.log('  🚀 Uploading to Google Drive...')
      const uploadResult = await driveService.uploadFile(
        uploadData.filePath,
        fileBuffer,
        mimeType,
        uploadData.vaultId // Pass vaultId as 4th parameter
      )

      if (uploadResult.success) {
        console.log('  ✅ UPLOAD SUCCESS')
        console.log('  File ID:', uploadResult.fileId)
        console.log('  Vault ID:', uploadData.vaultId)
        console.log('=====================================\n')
        return {
          success: true,
          message: 'File uploaded successfully',
          data: { fileId: uploadResult.fileId, vaultId: uploadData.vaultId }
        } as SyncResponse
      } else {
        console.error('  ❌ UPLOAD FAILED')
        console.error('  Error:', uploadResult.error)
        console.log('=====================================\n')
        return {
          success: false,
          message: `Failed to upload file: ${uploadResult.error}`
        } as SyncResponse
      }
    } catch (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        message: 'Internal server error during upload'
      } as SyncResponse
    }
  })
  .get('/download/:fileId', async ({ params, store }) => {
    try {
      console.log('\n📥 ========== DOWNLOAD REQUEST ==========')
      console.log('  File ID:', params.fileId)

      const driveService = (store as any)?.driveService || DriveServiceFactory.getDriveService()
      console.log('  Drive Service:', driveService.getServiceType())

      if (!driveService.isAuthenticated()) {
        console.error('  ❌ DOWNLOAD FAILED: Not authenticated')
        console.log('========================================\n')
        return {
          success: false,
          message: `${driveService.getServiceType()} not available`
        } as SyncResponse
      }

      // Get file metadata to show filename
      console.log('  📋 Fetching file metadata...')
      const metadataResult = await driveService.getFileMetadata(params.fileId)

      if (metadataResult.success && metadataResult.file) {
        console.log('  📄 File name:', metadataResult.file.name)
      }

      console.log('  🔍 Fetching file content from drive...')
      const downloadResult = await driveService.downloadFile(params.fileId)

      if (downloadResult.success && downloadResult.data) {
        const fileSize = downloadResult.data.length
        console.log('  ✅ DOWNLOAD SUCCESS')
        if (metadataResult.success && metadataResult.file) {
          console.log('  File name:', metadataResult.file.name)
        }
        console.log('  File Size:', fileSize, 'bytes')
        console.log('  Note: This file exists in drive but may not exist locally yet')
        console.log('  → Client will create/update local file after receiving this')
        console.log('========================================\n')
        return {
          success: true,
          message: 'File downloaded successfully',
          data: { fileId: params.fileId, fileData: downloadResult.data.toString('base64') }
        } as SyncResponse
      } else {
        console.error('  ❌ DOWNLOAD FAILED')
        console.error('  Error:', downloadResult.error || 'File not found')
        console.log('========================================\n')
        return {
          success: false,
          message: downloadResult.error || 'File not found'
        } as SyncResponse
      }
    } catch (error) {
      console.error('Download error:', error)
      console.log('========================================\n')
      return {
        success: false,
        message: 'Internal server error during download'
      } as SyncResponse
    }
  })
  .get('/metadata/:vaultId', async ({ params, store }) => {
    try {
      console.log('\n📋 ========== METADATA REQUEST ==========')
      console.log('  Vault ID:', params.vaultId)

      const driveService = (store as any)?.driveService || DriveServiceFactory.getDriveService()

      if (!driveService.isAuthenticated()) {
        console.error('  ❌ Not authenticated')
        return {
          success: false,
          message: `${driveService.getServiceType()} not available`
        } as SyncResponse
      }

      // List files for specific vault only
      console.log('  Fetching files from Google Drive...')
      const listResult = await driveService.listFiles(params.vaultId)

      if (listResult.success) {
        console.log('  ✅ Found', listResult.files!.length, 'file(s)')
        listResult.files!.forEach(file => {
          console.log('    -', file.name, `(${file.size} bytes)`)
        })

        const metadata: SyncMetadata = {
          vaultId: params.vaultId,
          files: listResult.files!.map((file) => ({
            id: file.id,
            vaultId: params.vaultId,
            filePath: file.name,
            lastModified: new Date(file.modifiedTime).getTime(),
            size: file.size,
            hash: undefined // Drive services may not provide hash
          })),
          lastSync: Date.now()
        }

        console.log('  Returning', metadata.files.length, 'file(s) to client')
        console.log('=========================================\n')

        return metadata
      } else {
        console.error('  ❌ Failed to list files:', listResult.error)
        console.log('=========================================\n')
        return {
          success: false,
          message: `Failed to list files: ${listResult.error}`
        } as SyncResponse
      }
    } catch (error) {
      console.error('Metadata error:', error)
      console.log('=========================================\n')
      return {
        success: false,
        message: 'Internal server error retrieving metadata'
      } as SyncResponse
    }
  })
  .post('/delta', async ({ body, store }) => {
    try {
      console.log('\n🔄 ========== DELTA CALCULATION ==========')
      const deltaRequest = body as SyncDeltaRequest
      console.log('  Vault ID:', deltaRequest.vaultId)
      console.log('  Local files count:', Object.keys(deltaRequest.localIndex.files).length)

      const driveService = (store as any)?.driveService || DriveServiceFactory.getDriveService()

      if (!driveService.isAuthenticated()) {
        console.error('  ❌ Not authenticated')
        console.log('=========================================\n')
        return {
          success: false,
          message: `${driveService.getServiceType()} not available`
        } as SyncDeltaResponse
      }

      // Fetch all files from Google Drive
      console.log('  📥 Fetching remote files from drive...')
      const listResult = await driveService.listFiles(deltaRequest.vaultId)

      if (!listResult.success) {
        console.error('  ❌ Failed to list files:', listResult.error)
        console.log('=========================================\n')
        return {
          success: false,
          message: `Failed to list files: ${listResult.error}`
        } as SyncDeltaResponse
      }

      const remoteFiles = listResult.files || []
      console.log('  ✅ Remote files:', remoteFiles.length)

      // Build maps for efficient lookup
      const localFilesMap = new Map<string, FileSyncState>(
        Object.entries(deltaRequest.localIndex.files)
      )
      const remoteFilesMap = new Map<string, typeof remoteFiles[0]>()

      for (const file of remoteFiles) {
        remoteFilesMap.set(file.name, file)
      }

      // Calculate delta
      const toDownload: DownloadCandidate[] = []
      const toUpload: UploadCandidate[] = []
      const conflicts: ConflictCandidate[] = []
      let inSync = 0

      console.log('\n  🔍 Analyzing differences...')

      // Check each remote file
      for (const remoteFile of remoteFiles) {
        const filePath = remoteFile.name
        const localFile = localFilesMap.get(filePath)
        const remoteMtime = new Date(remoteFile.modifiedTime).getTime()

        if (!localFile) {
          // File exists in Drive but not in local index
          console.log(`  📥 Missing local: ${filePath}`)
          toDownload.push({
            id: remoteFile.id,
            filePath,
            reason: 'missing_local',
            remoteMtime,
            remoteSize: remoteFile.size
          })
        } else {
          // File exists in both - check if sync needed
          const localMtime = localFile.lastSyncedTime

          // Check if this is the same file (by remote ID)
          if (localFile.remoteFileId === remoteFile.id) {
            // Same file - check modification times
            if (remoteMtime > localMtime) {
              // Check if local also changed since last sync
              const localChanged = localFile.lastSyncedHash !== localFile.lastSyncedHash // This needs actual current hash from client

              if (localChanged && remoteMtime > localFile.lastSyncedTime) {
                // Both changed - conflict!
                console.log(`  ⚠️  Conflict: ${filePath} (both changed)`)
                conflicts.push({
                  filePath,
                  localMtime: localFile.lastSyncedTime,
                  remoteMtime,
                  localHash: localFile.lastSyncedHash,
                  remoteFileId: remoteFile.id
                })
              } else {
                // Only remote changed
                console.log(`  📥 Remote newer: ${filePath}`)
                toDownload.push({
                  id: remoteFile.id,
                  filePath,
                  reason: 'remote_newer',
                  remoteMtime,
                  remoteSize: remoteFile.size
                })
              }
            } else if (localMtime > remoteMtime) {
              // Local is newer - should upload
              console.log(`  📤 Local newer: ${filePath}`)
              toUpload.push({
                filePath,
                reason: 'local_newer',
                localMtime,
                localSize: localFile.lastSyncedSize
              })
            } else {
              // Same mtime - in sync
              inSync++
            }
          } else {
            // Different file ID or no remote ID - check timestamps
            if (remoteMtime > localMtime) {
              console.log(`  📥 Remote newer (different ID): ${filePath}`)
              toDownload.push({
                id: remoteFile.id,
                filePath,
                reason: 'remote_newer',
                remoteMtime,
                remoteSize: remoteFile.size
              })
            } else {
              inSync++
            }
          }
        }
      }

      // Check for local files not in remote
      for (const [filePath, localFile] of localFilesMap.entries()) {
        const remoteFile = remoteFilesMap.get(filePath)

        if (!remoteFile) {
          // File exists locally but not in Drive

          // Skip if this is a remote-only tracking entry (never actually synced locally)
          // These entries have lastSyncedTime: 0 and were created by updateRemoteFileInfo
          if (localFile.lastSyncedTime === 0 && localFile.lastSyncedHash === '') {
            console.log(`  ⏭️  Skipping remote-only tracking entry: ${filePath}`)
            continue
          }

          if (!localFile.remoteFileId) {
            // Never synced before
            console.log(`  📤 New local file: ${filePath}`)
            toUpload.push({
              filePath,
              reason: 'never_synced',
              localMtime: localFile.lastSyncedTime,
              localSize: localFile.lastSyncedSize
            })
          } else {
            // Was synced but deleted from remote
            console.log(`  📤 Missing remote (was synced): ${filePath}`)
            toUpload.push({
              filePath,
              reason: 'missing_remote',
              localMtime: localFile.lastSyncedTime,
              localSize: localFile.lastSyncedSize
            })
          }
        }
      }

      const delta: SyncDelta = {
        toDownload,
        toUpload,
        conflicts,
        inSync,
        totalRemote: remoteFiles.length,
        totalLocal: localFilesMap.size
      }

      console.log('\n  📊 Delta Summary:')
      console.log(`    To Download: ${toDownload.length}`)
      console.log(`    To Upload: ${toUpload.length}`)
      console.log(`    Conflicts: ${conflicts.length}`)
      console.log(`    In Sync: ${inSync}`)
      console.log(`    Total Remote: ${delta.totalRemote}`)
      console.log(`    Total Local: ${delta.totalLocal}`)
      console.log('=========================================\n')

      return {
        success: true,
        message: 'Delta calculated successfully',
        delta
      } as SyncDeltaResponse
    } catch (error) {
      console.error('Delta calculation error:', error)
      console.log('=========================================\n')
      return {
        success: false,
        message: 'Internal server error calculating delta'
      } as SyncDeltaResponse
    }
  })
  .post('/watch', async ({ body, store }) => {
    try {
      const fileWatcher = (store as any)?.fileWatcher
      const watchData = body as any

      if (!watchData.filePath) {
        return {
          success: false,
          message: 'Missing filePath'
        } as SyncResponse
      }

      fileWatcher.watchPath(watchData.filePath)

      return {
        success: true,
        message: 'File path added to watch list',
        data: { filePath: watchData.filePath }
      } as SyncResponse
    } catch (error) {
      console.error('Watch error:', error)
      return {
        success: false,
        message: 'Internal server error adding watch'
      } as SyncResponse
    }
  })
  .get('/changes', async ({ store }) => {
    try {
      const fileWatcher = (store as any)?.fileWatcher
      const watchedFiles = fileWatcher.getWatchedFiles()

      const changes = watchedFiles.map((filePath: string) => ({
        filePath,
        ...fileWatcher.getFileInfo(filePath)
      }))

      return {
        success: true,
        message: 'File changes retrieved',
        data: { changes }
      } as SyncResponse
    } catch (error) {
      console.error('Changes error:', error)
      return {
        success: false,
        message: 'Internal server error retrieving changes'
      } as SyncResponse
    }
  })
  .get('/conflicts', async ({ store }) => {
    try {
      const conflictDetector = (store as any)?.conflictDetector
      const conflicts = conflictDetector.getPendingConflicts()

      return {
        success: true,
        message: 'Conflicts retrieved',
        data: { conflicts }
      } as SyncResponse
    } catch (error) {
      console.error('Conflicts error:', error)
      return {
        success: false,
        message: 'Internal server error retrieving conflicts'
      } as SyncResponse
    }
  })
  .post('/resolve-conflict', async ({ body, store }) => {
    try {
      const conflictDetector = (store as any)?.conflictDetector
      const resolutionData = body as any

      if (!resolutionData.conflictId || !resolutionData.strategy) {
        return {
          success: false,
          message: 'Missing conflictId or strategy'
        } as SyncResponse
      }

      const resolution = {
        strategy: resolutionData.strategy,
        resolvedFile: resolutionData.resolvedFile
      }

      const resolved = conflictDetector.resolveConflict(
        resolutionData.conflictId,
        resolution
      )

      if (resolved) {
        return {
          success: true,
          message: 'Conflict resolved successfully',
          data: { conflictId: resolutionData.conflictId }
        } as SyncResponse
      } else {
        return {
          success: false,
          message: 'Conflict not found or could not be resolved'
        } as SyncResponse
      }
    } catch (error) {
      console.error('Resolve conflict error:', error)
      return {
        success: false,
        message: 'Internal server error resolving conflict'
      } as SyncResponse
    }
  })
  .post('/auto-resolve', async ({ body, store }) => {
    try {
      const conflictDetector = (store as any)?.conflictDetector
      const autoResolveData = body as any

      if (!autoResolveData.conflictId) {
        return {
          success: false,
          message: 'Missing conflictId'
        } as SyncResponse
      }

      const resolution = conflictDetector.autoResolveConflict(autoResolveData.conflictId)

      if (resolution) {
      const resolved = conflictDetector.resolveConflict(
        autoResolveData.conflictId,
        resolution
      )

      if (resolved) {
        return {
          success: true,
          message: 'Conflict auto-resolved',
          data: {
            conflictId: autoResolveData.conflictId,
            strategy: resolution.strategy
          }
        } as SyncResponse
      } else {
        return {
          success: false,
          message: 'Failed to resolve conflict'
        } as SyncResponse
      }
      } else {
        return {
          success: false,
          message: 'Conflict not found or could not be auto-resolved'
        } as SyncResponse
      }
    } catch (error) {
      console.error('Auto-resolve error:', error)
      return {
        success: false,
        message: 'Internal server error auto-resolving conflict'
      } as SyncResponse
    }
  })

function getMimeType(extension: string): string {
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
    'wav': 'audio/wav'
  }
  return mimeTypes[extension] || 'application/octet-stream'
}