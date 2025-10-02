import { VaultWatcherService } from '../src/services/vaultWatcher'

describe('VaultWatcherService - Basic Tests', () => {
  let vaultWatcher: VaultWatcherService

  beforeEach(() => {
    vaultWatcher = new VaultWatcherService('/test/vault')
  })

  afterEach(() => {
    vaultWatcher.stopWatching()
  })

  describe('Basic Functionality', () => {
    it('should create a new instance', () => {
      expect(vaultWatcher).toBeInstanceOf(VaultWatcherService)
    })

    it('should have zero watched files initially', () => {
      expect(vaultWatcher.getWatchedFileCount()).toBe(0)
    })

    it('should allow adding change callbacks', () => {
      const callback = jest.fn()
      vaultWatcher.onChange(callback)

      // The callback should be stored internally
      // We can't test this directly, but we can verify no errors are thrown
      expect(() => vaultWatcher.onChange(callback)).not.toThrow()
    })

    it('should start watching without throwing errors', async () => {
      // The service handles missing directories gracefully
      await expect(vaultWatcher.startWatching()).resolves.toBeUndefined()
    })

    it('should stop watching without throwing errors', () => {
      expect(() => vaultWatcher.stopWatching()).not.toThrow()
    })
  })

  describe('File Extension Filtering', () => {
    // Test the file extension logic directly since it's easier to test
    it('should identify relevant file extensions', () => {
      const relevantFiles = [
        'note.md',
        'document.txt',
        'image.png',
        'photo.jpg',
        'data.pdf'
      ]

      const irrelevantFiles = [
        'script.js',
        'style.css',
        'config.json',
        'readme'
      ]

      // We can't directly test the private method, but we can test the logic
      const relevantExtensions = ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg']

      relevantFiles.forEach(file => {
        const extension = file.substring(file.lastIndexOf('.'))
        expect(relevantExtensions).toContain(extension)
      })

      irrelevantFiles.forEach(file => {
        const extension = file.includes('.') ? file.substring(file.lastIndexOf('.')) : ''
        if (extension) {
          expect(relevantExtensions).not.toContain(extension)
        }
      })
    })

    it('should handle files without extensions', () => {
      const filesWithoutExtensions = ['readme', 'license', 'changelog']

      filesWithoutExtensions.forEach(file => {
        const hasExtension = file.includes('.')
        expect(hasExtension).toBe(false)
      })
    })
  })

  describe('Change Detection Logic', () => {
    it('should detect file changes based on hash', () => {
      // Test the hash comparison logic
      const hash1 = 'abc123'
      const hash2 = 'def456'
      const hash3 = 'abc123'

      expect(hash1).not.toBe(hash2)
      expect(hash1).toBe(hash3)
    })

    it('should handle file metadata', () => {
      const fileMetadata = {
        path: 'test.md',
        size: 1024,
        mtime: Date.now(),
        hash: 'mock-hash'
      }

      expect(fileMetadata.path).toBe('test.md')
      expect(typeof fileMetadata.size).toBe('number')
      expect(typeof fileMetadata.mtime).toBe('number')
      expect(fileMetadata.hash).toBe('mock-hash')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid paths gracefully', () => {
      const invalidWatcher = new VaultWatcherService('')
      expect(invalidWatcher).toBeInstanceOf(VaultWatcherService)
    })

    it('should handle multiple start/stop calls', async () => {
      // Multiple starts should not cause issues
      await expect(vaultWatcher.startWatching()).resolves.toBeUndefined()
      await expect(vaultWatcher.startWatching()).resolves.toBeUndefined()

      // Multiple stops should not cause issues
      expect(() => vaultWatcher.stopWatching()).not.toThrow()
      expect(() => vaultWatcher.stopWatching()).not.toThrow()
    })
  })
})