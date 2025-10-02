import { Elysia } from 'elysia'
import type { SyncResponse, SyncMetadata } from '../types'
import { DriveServiceFactory } from '../services/drive/DriveServiceFactory'

export const syncRoutes = new Elysia({ prefix: '/sync' })
  .get('/', () => 'Sync API is ready')
  .post('/upload', async ({ body }) => {
    try {
      // Get the configured drive service
      const driveService = DriveServiceFactory.getDriveService()

      if (!driveService.isAuthenticated()) {
        return {
          success: false,
          message: `${driveService.getServiceType()} not available. Please check configuration.`
        } as SyncResponse
      }

      const uploadData = body as any
      if (!uploadData.fileData || !uploadData.filePath || !uploadData.vaultId) {
        return {
          success: false,
          message: 'Missing required fields: fileData, filePath, vaultId'
        } as SyncResponse
      }

      // Convert base64 or ArrayBuffer to Buffer
      let fileBuffer: Buffer
      if (typeof uploadData.fileData === 'string') {
        // Assume base64 encoded
        fileBuffer = Buffer.from(uploadData.fileData, 'base64')
      } else if (uploadData.fileData instanceof ArrayBuffer) {
        fileBuffer = Buffer.from(uploadData.fileData)
      } else {
        return {
          success: false,
          message: 'Invalid fileData format'
        } as SyncResponse
      }

      // Determine MIME type based on file extension
      const fileExtension = uploadData.filePath.split('.').pop()?.toLowerCase() || ''
      const mimeType = getMimeType(fileExtension)

      const uploadResult = await driveService.uploadFile(
        uploadData.filePath,
        fileBuffer,
        mimeType
      )

      if (uploadResult.success) {
        return {
          success: true,
          message: 'File uploaded successfully',
          data: { fileId: uploadResult.fileId, vaultId: uploadData.vaultId }
        } as SyncResponse
      } else {
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
  .get('/download/:fileId', async ({ params }) => {
    try {
      const driveService = DriveServiceFactory.getDriveService()

      if (!driveService.isAuthenticated()) {
        return {
          success: false,
          message: `${driveService.getServiceType()} not available`
        } as SyncResponse
      }

      const downloadResult = await driveService.downloadFile(params.fileId)

      if (downloadResult.success && downloadResult.data) {
        return {
          success: true,
          message: 'File downloaded successfully',
          data: { fileId: params.fileId, fileData: downloadResult.data.toString('base64') }
        } as SyncResponse
      } else {
        return {
          success: false,
          message: downloadResult.error || 'File not found'
        } as SyncResponse
      }
    } catch (error) {
      console.error('Download error:', error)
      return {
        success: false,
        message: 'Internal server error during download'
      } as SyncResponse
    }
  })
  .get('/metadata/:vaultId', async ({ params }) => {
    try {
      const driveService = DriveServiceFactory.getDriveService()

      if (!driveService.isAuthenticated()) {
        return {
          success: false,
          message: `${driveService.getServiceType()} not available`
        } as SyncResponse
      }

      // List all files from the drive service
      const listResult = await driveService.listFiles()

      if (listResult.success) {
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

        return metadata
      } else {
        return {
          success: false,
          message: `Failed to list files: ${listResult.error}`
        } as SyncResponse
      }
    } catch (error) {
      console.error('Metadata error:', error)
      return {
        success: false,
        message: 'Internal server error retrieving metadata'
      } as SyncResponse
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