import { GoogleDriveService } from '../src/services/drive/GoogleDriveService'
import { LocalDriveService } from '../src/services/drive/LocalDriveService'
import { DriveServiceFactory, DriveType } from '../src/services/drive/DriveServiceFactory'
import { promises as fs } from 'fs'
import path from 'path'

describe('Drive Services Integration Tests', () => {
  describe('LocalDriveService', () => {
    let localDrive: LocalDriveService
    let testStoragePath: string

    beforeEach(() => {
      testStoragePath = path.join(__dirname, 'test-storage')
      localDrive = new LocalDriveService(testStoragePath)
    })

    afterEach(async () => {
      // Clean up test storage
      try {
        await localDrive.clearStorage()
        await fs.rmdir(testStoragePath, { recursive: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    })

    it('should initialize successfully', async () => {
      const connection = await localDrive.testConnection()
      expect(connection.connected).toBe(true)
      expect(connection.message).toContain('Local storage available')
    })

    it('should upload and download files', async () => {
      const testData = Buffer.from('Hello, World!')
      const fileName = 'test.txt'
      const mimeType = 'text/plain'

      // Upload file
      const uploadResult = await localDrive.uploadFile(fileName, testData, mimeType)
      expect(uploadResult.success).toBe(true)
      expect(uploadResult.fileId).toBeDefined()

      const fileId = uploadResult.fileId!

      // Download file
      const downloadResult = await localDrive.downloadFile(fileId)
      expect(downloadResult.success).toBe(true)
      expect(downloadResult.data).toEqual(testData)
    })

    it('should list files', async () => {
      // Upload a few files
      await localDrive.uploadFile('file1.txt', Buffer.from('content1'), 'text/plain')
      await localDrive.uploadFile('file2.md', Buffer.from('content2'), 'text/markdown')

      // List files
      const listResult = await localDrive.listFiles()
      expect(listResult.success).toBe(true)
      expect(listResult.files!.length).toBe(2)

      // Check file properties
      const files = listResult.files!
      expect(files.length).toBe(2)
      expect(files.some(f => f.name === 'file1.txt')).toBe(true)
      expect(files.some(f => f.name === 'file2.md')).toBe(true)
    })

    it('should delete files', async () => {
      // Upload a file
      const uploadResult = await localDrive.uploadFile('delete-test.txt', Buffer.from('test'), 'text/plain')
      const fileId = uploadResult.fileId!

      // Verify file exists
      const listResult1 = await localDrive.listFiles()
      expect(listResult1.files!.length).toBe(1)

      // Delete file
      const deleteResult = await localDrive.deleteFile(fileId)
      expect(deleteResult.success).toBe(true)

      // Verify file is gone
      const listResult2 = await localDrive.listFiles()
      expect(listResult2.files!.length).toBe(0)
    })

    it('should get file metadata', async () => {
      const testData = Buffer.from('metadata test')
      const uploadResult = await localDrive.uploadFile('metadata.txt', testData, 'text/plain')
      const fileId = uploadResult.fileId!

      const metadataResult = await localDrive.getFileMetadata(fileId)
      expect(metadataResult.success).toBe(true)
      expect(metadataResult.file!.name).toBe('metadata.txt')
      expect(metadataResult.file!.size).toBe(testData.length)
      expect(metadataResult.file!.mimeType).toBe('text/plain')
    })

    it('should handle file not found errors', async () => {
      const downloadResult = await localDrive.downloadFile('nonexistent-id')
      expect(downloadResult.success).toBe(false)
      expect(downloadResult.error).toContain('not found')

      const deleteResult = await localDrive.deleteFile('nonexistent-id')
      expect(deleteResult.success).toBe(false)
      expect(deleteResult.error).toContain('not found')

      const metadataResult = await localDrive.getFileMetadata('nonexistent-id')
      expect(metadataResult.success).toBe(false)
      expect(metadataResult.error).toContain('not found')
    })

    it('should support folders', async () => {
      const testData = Buffer.from('folder test')
      const uploadResult = await localDrive.uploadFile('folder-test.txt', testData, 'text/plain', 'test-folder')
      expect(uploadResult.success).toBe(true)

      // List files in folder
      const listResult = await localDrive.listFiles('test-folder')
      expect(listResult.success).toBe(true)
      expect(listResult.files!.length).toBe(1)
      expect(listResult.files![0].name).toBe('folder-test.txt')
    })
  })

  describe('GoogleDriveService', () => {
    let googleDrive: GoogleDriveService

    beforeEach(() => {
      googleDrive = new GoogleDriveService()
    })

    it('should initialize', () => {
      expect(googleDrive).toBeInstanceOf(GoogleDriveService)
      expect(googleDrive.getServiceType()).toBe('Google Drive')
    })

    it('should test connection', async () => {
      const connection = await googleDrive.testConnection()

      // Connection will fail without credentials, which is expected
      if (googleDrive.isAuthenticated()) {
        expect(connection.connected).toBe(true)
      } else {
        expect(connection.connected).toBe(false)
        expect(connection.message).toContain('not authenticated')
      }
    })

    it('should handle operations without authentication', async () => {
      if (!googleDrive.isAuthenticated()) {
        const uploadResult = await googleDrive.uploadFile('test.txt', Buffer.from('test'), 'text/plain')
        expect(uploadResult.success).toBe(false)
        expect(uploadResult.error).toContain('not authenticated')

        const downloadResult = await googleDrive.downloadFile('fake-id')
        expect(downloadResult.success).toBe(false)
        expect(downloadResult.error).toContain('not authenticated')

        const listResult = await googleDrive.listFiles()
        expect(listResult.success).toBe(false)
        expect(listResult.error).toContain('not authenticated')
      }
    })
  })

  describe('DriveServiceFactory', () => {
    beforeEach(() => {
      // Reset factory instance before each test
      DriveServiceFactory.resetInstance()
    })

    afterEach(() => {
      DriveServiceFactory.resetInstance()
    })

    it('should default to local storage', () => {
      // Clear environment variables
      delete process.env.DRIVE_TYPE
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS

      const driveType = DriveServiceFactory.getCurrentDriveType()
      expect(driveType).toBe(DriveType.LOCAL)
    })

    it('should use Google Drive when explicitly set', () => {
      process.env.DRIVE_TYPE = 'google'

      const driveType = DriveServiceFactory.getCurrentDriveType()
      expect(driveType).toBe(DriveType.GOOGLE_DRIVE)

      delete process.env.DRIVE_TYPE
    })

    it('should use local storage when explicitly set', () => {
      process.env.DRIVE_TYPE = 'local'

      const driveType = DriveServiceFactory.getCurrentDriveType()
      expect(driveType).toBe(DriveType.LOCAL)

      delete process.env.DRIVE_TYPE
    })

    it('should create local drive service by default', () => {
      const service = DriveServiceFactory.getDriveService()
      expect(service.getServiceType()).toBe('Local File System')
      expect(service.isAuthenticated()).toBe(true)
    })

    it('should create Google Drive service when configured', () => {
      process.env.DRIVE_TYPE = 'google'

      const service = DriveServiceFactory.getDriveService()
      expect(service.getServiceType()).toBe('Google Drive')

      delete process.env.DRIVE_TYPE
    })

    it('should return same instance on multiple calls', () => {
      const service1 = DriveServiceFactory.getDriveService()
      const service2 = DriveServiceFactory.getDriveService()

      expect(service1).toBe(service2)
    })

    it('should create new instance after reset', () => {
      const service1 = DriveServiceFactory.getDriveService()
      DriveServiceFactory.resetInstance()
      const service2 = DriveServiceFactory.getDriveService()

      expect(service1).not.toBe(service2)
    })

    it('should provide service information', () => {
      const info = DriveServiceFactory.getServiceInfo()

      expect(info).toHaveProperty('type')
      expect(info).toHaveProperty('serviceType')
      expect(info).toHaveProperty('isAuthenticated')
      expect(typeof info.isAuthenticated).toBe('boolean')
    })
  })

  describe('Cross-Service Compatibility', () => {
    it('should have consistent interfaces', async () => {
      const localDrive = new LocalDriveService()
      const googleDrive = new GoogleDriveService()

      // Both should have the same interface methods
      const methods = [
        'testConnection',
        'uploadFile',
        'downloadFile',
        'listFiles',
        'deleteFile',
        'getFileMetadata',
        'isAuthenticated',
        'getServiceType'
      ]

      methods.forEach(method => {
        expect(typeof localDrive[method]).toBe('function')
        expect(typeof googleDrive[method]).toBe('function')
      })
    })

    it('should return consistent result structures', async () => {
      const localDrive = new LocalDriveService()

      // Test upload result structure
      const uploadResult = await localDrive.uploadFile('test.txt', Buffer.from('test'), 'text/plain')
      expect(uploadResult).toHaveProperty('success')
      if (uploadResult.success) {
        expect(uploadResult).toHaveProperty('fileId')
      } else {
        expect(uploadResult).toHaveProperty('error')
      }

      // Test download result structure
      const downloadResult = await localDrive.downloadFile('fake-id')
      expect(downloadResult).toHaveProperty('success')
      if (downloadResult.success) {
        expect(downloadResult).toHaveProperty('data')
      } else {
        expect(downloadResult).toHaveProperty('error')
      }
    })
  })

  describe('CI/CD Compatibility', () => {
    beforeEach(() => {
      DriveServiceFactory.resetInstance()
    })

    it('should work without Google Drive credentials', () => {
      // Ensure no Google Drive credentials are available
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.DRIVE_TYPE

      const service = DriveServiceFactory.getDriveService()
      expect(service.getServiceType()).toBe('Local File System')
      expect(service.isAuthenticated()).toBe(true)
    })

    it('should handle missing local storage directory', async () => {
      const invalidPath = '/nonexistent/path/that/does/not/exist'
      const localDrive = new LocalDriveService(invalidPath)

      // Should still work even with invalid path
      const connection = await localDrive.testConnection()
      expect(connection.connected).toBe(false)
      expect(connection.message).toContain('not accessible')
    })

    it('should be testable in isolation', async () => {
      const localDrive = new LocalDriveService()

      // Should be able to run tests without external dependencies
      const connection = await localDrive.testConnection()
      expect(connection.connected).toBe(true)

      // Should be able to upload and download without external services
      const testData = Buffer.from('CI test data')
      const uploadResult = await localDrive.uploadFile('ci-test.txt', testData, 'text/plain')
      expect(uploadResult.success).toBe(true)

      if (uploadResult.fileId) {
        const downloadResult = await localDrive.downloadFile(uploadResult.fileId)
        expect(downloadResult.success).toBe(true)
        expect(downloadResult.data).toEqual(testData)
      }
    })
  })
})