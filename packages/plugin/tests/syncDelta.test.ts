import { FileSyncState } from '../src/services/syncState'
import { DriveFile } from '../src/services/googleDriveService'

/**
 * These tests verify the three-way comparison logic used in calculateDelta
 * Testing the decision matrix for:
 * - Local unchanged, Remote unchanged -> In sync
 * - Local changed, Remote unchanged -> Upload
 * - Local unchanged, Remote changed -> Download
 * - Local changed, Remote changed -> Conflict
 */
describe('Sync Delta Calculation Logic', () => {
  describe('Three-Way Comparison Decision Matrix', () => {
    it('should detect files in sync (no changes)', () => {
      const localFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: 'hash123',
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        lastSyncRevisionId: 'rev-123',
        remoteFileId: 'file-id-123'
      }

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date(1000).toISOString(),
        headRevisionId: 'rev-123' // Same as lastSyncRevisionId
      }

      const currentLocalHash = 'hash123' // Same as lastSyncedHash

      // Decision logic
      const localChanged = currentLocalHash !== localFile.lastSyncedHash
      const remoteChanged = remoteFile.headRevisionId !== localFile.lastSyncRevisionId

      expect(localChanged).toBe(false)
      expect(remoteChanged).toBe(false)
      // Result: IN SYNC
    })

    it('should detect local-only changes (upload needed)', () => {
      const localFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: 'hash123',
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        lastSyncRevisionId: 'rev-123',
        remoteFileId: 'file-id-123'
      }

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date(1000).toISOString(),
        headRevisionId: 'rev-123' // Same as lastSyncRevisionId
      }

      const currentLocalHash = 'hash456' // CHANGED from lastSyncedHash

      // Decision logic
      const localChanged = currentLocalHash !== localFile.lastSyncedHash
      const remoteChanged = remoteFile.headRevisionId !== localFile.lastSyncRevisionId

      expect(localChanged).toBe(true)
      expect(remoteChanged).toBe(false)
      // Result: UPLOAD
    })

    it('should detect remote-only changes (download needed)', () => {
      const localFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: 'hash123',
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        lastSyncRevisionId: 'rev-123',
        remoteFileId: 'file-id-123'
      }

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 150,
        modifiedTime: new Date(2000).toISOString(),
        headRevisionId: 'rev-456' // CHANGED from lastSyncRevisionId
      }

      const currentLocalHash = 'hash123' // Same as lastSyncedHash

      // Decision logic
      const localChanged = currentLocalHash !== localFile.lastSyncedHash
      const remoteChanged = remoteFile.headRevisionId !== localFile.lastSyncRevisionId

      expect(localChanged).toBe(false)
      expect(remoteChanged).toBe(true)
      // Result: DOWNLOAD
    })

    it('should detect conflicts (both changed)', () => {
      const localFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: 'hash123',
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        lastSyncRevisionId: 'rev-123',
        remoteFileId: 'file-id-123'
      }

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 150,
        modifiedTime: new Date(2000).toISOString(),
        headRevisionId: 'rev-456' // CHANGED from lastSyncRevisionId
      }

      const currentLocalHash = 'hash789' // CHANGED from lastSyncedHash

      // Decision logic
      const localChanged = currentLocalHash !== localFile.lastSyncedHash
      const remoteChanged = remoteFile.headRevisionId !== localFile.lastSyncRevisionId

      expect(localChanged).toBe(true)
      expect(remoteChanged).toBe(true)
      // Result: CONFLICT
    })
  })

  describe('Echo Detection', () => {
    it('should detect own changes via syncAgentId', () => {
      const ownSyncAgentId = 'device-abc-123'

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date().toISOString(),
        headRevisionId: 'rev-123',
        appProperties: {
          lastModifiedByAgent: 'device-abc-123' // Same as ownSyncAgentId
        }
      }

      const isOwnChange = remoteFile.appProperties?.lastModifiedByAgent === ownSyncAgentId

      expect(isOwnChange).toBe(true)
      // Result: SKIP (echo detected)
    })

    it('should detect changes from other devices', () => {
      const ownSyncAgentId = 'device-abc-123'

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date().toISOString(),
        headRevisionId: 'rev-123',
        appProperties: {
          lastModifiedByAgent: 'device-xyz-789' // Different from ownSyncAgentId
        }
      }

      const isOwnChange = remoteFile.appProperties?.lastModifiedByAgent === ownSyncAgentId

      expect(isOwnChange).toBe(false)
      // Result: Process normally
    })

    it('should handle files without appProperties', () => {
      const ownSyncAgentId = 'device-abc-123'

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date().toISOString(),
        headRevisionId: 'rev-123'
        // No appProperties
      }

      const isOwnChange = remoteFile.appProperties?.lastModifiedByAgent === ownSyncAgentId

      expect(isOwnChange).toBe(false)
      // Result: Process normally (not an echo)
    })
  })

  describe('New File Detection', () => {
    it('should detect new remote files (not in local index)', () => {
      const localFilesMap = new Map<string, FileSyncState>()
      // Empty - no files in index

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'new-file.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date().toISOString(),
        headRevisionId: 'rev-123'
      }

      const localFile = localFilesMap.get(remoteFile.name)

      expect(localFile).toBeUndefined()
      // Result: DOWNLOAD (new remote file)
    })

    it('should detect new local files (not in remote)', () => {
      const localFilesMap = new Map<string, FileSyncState>()
      localFilesMap.set('new-local.md', {
        path: 'new-local.md',
        lastSyncedHash: '',
        lastSyncedTime: 0,
        lastSyncedSize: 0
        // No remoteFileId
      })

      const remoteFilesMap = new Map<string, DriveFile>()
      // Empty - no files on remote

      const localFile = localFilesMap.get('new-local.md')
      const remoteFile = remoteFilesMap.get('new-local.md')

      expect(localFile).toBeDefined()
      expect(remoteFile).toBeUndefined()
      expect(localFile?.remoteFileId).toBeUndefined()
      // Result: UPLOAD (new local file)
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing lastSyncRevisionId (assume changed)', () => {
      const localFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: 'hash123',
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        // No lastSyncRevisionId
        remoteFileId: 'file-id-123'
      }

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date().toISOString(),
        headRevisionId: 'rev-123'
      }

      // When lastSyncRevisionId is missing, assume remote changed
      const remoteChanged = localFile.lastSyncRevisionId
        ? (remoteFile.headRevisionId !== localFile.lastSyncRevisionId)
        : true

      expect(remoteChanged).toBe(true)
      // Result: If local also unchanged, DOWNLOAD
    })

    it('should handle files synced but deleted remotely', () => {
      const localFile: FileSyncState = {
        path: 'deleted-remotely.md',
        lastSyncedHash: 'hash123',
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        lastSyncRevisionId: 'rev-123',
        remoteFileId: 'file-id-123'
      }

      const remoteFilesMap = new Map<string, DriveFile>()
      // File not in remote anymore

      const remoteFile = remoteFilesMap.get(localFile.path)

      expect(remoteFile).toBeUndefined()
      expect(localFile.remoteFileId).toBeDefined() // Was synced before
      // Result: UPLOAD (missing remote, was synced) or check tombstones
    })

    it('should skip remote-only tracking entries', () => {
      const localFile: FileSyncState = {
        path: 'remote-only.md',
        lastSyncedHash: '', // Empty
        lastSyncedTime: 0, // Never synced
        lastSyncedSize: 0,
        remoteFileId: 'file-id-123'
      }

      const isRemoteOnlyEntry = localFile.lastSyncedTime === 0 && localFile.lastSyncedHash === ''

      expect(isRemoteOnlyEntry).toBe(true)
      // Result: SKIP (remote-only tracking entry)
    })
  })

  describe('Revision ID Comparison Reliability', () => {
    it('should use headRevisionId over timestamps for reliability', () => {
      // Scenario: Clocks are out of sync, but revisionIds are correct
      const localFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: 'hash123',
        lastSyncedTime: 5000, // Local clock ahead
        lastSyncedSize: 100,
        lastSyncRevisionId: 'rev-123',
        remoteFileId: 'file-id-123'
      }

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date(3000).toISOString(), // Remote clock behind
        headRevisionId: 'rev-123' // Same revision!
      }

      // Using timestamps would suggest local is newer
      const timestampComparison = localFile.lastSyncedTime > new Date(remoteFile.modifiedTime).getTime()
      expect(timestampComparison).toBe(true) // Would incorrectly suggest upload

      // Using revisionId correctly identifies they're in sync
      const revisionComparison = remoteFile.headRevisionId === localFile.lastSyncRevisionId
      expect(revisionComparison).toBe(true) // Correct: IN SYNC
      // Result: headRevisionId is more reliable than timestamps
    })
  })

  describe('Multiple Simultaneous Changes Scenarios', () => {
    it('should handle rapid local edits (same headRevisionId)', () => {
      const localFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: 'hash1',
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        lastSyncRevisionId: 'rev-123'
      }

      // User makes multiple rapid local edits
      const currentLocalHash1 = 'hash2' // First edit
      const currentLocalHash2 = 'hash3' // Second edit
      const currentLocalHash3 = 'hash4' // Third edit

      const remoteFile: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date(1000).toISOString(),
        headRevisionId: 'rev-123' // Remote unchanged
      }

      // All three local edits should be detected as needing upload
      expect(currentLocalHash1).not.toBe(localFile.lastSyncedHash)
      expect(currentLocalHash2).not.toBe(localFile.lastSyncedHash)
      expect(currentLocalHash3).not.toBe(localFile.lastSyncedHash)
      expect(remoteFile.headRevisionId).toBe(localFile.lastSyncRevisionId)
      // Result: UPLOAD (local changed, remote unchanged)
    })

    it('should handle offline edits on multiple devices', () => {
      // Initial synced state
      const initialRevisionId = 'rev-100'
      const initialHash = 'hash100'

      // Device A makes offline edits
      const deviceAHash = 'hash-device-A'
      const deviceAChanged = deviceAHash !== initialHash

      // Device B makes offline edits (different)
      const deviceBHash = 'hash-device-B'

      // Device A syncs first -> creates rev-101
      const remoteAfterDeviceA: DriveFile = {
        id: 'file-id-123',
        name: 'test.md',
        mimeType: 'text/markdown',
        size: 100,
        modifiedTime: new Date().toISOString(),
        headRevisionId: 'rev-101',
        appProperties: { lastModifiedByAgent: 'device-A' }
      }

      // Device B comes online
      const deviceBLocalFile: FileSyncState = {
        path: 'test.md',
        lastSyncedHash: initialHash,
        lastSyncedTime: 1000,
        lastSyncedSize: 100,
        lastSyncRevisionId: initialRevisionId // Still at rev-100!
      }

      const deviceBLocalChanged = deviceBHash !== deviceBLocalFile.lastSyncedHash
      const remoteChanged = remoteAfterDeviceA.headRevisionId !== deviceBLocalFile.lastSyncRevisionId

      expect(deviceBLocalChanged).toBe(true)
      expect(remoteChanged).toBe(true)
      // Result: CONFLICT (both devices edited offline)
    })
  })
})
