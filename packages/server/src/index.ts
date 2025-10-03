import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { syncRoutes } from './routes/sync'
import { authRoutes } from './routes/auth'
import { FileWatcherService } from './services/fileWatcher'
import { ConflictDetectorService } from './services/conflictDetector'
import { DriveServiceFactory } from './services/drive/DriveServiceFactory'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

console.log('🔍 SERVER STARTUP: Initializing services...')
console.log('DRIVE_TYPE:', process.env.DRIVE_TYPE)
console.log('LOCAL_STORAGE_PATH:', process.env.LOCAL_STORAGE_PATH)
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not set')
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Not set')

// Initialize services using factory pattern
const driveService = DriveServiceFactory.getDriveService()
const fileWatcherService = new FileWatcherService()
const conflictDetectorService = new ConflictDetectorService()

const app = new Elysia()
  .use(cors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }))
  .state('driveService', driveService)
  .state('fileWatcher', fileWatcherService)
  .state('conflictDetector', conflictDetectorService)
  .get('/', () => 'Obsidian Sync Server is running!')
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    driveService: driveService.getServiceType(),
    driveAuthenticated: driveService.isAuthenticated(),
    watchedFiles: fileWatcherService.getWatchedFiles().length,
    pendingConflicts: conflictDetectorService.getConflictStats().pending
  }))
  .use(authRoutes)
  .use(syncRoutes)
  .listen(3000)

console.log(`🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`)

export type App = typeof app