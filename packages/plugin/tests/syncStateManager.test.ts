import { SyncStateManager, FileSyncState } from '../src/services/syncState'

describe('SyncStateManager', () => {
  let syncStateManager: SyncStateManager

  beforeEach(() => {
    syncStateManager = new SyncStateManager('test-vault-id')
  })

  describe('Initialization', () => {
    it('should create a new instance with default state', () => {
      expect(syncStateManager).toBeInstanceOf(SyncStateManager)
      expect(syncStateManager.getSyncedFileCount()).toBe(0)
      expect(syncStateManager.getTrackedFolderCount()).toBe(0)
    })

    it('should restore from saved state', () => {
      const savedState = {
        vaultId: 'test-vault',
        lastFullSync: Date.now(),
        lastRemoteCheck: Date.now(),
        files: {
          'test.md': {
            path: 'test.md',
            lastSyncedHash: 'abc123',
            lastSyncedTime: Date.now(),
            lastSyncedSize: 1024,
            lastSyncRevisionId: 'rev-123'
          }
        },
        folders: {}
      }

      const restored = new SyncStateManager('test-vault', savedState)
      expect(restored.getSyncedFileCount()).toBe(1)
    })
  })

  describe('File Sync State Management', () => {
    it('should mark a file as synced', () => {
      syncStateManager.markSynced(
        'test.md',
        'hash123',
        Date.now(),
        1024,
        'remote-id-123',
        {
          revisionId: 'rev-123',
          extension: '.md',
          operation: 'upload'
        }
      )

      expect(syncStateManager.getSyncedFileCount()).toBe(1)
      const fileState = syncStateManager.getFileState('test.md')
      expect(fileState?.lastSyncedHash).toBe('hash123')
      expect(fileState?.remoteFileId).toBe('remote-id-123')
      expect(fileState?.lastSyncRevisionId).toBe('rev-123')
    })

    it('should check if file needs sync (hash changed)', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)

      const needsSync = syncStateManager.needsSync('test.md', 'hash456', Date.now(), 1024)
      expect(needsSync).toBe(true)
    })

    it('should detect file does not need sync (unchanged)', () => {
      const now = Date.now()
      syncStateManager.markSynced('test.md', 'hash123', now, 1024)

      const needsSync = syncStateManager.needsSync('test.md', 'hash123', now, 1024)
      expect(needsSync).toBe(false)
    })

    it('should detect new files need sync', () => {
      const needsSync = syncStateManager.needsSync('new.md', 'hash123', Date.now(), 1024)
      expect(needsSync).toBe(true)
    })

    it('should remove file from state', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)
      expect(syncStateManager.getSyncedFileCount()).toBe(1)

      syncStateManager.removeFile('test.md')
      expect(syncStateManager.getSyncedFileCount()).toBe(0)
    })

    it('should get remote file ID', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024, 'remote-123')

      const remoteId = syncStateManager.getRemoteFileId('test.md')
      expect(remoteId).toBe('remote-123')
    })

    it('should update remote file info', () => {
      syncStateManager.updateRemoteFileInfo(
        'test.md',
        'remote-123',
        Date.now(),
        'hash456',
        'rev-456'
      )

      const fileState = syncStateManager.getFileState('test.md')
      expect(fileState?.remoteFileId).toBe('remote-123')
      expect(fileState?.remoteHash).toBe('hash456')
      expect(fileState?.remoteRevisionId).toBe('rev-456')
    })
  })

  describe('Revision ID Tracking', () => {
    it('should store lastSyncRevisionId on upload', () => {
      syncStateManager.markSynced(
        'test.md',
        'hash123',
        Date.now(),
        1024,
        'remote-123',
        {
          revisionId: 'rev-123',
          operation: 'upload'
        }
      )

      const fileState = syncStateManager.getFileState('test.md')
      expect(fileState?.lastSyncRevisionId).toBe('rev-123')
      expect(fileState?.remoteRevisionId).toBe('rev-123')
    })

    it('should store lastSyncRevisionId on download', () => {
      syncStateManager.markSynced(
        'test.md',
        'hash123',
        Date.now(),
        1024,
        'remote-123',
        {
          revisionId: 'rev-456',
          operation: 'download'
        }
      )

      const fileState = syncStateManager.getFileState('test.md')
      expect(fileState?.lastSyncRevisionId).toBe('rev-456')
    })
  })

  describe('Error Handling', () => {
    it('should mark sync errors', () => {
      syncStateManager.markSyncError('test.md', 'Upload failed', 'upload')

      const filesWithErrors = syncStateManager.getFilesWithErrors()
      expect(filesWithErrors.length).toBe(1)
      expect(filesWithErrors[0].path).toBe('test.md')
      expect(filesWithErrors[0].error).toBe('Upload failed')
    })

    it('should clear errors on successful sync', () => {
      syncStateManager.markSyncError('test.md', 'Upload failed', 'upload')
      expect(syncStateManager.getFilesWithErrors().length).toBe(1)

      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)
      expect(syncStateManager.getFilesWithErrors().length).toBe(0)
    })
  })

  describe('Conflict Tracking', () => {
    it('should mark conflicts', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)
      syncStateManager.markConflict('test.md')

      const conflicts = syncStateManager.getFilesWithConflicts()
      expect(conflicts.length).toBe(1)
      expect(conflicts[0].path).toBe('test.md')
      expect(conflicts[0].conflictCount).toBe(1)
    })

    it('should increment conflict count', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)
      syncStateManager.markConflict('test.md')
      syncStateManager.markConflict('test.md')

      const conflicts = syncStateManager.getFilesWithConflicts()
      expect(conflicts[0].conflictCount).toBe(2)
    })
  })

  describe('Folder Tracking', () => {
    it('should track folders', () => {
      syncStateManager.trackFolder('notes/', Date.now(), 5, 2, 'folder-id-123')

      expect(syncStateManager.getTrackedFolderCount()).toBe(1)
      const folderState = syncStateManager.getFolderState('notes/')
      expect(folderState?.fileCount).toBe(5)
      expect(folderState?.subfolderCount).toBe(2)
    })

    it('should update folder metadata', () => {
      syncStateManager.trackFolder('notes/', Date.now(), 5, 2)
      syncStateManager.updateFolder('notes/', Date.now(), 7, 3)

      const folderState = syncStateManager.getFolderState('notes/')
      expect(folderState?.fileCount).toBe(7)
      expect(folderState?.subfolderCount).toBe(3)
    })

    it('should rename folders and update file paths', () => {
      // Add folder and files
      syncStateManager.trackFolder('oldFolder/', Date.now(), 2, 0)
      syncStateManager.markSynced('oldFolder/file1.md', 'hash1', Date.now(), 100)
      syncStateManager.markSynced('oldFolder/file2.md', 'hash2', Date.now(), 200)

      // Rename folder
      syncStateManager.renameFolder('oldFolder/', 'newFolder/')

      // Check folder was renamed
      expect(syncStateManager.getFolderState('oldFolder/')).toBeUndefined()
      expect(syncStateManager.getFolderState('newFolder/')).toBeDefined()

      // Check files were updated
      expect(syncStateManager.getFileState('oldFolder/file1.md')).toBeUndefined()
      expect(syncStateManager.getFileState('newFolder/file1.md')).toBeDefined()
      expect(syncStateManager.getFileState('newFolder/file2.md')).toBeDefined()
    })

    it('should remove folders', () => {
      syncStateManager.trackFolder('notes/', Date.now(), 5, 2)
      expect(syncStateManager.getTrackedFolderCount()).toBe(1)

      syncStateManager.removeFolder('notes/')
      expect(syncStateManager.getTrackedFolderCount()).toBe(0)
    })
  })

  describe('Remote Check Management', () => {
    it('should track last remote check time', () => {
      syncStateManager.markRemoteCheckCompleted()

      const needsCheck = syncStateManager.needsRemoteCheck(60000) // 1 minute
      expect(needsCheck).toBe(false)
    })

    it('should detect when remote check is needed', async () => {
      syncStateManager.markRemoteCheckCompleted()

      // Wait a bit and check if we need another check
      await new Promise(resolve => setTimeout(resolve, 10))

      const needsCheck = syncStateManager.needsRemoteCheck(5) // 5ms
      expect(needsCheck).toBe(true)
    })
  })

  describe('Statistics', () => {
    it('should provide sync statistics', () => {
      syncStateManager.markSynced('file1.md', 'hash1', Date.now(), 100, undefined, { extension: '.md' })
      syncStateManager.markSynced('file2.md', 'hash2', Date.now(), 200, undefined, { extension: '.md' })
      syncStateManager.markSynced('image.png', 'hash3', Date.now(), 5000, undefined, { extension: '.png' })
      syncStateManager.trackFolder('notes/', Date.now(), 2, 0)

      const stats = syncStateManager.getStats()

      expect(stats.totalFilesSynced).toBe(3)
      expect(stats.totalFoldersTracked).toBe(1)
      expect(stats.extensionCounts['.md']).toBe(2)
      expect(stats.extensionCounts['.png']).toBe(1)
    })

    it('should calculate average sync count', () => {
      syncStateManager.markSynced('file1.md', 'hash1', Date.now(), 100)
      syncStateManager.markSynced('file1.md', 'hash2', Date.now(), 100) // sync again
      syncStateManager.markSynced('file2.md', 'hash3', Date.now(), 100)

      const stats = syncStateManager.getStats()
      expect(stats.avgSyncCount).toBeGreaterThan(0)
    })
  })

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)
      syncStateManager.trackFolder('notes/', Date.now(), 1, 0)

      const json = syncStateManager.toJSON()

      expect(json.vaultId).toBe('test-vault-id')
      expect(Object.keys(json.files)).toHaveLength(1)
      expect(Object.keys(json.folders)).toHaveLength(1)
    })

    it('should restore from JSON', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)
      const json = syncStateManager.toJSON()

      const restored = new SyncStateManager('test-vault-id', {
        ...json,
        files: new Map(Object.entries(json.files)),
        folders: new Map(Object.entries(json.folders))
      })

      expect(restored.getSyncedFileCount()).toBe(1)
    })
  })

  describe('State Clearing', () => {
    it('should clear all state', () => {
      syncStateManager.markSynced('test.md', 'hash123', Date.now(), 1024)
      syncStateManager.trackFolder('notes/', Date.now(), 1, 0)
      syncStateManager.markFullSyncCompleted()

      expect(syncStateManager.getSyncedFileCount()).toBe(1)
      expect(syncStateManager.getTrackedFolderCount()).toBe(1)

      syncStateManager.clear()

      expect(syncStateManager.getSyncedFileCount()).toBe(0)
      expect(syncStateManager.getTrackedFolderCount()).toBe(0)
      expect(syncStateManager.timeSinceLastFullSync()).toBeGreaterThan(0)
    })
  })
})
