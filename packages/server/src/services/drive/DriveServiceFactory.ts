import { IDriveService } from './IDriveService'
import { GoogleDriveService } from './GoogleDriveService'
import { LocalDriveService } from './LocalDriveService'

export enum DriveType {
  GOOGLE_DRIVE = 'google',
  LOCAL = 'local'
}

export class DriveServiceFactory {
  private static instance: IDriveService | null = null

  /**
   * Get the configured drive service instance
   */
  public static getDriveService(): IDriveService {
    if (!this.instance) {
      this.instance = this.createDriveService()
    }
    return this.instance
  }

  /**
   * Create a new drive service instance based on configuration
   */
  private static createDriveService(): IDriveService {
    const driveType = this.getDriveTypeFromEnvironment()

    switch (driveType) {
      case DriveType.GOOGLE_DRIVE:
        console.log('Using Google Drive service')
        return new GoogleDriveService()

      case DriveType.LOCAL:
        const storagePath = process.env.LOCAL_STORAGE_PATH || './local-storage'
        console.log(`Using Local Drive service with path: ${storagePath}`)
        return new LocalDriveService(storagePath)

      default:
        console.warn(`Unknown drive type: ${driveType}, falling back to local storage`)
        return new LocalDriveService()
    }
  }

  /**
   * Determine drive type from environment variables
   */
  private static getDriveTypeFromEnvironment(): DriveType {
    console.log('🔍 SERVER STARTUP: Checking DriveServiceFactory...')
    console.log('DRIVE_TYPE:', process.env.DRIVE_TYPE)
    console.log('LOCAL_STORAGE_PATH:', process.env.LOCAL_STORAGE_PATH)
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'NOT SET')
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET')

    // Check for explicit drive type setting
    const driveTypeEnv = process.env.DRIVE_TYPE?.toLowerCase()

    if (driveTypeEnv === 'google' || driveTypeEnv === 'googledrive') {
      console.log('🔍 SERVER STARTUP: Explicitly set to Google Drive')
      return DriveType.GOOGLE_DRIVE
    }

    if (driveTypeEnv === 'local' || driveTypeEnv === 'filesystem') {
      console.log('🔍 SERVER STARTUP: Explicitly set to Local Storage')
      return DriveType.LOCAL
    }

    // Auto-detect based on available credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.GOOGLE_CLIENT_ID ||
        this.hasCredentialsFile()) {
      console.log('🔍 SERVER STARTUP: Google credentials detected, using Google Drive')
      return DriveType.GOOGLE_DRIVE
    }

    // Default to local storage
    console.log('🔍 SERVER STARTUP: Defaulting to Local Storage')
    return DriveType.LOCAL
  }

  /**
   * Check if Google Drive credentials file exists
   */
  private static hasCredentialsFile(): boolean {
    try {
      const fs = require('fs')
      const path = require('path')
      const credentialsPath = path.join(process.cwd(), 'credentials.json')
      return fs.existsSync(credentialsPath)
    } catch {
      return false
    }
  }

  /**
   * Reset the service instance (useful for testing)
   */
  public static resetInstance(): void {
    this.instance = null
  }

  /**
   * Get current drive type
   */
  public static getCurrentDriveType(): DriveType {
    return this.getDriveTypeFromEnvironment()
  }

  /**
   * Get service information
   */
  public static getServiceInfo(): {
    type: DriveType
    serviceType: string
    isAuthenticated: boolean
  } {
    const service = this.getDriveService()
    return {
      type: this.getCurrentDriveType(),
      serviceType: service.getServiceType(),
      isAuthenticated: service.isAuthenticated()
    }
  }
}