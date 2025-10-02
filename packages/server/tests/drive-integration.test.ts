import { promises as fs } from 'fs'
import path from 'path'
import { DriveServiceFactory, DriveType } from '../src/services/drive/DriveServiceFactory'
import { LocalDriveService } from '../src/services/drive/LocalDriveService'

describe('Drive Service Integration Tests', () => {
  let testStoragePath: string

  beforeEach(async () => {
    // Set up test storage directory
    testStoragePath = path.join(__dirname, 'test-drive-storage')

    // Clean up any existing test directory
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true })
    } catch (error) {
      // Ignore if directory doesn't exist
    }

    // Create test directory
    await fs.mkdir(testStoragePath, { recursive: true })

    // Force local storage for testing
    process.env.DRIVE_TYPE = 'local'
    process.env.LOCAL_STORAGE_PATH = testStoragePath
    DriveServiceFactory.resetInstance()
  })

  afterEach(async () => {
    // Clean up
    DriveServiceFactory.resetInstance()

    try {
      await fs.rm(testStoragePath, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Complete Sync Workflow', () => {
    it('should upload and download files successfully', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Test connection
      const connection = await driveService.testConnection()
      expect(connection.connected).toBe(true)
      expect(connection.message).toContain('Local storage available')

      // Upload a test file
      const testContent = 'Hello, World! This is a test file for sync.'
      const uploadResult = await driveService.uploadFile(
        'test-sync.md',
        Buffer.from(testContent),
        'text/markdown'
      )

      expect(uploadResult.success).toBe(true)
      expect(uploadResult.fileId).toBeDefined()

      const fileId = uploadResult.fileId!

      // List files to verify upload
      const listResult = await driveService.listFiles()
      expect(listResult.success).toBe(true)
      expect(listResult.files!.length).toBe(1)
      expect(listResult.files![0].name).toBe('test-sync.md')

      // Download the file
      const downloadResult = await driveService.downloadFile(fileId)
      expect(downloadResult.success).toBe(true)
      expect(downloadResult.data).toEqual(Buffer.from(testContent))

      // Get file metadata
      const metadataResult = await driveService.getFileMetadata(fileId)
      expect(metadataResult.success).toBe(true)
      expect(metadataResult.file!.name).toBe('test-sync.md')
      expect(metadataResult.file!.size).toBe(testContent.length)
      expect(metadataResult.file!.mimeType).toBe('text/markdown')
    }, 30000)

    it('should handle multiple file types', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      const testFiles = [
        { name: 'note.md', content: '# Test Note\nThis is a markdown note.', mimeType: 'text/markdown' },
        { name: 'document.txt', content: 'This is a plain text document.', mimeType: 'text/plain' },
        { name: 'data.json', content: '{"key": "value", "number": 42}', mimeType: 'application/json' }
      ]

      // Upload all files
      const uploadPromises = testFiles.map(file =>
        driveService.uploadFile(file.name, Buffer.from(file.content), file.mimeType)
      )

      const uploadResults = await Promise.all(uploadPromises)

      // Verify all uploads succeeded
      uploadResults.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.fileId).toBeDefined()
      })

      // List all files
      const listResult = await driveService.listFiles()
      expect(listResult.success).toBe(true)
      expect(listResult.files!.length).toBe(3)

      // Verify file properties
      const uploadedFiles = listResult.files!
      testFiles.forEach(testFile => {
        const uploadedFile = uploadedFiles.find(f => f.name === testFile.name)
        expect(uploadedFile).toBeDefined()
        expect(uploadedFile!.mimeType).toBe(testFile.mimeType)
      })
    }, 30000)

    it('should handle file updates', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Upload initial file
      const initialContent = 'Initial content'
      const uploadResult1 = await driveService.uploadFile(
        'update-test.md',
        Buffer.from(initialContent),
        'text/markdown'
      )

      expect(uploadResult1.success).toBe(true)
      const fileId = uploadResult1.fileId!

      // Update the file
      const updatedContent = 'Updated content with more information'
      const uploadResult2 = await driveService.uploadFile(
        'update-test.md',
        Buffer.from(updatedContent),
        'text/markdown'
      )

      expect(uploadResult2.success).toBe(true)
      expect(uploadResult2.fileId).toBeDefined()

      // Download and verify updated content
      const downloadResult = await driveService.downloadFile(uploadResult2.fileId!)
      expect(downloadResult.success).toBe(true)
      expect(downloadResult.data).toEqual(Buffer.from(updatedContent))

      // List files - should have 2 versions now
      const listResult = await driveService.listFiles()
      expect(listResult.success).toBe(true)
      expect(listResult.files!.length).toBe(2)
    }, 30000)

    it('should handle file deletion', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Upload a file
      const uploadResult = await driveService.uploadFile(
        'delete-test.md',
        Buffer.from('# Delete Me\nThis file will be deleted.'),
        'text/markdown'
      )

      expect(uploadResult.success).toBe(true)
      const fileId = uploadResult.fileId!

      // Verify file exists
      const listResult1 = await driveService.listFiles()
      expect(listResult1.files!.some(f => f.id === fileId)).toBe(true)

      // Delete the file
      const deleteResult = await driveService.deleteFile(fileId)
      expect(deleteResult.success).toBe(true)

      // Verify file is gone
      const listResult2 = await driveService.listFiles()
      expect(listResult2.files!.some(f => f.id === fileId)).toBe(false)
    }, 30000)
  })

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Try to download non-existent file
      const downloadResult = await driveService.downloadFile('non-existent-id')
      expect(downloadResult.success).toBe(false)
      expect(downloadResult.error).toBeDefined()

      // Try to delete non-existent file
      const deleteResult = await driveService.deleteFile('non-existent-id')
      expect(deleteResult.success).toBe(false)
      expect(deleteResult.error).toBeDefined()

      // Try to get metadata for non-existent file
      const metadataResult = await driveService.getFileMetadata('non-existent-id')
      expect(metadataResult.success).toBe(false)
      expect(metadataResult.error).toBeDefined()
    }, 30000)

    it('should handle invalid file operations', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Try to upload empty file
      const uploadResult1 = await driveService.uploadFile('', Buffer.from(''), 'text/plain')
      expect(uploadResult1.success).toBe(true) // Empty filename should still work

      // Try to upload with invalid MIME type
      const uploadResult2 = await driveService.uploadFile('test.bin', Buffer.from('test'), 'invalid/mimetype')
      expect(uploadResult2.success).toBe(true) // Should still work with invalid MIME type
    }, 30000)
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Create multiple upload promises
      const uploadPromises = Array.from({ length: 5 }, async (_, i) => {
        const content = `Concurrent file ${i}\nThis is file number ${i} for concurrent testing.`
        return driveService.uploadFile(`concurrent-${i}.md`, Buffer.from(content), 'text/markdown')
      })

      // Execute all uploads concurrently
      const uploadResults = await Promise.all(uploadPromises)

      // Verify all uploads succeeded
      uploadResults.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.fileId).toBeDefined()
      })

      // Verify all files are listed
      const listResult = await driveService.listFiles()
      expect(listResult.success).toBe(true)
      expect(listResult.files!.length).toBe(5)
    }, 30000)

    it('should handle large files', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Create a 1MB file
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB of 'x' characters
      const uploadResult = await driveService.uploadFile(
        'large-file.md',
        Buffer.from(largeContent),
        'text/markdown'
      )

      expect(uploadResult.success).toBe(true)
      expect(uploadResult.fileId).toBeDefined()

      // Download and verify
      const downloadResult = await driveService.downloadFile(uploadResult.fileId!)
      expect(downloadResult.success).toBe(true)
      expect(downloadResult.data!.length).toBe(largeContent.length)
    }, 60000) // Increased timeout for large file

    it('should handle many small files efficiently', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      const fileCount = 10
      const uploadPromises = Array.from({ length: fileCount }, async (_, i) => {
        const content = `# File ${i}\nThis is a small test file number ${i}.`
        return driveService.uploadFile(`small-${i}.md`, Buffer.from(content), 'text/markdown')
      })

      const startTime = Date.now()
      const uploadResults = await Promise.all(uploadPromises)
      const endTime = Date.now()

      const duration = endTime - startTime

      // Verify all uploads succeeded
      uploadResults.forEach(result => {
        expect(result.success).toBe(true)
      })

      // Verify all files are present
      const listResult = await driveService.listFiles()
      expect(listResult.files!.length).toBe(fileCount)

      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000) // 10 seconds max

      console.log(`Uploaded ${fileCount} small files in ${duration}ms`)
    }, 30000)
  })

  describe('Service Switching', () => {
    it('should switch between service types', async () => {
      // Start with local storage
      process.env.DRIVE_TYPE = 'local'
      DriveServiceFactory.resetInstance()
      const localService = DriveServiceFactory.getDriveService()

      expect(localService.getServiceType()).toBe('Local File System')

      // Upload a file to local storage
      const uploadResult = await localService.uploadFile(
        'switch-test.md',
        Buffer.from('Test content for service switching'),
        'text/markdown'
      )
      expect(uploadResult.success).toBe(true)

      // Switch to local storage again (should be same instance)
      DriveServiceFactory.resetInstance()
      const localService2 = DriveServiceFactory.getDriveService()
      expect(localService2.getServiceType()).toBe('Local File System')
    }, 30000)

    it('should handle service reset', async () => {
      const service1 = DriveServiceFactory.getDriveService()
      const service1Type = service1.getServiceType()

      DriveServiceFactory.resetInstance()
      const service2 = DriveServiceFactory.getDriveService()
      const service2Type = service2.getServiceType()

      expect(service1Type).toBe(service2Type)
      expect(service1).not.toBe(service2) // Different instances after reset
    }, 30000)
  })

  describe('CI/CD Compatibility', () => {
    it('should work without external dependencies', async () => {
      // Ensure we're using local storage
      expect(process.env.DRIVE_TYPE).toBe('local')

      const driveService = DriveServiceFactory.getDriveService()

      // Should work completely offline
      const connection = await driveService.testConnection()
      expect(connection.connected).toBe(true)

      // Should be able to perform all operations offline
      const uploadResult = await driveService.uploadFile(
        'ci-test.md',
        Buffer.from('# CI Test\nThis runs in CI without external dependencies'),
        'text/markdown'
      )
      expect(uploadResult.success).toBe(true)

      const listResult = await driveService.listFiles()
      expect(listResult.success).toBe(true)
      expect(listResult.files!.length).toBeGreaterThan(0)
    }, 30000)

    it('should handle resource cleanup', async () => {
      const driveService = DriveServiceFactory.getDriveService()

      // Upload some files
      await driveService.uploadFile('cleanup1.md', Buffer.from('cleanup test 1'), 'text/markdown')
      await driveService.uploadFile('cleanup2.md', Buffer.from('cleanup test 2'), 'text/markdown')

      // Verify files exist
      const listResult1 = await driveService.listFiles()
      expect(listResult1.files!.length).toBe(2)

      // Clean up using local drive service method
      if (driveService instanceof LocalDriveService) {
        await driveService.clearStorage()

        // Verify cleanup
        const listResult2 = await driveService.listFiles()
        expect(listResult2.files!.length).toBe(0)
      }
    }, 30000)
  })
})