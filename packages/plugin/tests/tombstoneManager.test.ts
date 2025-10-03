import { TombstoneManager, Tombstone } from '../src/services/tombstoneManager'

// Mock Vault
const mockVault = {
  adapter: {
    exists: jest.fn(),
    read: jest.fn(),
    write: jest.fn()
  }
} as any

describe('TombstoneManager', () => {
  let tombstoneManager: TombstoneManager

  beforeEach(() => {
    tombstoneManager = new TombstoneManager(mockVault, 30) // 30-day grace period
    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should create a new instance with default grace period', () => {
      expect(tombstoneManager).toBeInstanceOf(TombstoneManager)
    })

    it('should load empty state when no tombstone file exists', async () => {
      mockVault.adapter.exists.mockResolvedValue(false)

      await tombstoneManager.load()

      expect(tombstoneManager.getAllTombstones()).toHaveLength(0)
    })

    it('should load existing tombstones from file', async () => {
      const savedTombstones = {
        'file-id-123': {
          fileId: 'file-id-123',
          filePath: 'test.md',
          deletedAt: Date.now(),
          deletedBy: 'agent-1'
        }
      }

      mockVault.adapter.exists.mockResolvedValue(true)
      mockVault.adapter.read.mockResolvedValue(JSON.stringify(savedTombstones))

      await tombstoneManager.load()

      expect(tombstoneManager.getAllTombstones()).toHaveLength(1)
      expect(tombstoneManager.hasTombstone('file-id-123')).toBe(true)
    })

    it('should handle corrupted tombstone file gracefully', async () => {
      mockVault.adapter.exists.mockResolvedValue(true)
      mockVault.adapter.read.mockResolvedValue('invalid json')

      await tombstoneManager.load()

      expect(tombstoneManager.getAllTombstones()).toHaveLength(0)
    })
  })

  describe('Adding Tombstones', () => {
    beforeEach(() => {
      mockVault.adapter.write.mockResolvedValue(undefined)
    })

    it('should add a tombstone', async () => {
      await tombstoneManager.addTombstone('file-123', 'test.md', 'agent-1')

      expect(tombstoneManager.hasTombstone('file-123')).toBe(true)
      expect(mockVault.adapter.write).toHaveBeenCalled()
    })

    it('should store tombstone with correct metadata', async () => {
      const beforeAdd = Date.now()
      await tombstoneManager.addTombstone('file-123', 'notes/test.md', 'agent-1')
      const afterAdd = Date.now()

      const tombstone = tombstoneManager.getTombstone('file-123')

      expect(tombstone).toBeDefined()
      expect(tombstone?.fileId).toBe('file-123')
      expect(tombstone?.filePath).toBe('notes/test.md')
      expect(tombstone?.deletedBy).toBe('agent-1')
      expect(tombstone?.deletedAt).toBeGreaterThanOrEqual(beforeAdd)
      expect(tombstone?.deletedAt).toBeLessThanOrEqual(afterAdd)
    })

    it('should overwrite existing tombstone for same file', async () => {
      await tombstoneManager.addTombstone('file-123', 'test.md', 'agent-1')
      const firstTombstone = tombstoneManager.getTombstone('file-123')

      await new Promise(resolve => setTimeout(resolve, 10))

      await tombstoneManager.addTombstone('file-123', 'test-renamed.md', 'agent-2')
      const secondTombstone = tombstoneManager.getTombstone('file-123')

      expect(secondTombstone?.filePath).toBe('test-renamed.md')
      expect(secondTombstone?.deletedBy).toBe('agent-2')
      expect(secondTombstone?.deletedAt).toBeGreaterThan(firstTombstone!.deletedAt)
    })
  })

  describe('Querying Tombstones', () => {
    beforeEach(async () => {
      mockVault.adapter.write.mockResolvedValue(undefined)
    })

    it('should check if tombstone exists', async () => {
      await tombstoneManager.addTombstone('file-123', 'test.md', 'agent-1')

      expect(tombstoneManager.hasTombstone('file-123')).toBe(true)
      expect(tombstoneManager.hasTombstone('file-456')).toBe(false)
    })

    it('should get specific tombstone', async () => {
      await tombstoneManager.addTombstone('file-123', 'test.md', 'agent-1')

      const tombstone = tombstoneManager.getTombstone('file-123')
      expect(tombstone?.fileId).toBe('file-123')
    })

    it('should return undefined for non-existent tombstone', () => {
      const tombstone = tombstoneManager.getTombstone('non-existent')
      expect(tombstone).toBeUndefined()
    })

    it('should get all tombstones', async () => {
      await tombstoneManager.addTombstone('file-1', 'test1.md', 'agent-1')
      await tombstoneManager.addTombstone('file-2', 'test2.md', 'agent-1')
      await tombstoneManager.addTombstone('file-3', 'test3.md', 'agent-1')

      const allTombstones = tombstoneManager.getAllTombstones()
      expect(allTombstones).toHaveLength(3)
    })
  })

  describe('Grace Period and Expiration', () => {
    beforeEach(() => {
      mockVault.adapter.write.mockResolvedValue(undefined)
    })

    it('should identify expired tombstones', async () => {
      const now = Date.now()
      const gracePeriodMs = 30 * 24 * 60 * 60 * 1000 // 30 days

      // Manually create tombstones with different ages
      const recentTombstone: Tombstone = {
        fileId: 'recent',
        filePath: 'recent.md',
        deletedAt: now - (10 * 24 * 60 * 60 * 1000), // 10 days ago
        deletedBy: 'agent-1'
      }

      const expiredTombstone: Tombstone = {
        fileId: 'expired',
        filePath: 'expired.md',
        deletedAt: now - (40 * 24 * 60 * 60 * 1000), // 40 days ago
        deletedBy: 'agent-1'
      }

      // Add them via the manager
      await tombstoneManager.addTombstone(recentTombstone.fileId, recentTombstone.filePath, recentTombstone.deletedBy)
      await tombstoneManager.addTombstone(expiredTombstone.fileId, expiredTombstone.filePath, expiredTombstone.deletedBy)

      // Manually set the deletedAt times to simulate age
      const allTombstones = tombstoneManager.getAllTombstones()
      allTombstones.find(t => t.fileId === 'recent')!.deletedAt = recentTombstone.deletedAt
      allTombstones.find(t => t.fileId === 'expired')!.deletedAt = expiredTombstone.deletedAt

      const expired = tombstoneManager.getExpiredTombstones()

      expect(expired.length).toBe(1)
      expect(expired[0].fileId).toBe('expired')
    })

    it('should handle tombstones exactly at grace period boundary', async () => {
      const now = Date.now()
      const gracePeriodMs = 30 * 24 * 60 * 60 * 1000

      await tombstoneManager.addTombstone('boundary', 'boundary.md', 'agent-1')

      // Set to exactly at the grace period
      const tombstones = tombstoneManager.getAllTombstones()
      tombstones[0].deletedAt = now - gracePeriodMs

      const expired = tombstoneManager.getExpiredTombstones()
      expect(expired.length).toBe(0) // Should not be expired yet

      // Set to just past grace period
      tombstones[0].deletedAt = now - gracePeriodMs - 1

      const expiredNow = tombstoneManager.getExpiredTombstones()
      expect(expiredNow.length).toBe(1)
    })
  })

  describe('Removing Tombstones', () => {
    beforeEach(() => {
      mockVault.adapter.write.mockResolvedValue(undefined)
    })

    it('should remove a tombstone', async () => {
      await tombstoneManager.addTombstone('file-123', 'test.md', 'agent-1')
      expect(tombstoneManager.hasTombstone('file-123')).toBe(true)

      await tombstoneManager.removeTombstone('file-123')
      expect(tombstoneManager.hasTombstone('file-123')).toBe(false)
      expect(mockVault.adapter.write).toHaveBeenCalledTimes(2) // add + remove
    })

    it('should handle removing non-existent tombstone gracefully', async () => {
      await tombstoneManager.removeTombstone('non-existent')
      // Should not throw
    })
  })

  describe('Cleanup Operations', () => {
    beforeEach(() => {
      mockVault.adapter.write.mockResolvedValue(undefined)
    })

    it('should cleanup expired tombstones', async () => {
      const now = Date.now()

      // Add tombstones
      await tombstoneManager.addTombstone('recent', 'recent.md', 'agent-1')
      await tombstoneManager.addTombstone('expired', 'expired.md', 'agent-1')

      // Manually age them
      const tombstones = tombstoneManager.getAllTombstones()
      tombstones.find(t => t.fileId === 'recent')!.deletedAt = now - (10 * 24 * 60 * 60 * 1000)
      tombstones.find(t => t.fileId === 'expired')!.deletedAt = now - (40 * 24 * 60 * 60 * 1000)

      const fileIdsToDelete = await tombstoneManager.cleanupExpiredTombstones()

      expect(fileIdsToDelete).toHaveLength(1)
      expect(fileIdsToDelete[0]).toBe('expired')
      expect(tombstoneManager.hasTombstone('expired')).toBe(false)
      expect(tombstoneManager.hasTombstone('recent')).toBe(true)
    })

    it('should return empty array when no expired tombstones', async () => {
      await tombstoneManager.addTombstone('recent', 'recent.md', 'agent-1')

      const fileIdsToDelete = await tombstoneManager.cleanupExpiredTombstones()

      expect(fileIdsToDelete).toHaveLength(0)
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      mockVault.adapter.write.mockResolvedValue(undefined)
    })

    it('should provide accurate statistics', async () => {
      const now = Date.now()

      await tombstoneManager.addTombstone('recent', 'recent.md', 'agent-1')
      await tombstoneManager.addTombstone('expired', 'expired.md', 'agent-1')

      // Age the expired one
      const tombstones = tombstoneManager.getAllTombstones()
      tombstones.find(t => t.fileId === 'expired')!.deletedAt = now - (40 * 24 * 60 * 60 * 1000)

      const stats = tombstoneManager.getStats()

      expect(stats.total).toBe(2)
      expect(stats.expired).toBe(1)
      expect(stats.recent).toBe(1)
      expect(stats.gracePeriodDays).toBe(30)
    })

    it('should show zero stats for empty manager', () => {
      const stats = tombstoneManager.getStats()

      expect(stats.total).toBe(0)
      expect(stats.expired).toBe(0)
      expect(stats.recent).toBe(0)
      expect(stats.gracePeriodDays).toBe(30)
    })
  })

  describe('Persistence', () => {
    it('should save tombstones to file', async () => {
      mockVault.adapter.write.mockResolvedValue(undefined)

      await tombstoneManager.addTombstone('file-123', 'test.md', 'agent-1')

      expect(mockVault.adapter.write).toHaveBeenCalled()
      const writeCall = mockVault.adapter.write.mock.calls[0]
      expect(writeCall[0]).toBe('.obsidian/sync-tombstones.json')

      const savedData = JSON.parse(writeCall[1])
      expect(savedData['file-123']).toBeDefined()
      expect(savedData['file-123'].filePath).toBe('test.md')
    })

    it('should handle save errors gracefully', async () => {
      mockVault.adapter.write.mockRejectedValue(new Error('Write failed'))

      await tombstoneManager.addTombstone('file-123', 'test.md', 'agent-1')

      // Should still have the tombstone in memory
      expect(tombstoneManager.hasTombstone('file-123')).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockVault.adapter.write.mockResolvedValue(undefined)
    })

    it('should handle files with special characters in path', async () => {
      const specialPath = 'notes/file with spaces & special-chars (2024).md'
      await tombstoneManager.addTombstone('file-123', specialPath, 'agent-1')

      const tombstone = tombstoneManager.getTombstone('file-123')
      expect(tombstone?.filePath).toBe(specialPath)
    })

    it('should handle very long file paths', async () => {
      const longPath = 'a'.repeat(500) + '.md'
      await tombstoneManager.addTombstone('file-123', longPath, 'agent-1')

      const tombstone = tombstoneManager.getTombstone('file-123')
      expect(tombstone?.filePath).toBe(longPath)
    })

    it('should handle custom grace periods', () => {
      const shortGracePeriod = new TombstoneManager(mockVault, 1) // 1 day
      const stats = shortGracePeriod.getStats()
      expect(stats.gracePeriodDays).toBe(1)
    })
  })
})
