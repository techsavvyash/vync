import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { syncRoutes } from './routes/sync'
import { GoogleDriveService } from './services/googleDrive'
import { FileWatcherService } from './services/fileWatcher'
import { ConflictDetectorService } from './services/conflictDetector'
import { DriveServiceFactory } from './services/drive/DriveServiceFactory'

console.log('🔍 SERVER STARTUP: Checking DriveServiceFactory...')
console.log('DRIVE_TYPE:', process.env.DRIVE_TYPE)
console.log('LOCAL_STORAGE_PATH:', process.env.LOCAL_STORAGE_PATH)

// Initialize services
const googleDriveService = new GoogleDriveService()
const fileWatcherService = new FileWatcherService()
const conflictDetectorService = new ConflictDetectorService()

const app = new Elysia()
  .use(cors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }))
  .state('googleDrive', googleDriveService)
  .state('fileWatcher', fileWatcherService)
  .state('conflictDetector', conflictDetectorService)
  .get('/', () => 'Obsidian Sync Server is running!')
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    googleDriveAuthenticated: googleDriveService.isAuthenticated(),
    watchedFiles: fileWatcherService.getWatchedFiles().length,
    pendingConflicts: conflictDetectorService.getConflictStats().pending
  }))
  .use(syncRoutes)
  .listen(3000)

console.log(`🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`)

export type App = typeof app