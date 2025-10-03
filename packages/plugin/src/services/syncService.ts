import { Vault, TFile, normalizePath } from 'obsidian'
import { SyncStateManager } from './syncState'
import { VaultScanner } from './vaultScanner'
import { GoogleDriveAuthService } from './googleDriveAuth'
import { GoogleDriveService, DriveFile } from './googleDriveService'

export interface SyncResult {
  success: boolean
  message: string
  uploadedFiles?: number
  downloadedFiles?: number
  conflicts?: number
  skippedFiles?: number
}

export interface SyncFile {
  path: string
  content: string | ArrayBuffer
  size: number
  hash: string
  isBinary: boolean
  mtime: number
}

export interface FileSyncState {
  path: string
  lastSyncedHash: string
  lastSyncedTime: number
  lastSyncedSize: number
  remoteFileId?: string
}

export interface DownloadCandidate {
  id: string
  filePath: string
  reason: string
  remoteMtime: number
  remoteSize: number
}

export interface UploadCandidate {
  filePath: string
  reason: string
  localMtime: number
  localSize: number
}

export interface ConflictCandidate {
  filePath: string
  localMtime: number
  remoteMtime: number
  localHash: string
  remoteFileId: string
}

export interface SyncDelta {
  toDownload: DownloadCandidate[]
  toUpload: UploadCandidate[]
  conflicts: ConflictCandidate[]
  inSync: number
  totalRemote: number
  totalLocal: number
}

// Serverless sync service that communicates directly with Google Drive
export class SyncService {
	private vaultId: string
	private vault: Vault
	private syncStateManager?: SyncStateManager
	private vaultScanner: VaultScanner
	private driveService: GoogleDriveService

	constructor(
		vaultId: string,
		vault: Vault,
		authService: GoogleDriveAuthService,
		syncStateManager?: SyncStateManager
	) {
		this.vaultId = vaultId
		this.vault = vault
		this.syncStateManager = syncStateManager
		this.vaultScanner = new VaultScanner(vault)
		this.driveService = new GoogleDriveService(authService)
	}

	async syncVault(): Promise<SyncResult> {
		try {
			console.log(`\n🔄 Starting delta sync for vault: ${this.vaultId}`)

			// Get local index state
			if (!this.syncStateManager) {
				console.warn('⚠️  No sync state manager - cannot sync without it')
				return {
					success: false,
					message: 'No sync state manager available'
				}
			}

			const localState = this.syncStateManager.getState()
			console.log(`📋 Local index: ${Object.keys(localState.files).length} file(s)`)

			// Filter local index to only include files that actually exist locally OR were actually synced
			const validLocalFiles = new Map<string, FileSyncState>()
			for (const [filePath, fileState] of localState.files.entries()) {
				const fileExists = this.vault.getAbstractFileByPath(filePath) !== null

				// Include file in index if:
				// 1. It exists locally, OR
				// 2. It was actually synced before (has real hash and mtime)
				if (fileExists || (fileState.lastSyncedHash && fileState.lastSyncedHash !== '' && fileState.lastSyncedTime > 0)) {
					validLocalFiles.set(filePath, fileState)
				} else {
					console.log(`⏭️  Excluding stale index entry: ${filePath} (doesn't exist locally)`)
				}
			}

			console.log(`📋 Valid local files for sync: ${validLocalFiles.size} file(s)`)

			// IMPORTANT: Scan vault for files NOT in the index (new files)
			console.log('🔍 Scanning vault for new files not in index...')
			const vaultFiles = await this.vaultScanner.scanVault({
				includeExtensions: ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg'],
				recursive: true
			})

			let newFilesFound = 0
			for (const vaultFile of vaultFiles) {
				if (vaultFile.isFolder) continue

				if (!validLocalFiles.has(vaultFile.path)) {
					// This is a new file not in the index - add it with empty state
					console.log(`  📄 Found new file: ${vaultFile.path}`)
					validLocalFiles.set(vaultFile.path, {
						path: vaultFile.path,
						lastSyncedHash: '', // Empty = never synced
						lastSyncedTime: 0,
						lastSyncedSize: 0,
						remoteFileId: undefined
					})
					newFilesFound++
				}
			}

			if (newFilesFound > 0) {
				console.log(`✅ Added ${newFilesFound} new file(s) to sync index`)
			}

			// Calculate delta (moved from server to client)
			console.log('🔍 Calculating delta...')
			const delta = await this.calculateDelta(validLocalFiles)

			console.log('\n📊 Delta calculated:')
			console.log(`  To Download: ${delta.toDownload.length}`)
			console.log(`  To Upload: ${delta.toUpload.length}`)
			console.log(`  Conflicts: ${delta.conflicts.length}`)
			console.log(`  In Sync: ${delta.inSync}`)

			// Process uploads
			let uploadedCount = 0
			if (delta.toUpload.length > 0) {
				console.log(`\n📤 Uploading ${delta.toUpload.length} file(s)...`)
				for (const fileInfo of delta.toUpload) {
					try {
						const file = this.vault.getAbstractFileByPath(fileInfo.filePath)
						if (file instanceof TFile) {
							await this.uploadSingleFile(file)
							uploadedCount++
							console.log(`  ✅ Uploaded: ${fileInfo.filePath} (${fileInfo.reason})`)
						}
					} catch (error) {
						console.error(`  ❌ Failed to upload ${fileInfo.filePath}:`, error)
					}
				}
			}

			// Process downloads
			let downloadedCount = 0
			if (delta.toDownload.length > 0) {
				console.log(`\n📥 Downloading ${delta.toDownload.length} file(s)...`)
				for (const fileInfo of delta.toDownload) {
					try {
						await this.downloadSingleFile(fileInfo)
						downloadedCount++
						console.log(`  ✅ Downloaded: ${fileInfo.filePath} (${fileInfo.reason})`)
					} catch (error) {
						console.error(`  ❌ Failed to download ${fileInfo.filePath}:`, error)
					}
				}
			}

			// Handle conflicts
			if (delta.conflicts.length > 0) {
				console.log(`\n⚠️  ${delta.conflicts.length} conflict(s) detected`)
				for (const conflict of delta.conflicts) {
					console.log(`  ⚠️  ${conflict.filePath}`)
					this.syncStateManager.markConflict(conflict.filePath)
				}
			}

			// Mark sync completed
			this.syncStateManager.markFullSyncCompleted()
			this.syncStateManager.markRemoteCheckCompleted()

			console.log('\n✅ Delta sync completed')

			return {
				success: true,
				message: 'Sync completed successfully',
				uploadedFiles: uploadedCount,
				downloadedFiles: downloadedCount,
				conflicts: delta.conflicts.length,
				skippedFiles: delta.inSync
			}

		} catch (error) {
			console.error('Sync failed:', error)
			return {
				success: false,
				message: `Sync failed: ${error}`
			}
		}
	}

	/**
	 * Calculate sync delta between local and remote files
	 * This logic was moved from the server
	 */
	private async calculateDelta(localFilesMap: Map<string, FileSyncState>): Promise<SyncDelta> {
		// Fetch all files from Google Drive
		console.log('  📥 Fetching remote files from Google Drive...')
		const listResult = await this.driveService.listFiles(this.vaultId)

		if (!listResult.success) {
			throw new Error(`Failed to list files: ${listResult.error}`)
		}

		const remoteFiles = listResult.files || []
		console.log('  ✅ Remote files:', remoteFiles.length)

		// Build maps for efficient lookup
		const remoteFilesMap = new Map<string, DriveFile>()
		for (const file of remoteFiles) {
			remoteFilesMap.set(file.name, file)
		}

		// Calculate delta
		const toDownload: DownloadCandidate[] = []
		const toUpload: UploadCandidate[] = []
		const conflicts: ConflictCandidate[] = []
		let inSync = 0

		console.log('\n  🔍 Analyzing differences...')

		// Check each remote file
		for (const remoteFile of remoteFiles) {
			const filePath = remoteFile.name
			const localFile = localFilesMap.get(filePath)
			const remoteMtime = new Date(remoteFile.modifiedTime).getTime()

			if (!localFile) {
				// File exists in Drive but not in local index
				console.log(`  📥 Missing local: ${filePath}`)
				toDownload.push({
					id: remoteFile.id,
					filePath,
					reason: 'missing_local',
					remoteMtime,
					remoteSize: remoteFile.size
				})
			} else {
				// File exists in both - check if sync needed
				const localMtime = localFile.lastSyncedTime

				// Check if this is the same file (by remote ID)
				if (localFile.remoteFileId === remoteFile.id) {
					// Same file - check modification times
					if (remoteMtime > localMtime) {
						// Check if local also changed since last sync (would need current hash)
						// For now, just download if remote is newer
						console.log(`  📥 Remote newer: ${filePath}`)
						toDownload.push({
							id: remoteFile.id,
							filePath,
							reason: 'remote_newer',
							remoteMtime,
							remoteSize: remoteFile.size
						})
					} else if (localMtime > remoteMtime) {
						// Local is newer - should upload
						console.log(`  📤 Local newer: ${filePath}`)
						toUpload.push({
							filePath,
							reason: 'local_newer',
							localMtime,
							localSize: localFile.lastSyncedSize
						})
					} else {
						// Same mtime - in sync
						inSync++
					}
				} else {
					// Different file ID or no remote ID - check timestamps
					if (remoteMtime > localMtime) {
						console.log(`  📥 Remote newer (different ID): ${filePath}`)
						toDownload.push({
							id: remoteFile.id,
							filePath,
							reason: 'remote_newer',
							remoteMtime,
							remoteSize: remoteFile.size
						})
					} else {
						inSync++
					}
				}
			}
		}

		// Check for local files not in remote
		for (const [filePath, localFile] of localFilesMap.entries()) {
			const remoteFile = remoteFilesMap.get(filePath)

			if (!remoteFile) {
				// File exists locally but not in Drive

				// Skip if this is a remote-only tracking entry
				if (localFile.lastSyncedTime === 0 && localFile.lastSyncedHash === '') {
					console.log(`  ⏭️  Skipping remote-only tracking entry: ${filePath}`)
					continue
				}

				if (!localFile.remoteFileId) {
					// Never synced before
					console.log(`  📤 New local file: ${filePath}`)
					toUpload.push({
						filePath,
						reason: 'never_synced',
						localMtime: localFile.lastSyncedTime,
						localSize: localFile.lastSyncedSize
					})
				} else {
					// Was synced but deleted from remote
					console.log(`  📤 Missing remote (was synced): ${filePath}`)
					toUpload.push({
						filePath,
						reason: 'missing_remote',
						localMtime: localFile.lastSyncedTime,
						localSize: localFile.lastSyncedSize
					})
				}
			}
		}

		const delta: SyncDelta = {
			toDownload,
			toUpload,
			conflicts,
			inSync,
			totalRemote: remoteFiles.length,
			totalLocal: localFilesMap.size
		}

		console.log('\n  📊 Delta Summary:')
		console.log(`    To Download: ${toDownload.length}`)
		console.log(`    To Upload: ${toUpload.length}`)
		console.log(`    Conflicts: ${conflicts.length}`)
		console.log(`    In Sync: ${inSync}`)
		console.log(`    Total Remote: ${delta.totalRemote}`)
		console.log(`    Total Local: ${delta.totalLocal}`)

		return delta
	}


	private isBinaryFile(extension: string): boolean {
		const binaryExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'mp3', 'wav']
		return binaryExtensions.includes(extension.toLowerCase())
	}

	private async computeHash(content: string | ArrayBuffer): Promise<string> {
		const encoder = new TextEncoder()
		const data = content instanceof ArrayBuffer
			? new Uint8Array(content)
			: encoder.encode(content)

		const hashBuffer = await crypto.subtle.digest('SHA-256', data)
		const hashArray = Array.from(new Uint8Array(hashBuffer))
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
	}

	// Helper function to ensure parent folders exist before creating a file
	private async ensureParentFoldersExist(filePath: string): Promise<void> {
		const normalizedPath = normalizePath(filePath)
		const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))

		if (parentPath && !this.vault.getAbstractFileByPath(parentPath)) {
			// Create parent directories recursively
			const parts = parentPath.split('/')
			let currentPath = ''
			for (const part of parts) {
				currentPath = currentPath ? `${currentPath}/${part}` : part
				if (!this.vault.getAbstractFileByPath(currentPath)) {
					await this.vault.createFolder(currentPath)
					console.log(`  📁 Created folder: ${currentPath}`)
				}
			}
		}
	}

	// Method to trigger sync on file changes
	async syncOnChange(changedFiles: string[]): Promise<void> {
		console.log(`Sync triggered by changes to: ${changedFiles.join(', ')}`)

		// For now, do a full sync. In the future, we could optimize to only sync changed files
		await this.syncVault()
	}

	// Method to handle individual file creation events
	async handleFileCreation(filePath: string): Promise<void> {
		console.log(`🆕 Handling new file creation: ${filePath}`)

		try {
			const file = this.vault.getAbstractFileByPath(filePath)
			if (!(file instanceof TFile)) {
				console.log(`  ⚠️ Not a valid file: ${filePath}`)
				return
			}

			// Check if it's a relevant file type
			const extension = file.extension
			const relevantExtensions = ['md', 'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg']
			if (!relevantExtensions.includes(extension.toLowerCase())) {
				console.log(`  ⏭️ Skipping non-relevant file type: ${extension}`)
				return
			}

			// Add to index with empty sync state (will be uploaded on next sync)
			if (this.syncStateManager) {
				// Add file to index with empty state to mark it for upload
				const fileState = {
					path: filePath,
					lastSyncedHash: '', // Empty = never synced
					lastSyncedTime: 0,
					lastSyncedSize: 0,
					remoteFileId: undefined
				}

				// Update the sync state manager's internal state
				this.syncStateManager.getState().files.set(filePath, fileState)
				console.log(`  ✅ Added new file to sync index: ${filePath}`)

				// Immediately upload the new file
				await this.uploadSingleFile(file)
				console.log(`  ✅ Uploaded new file: ${filePath}`)
			}
		} catch (error) {
			console.error(`  ❌ Failed to handle file creation for ${filePath}:`, error)
		}
	}

	// Method to handle individual file modification events
	async handleFileModification(filePath: string): Promise<void> {
		console.log(`📝 Handling file modification: ${filePath}`)

		try {
			const file = this.vault.getAbstractFileByPath(filePath)
			if (!(file instanceof TFile)) {
				console.log(`  ⚠️ Not a valid file: ${filePath}`)
				return
			}

			// Check if it's a relevant file type
			const extension = file.extension
			const relevantExtensions = ['md', 'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg']
			if (!relevantExtensions.includes(extension.toLowerCase())) {
				console.log(`  ⏭️ Skipping non-relevant file type: ${extension}`)
				return
			}

			// Check if file needs sync
			if (this.syncStateManager) {
				const isBinary = this.isBinaryFile(extension)
				const content = isBinary ? await this.vault.readBinary(file) : await this.vault.read(file)
				const hash = await this.computeHash(content)

				const needsSync = this.syncStateManager.needsSync(
					filePath,
					hash,
					file.stat.mtime,
					file.stat.size
				)

				if (needsSync) {
					// Upload the modified file immediately
					await this.uploadSingleFile(file)
					console.log(`  ✅ Uploaded modified file: ${filePath}`)
				} else {
					console.log(`  ⏭️ File unchanged, skipping: ${filePath}`)
				}
			}
		} catch (error) {
			console.error(`  ❌ Failed to handle file modification for ${filePath}:`, error)
		}
	}

	// Method to handle file deletion events
	async handleFileDeletion(filePath: string): Promise<void> {
		console.log(`🗑️ Handling file deletion: ${filePath}`)

		try {
			if (this.syncStateManager) {
				// Remove from local index
				this.syncStateManager.removeFile(filePath)
				console.log(`  ✅ Removed file from sync index: ${filePath}`)

				// TODO: Also delete from Google Drive if needed
				// This would require implementing a delete endpoint on the server
			}
		} catch (error) {
			console.error(`  ❌ Failed to handle file deletion for ${filePath}:`, error)
		}
	}

	// Method to handle folder creation events
	async handleFolderCreation(folderPath: string): Promise<void> {
		console.log(`📁 Handling folder creation: ${folderPath}`)

		try {
			if (this.syncStateManager) {
				// Get folder metadata
				const metadata = await this.vaultScanner.getFileMetadata(folderPath)

				if (metadata && metadata.isFolder) {
					// Track folder in index
					this.syncStateManager.trackFolder(
						folderPath,
						metadata.mtime,
						0, // File count will be updated separately
						0, // Subfolder count will be updated separately
						undefined // No remote ID yet - will be assigned when files are uploaded
					)
					console.log(`  ✅ Added folder to sync index: ${folderPath}`)

					// Note: The actual folder creation in Google Drive happens automatically
					// when files are uploaded with the folder path
				}
			}
		} catch (error) {
			console.error(`  ❌ Failed to handle folder creation for ${folderPath}:`, error)
		}
	}

	// Method to handle folder deletion events
	async handleFolderDeletion(folderPath: string): Promise<void> {
		console.log(`🗑️ Handling folder deletion: ${folderPath}`)

		try {
			if (this.syncStateManager) {
				// Remove folder from index
				this.syncStateManager.removeFolder(folderPath)
				console.log(`  ✅ Removed folder from sync index: ${folderPath}`)

				// Also remove all files within the folder from the index
				const files = this.syncStateManager.getState().files
				const filesToRemove: string[] = []

				files.forEach((fileState, filePath) => {
					if (filePath.startsWith(folderPath + '/')) {
						filesToRemove.push(filePath)
					}
				})

				for (const filePath of filesToRemove) {
					this.syncStateManager.removeFile(filePath)
					console.log(`  ✅ Removed file from sync index: ${filePath}`)
				}

				// TODO: Also delete from Google Drive if needed
			}
		} catch (error) {
			console.error(`  ❌ Failed to handle folder deletion for ${folderPath}:`, error)
		}
	}

	// Method to handle folder rename events
	async handleFolderRename(oldPath: string, newPath: string): Promise<void> {
		console.log(`📝 Handling folder rename: ${oldPath} → ${newPath}`)

		try {
			if (this.syncStateManager) {
				// Rename folder in index
				this.syncStateManager.renameFolder(oldPath, newPath)
				console.log(`  ✅ Updated folder path in sync index`)

				// The syncStateManager.renameFolder method already handles updating all child files
			}
		} catch (error) {
			console.error(`  ❌ Failed to handle folder rename from ${oldPath} to ${newPath}:`, error)
		}
	}

	// Method to reconcile index with actual vault files
	// This ensures any files created outside of Obsidian events are tracked
	async reconcileIndex(): Promise<number> {
		console.log('🔍 Reconciling sync index with vault files and folders...')

		if (!this.syncStateManager) {
			console.warn('  ⚠️ No sync state manager available')
			return 0
		}

		try {
			// Scan vault for all relevant files AND folders
			const vaultFiles = await this.vaultScanner.scanVault({
				includeExtensions: ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg'],
				recursive: true
			})

			const currentIndex = this.syncStateManager.getState().files
			const folderIndex = this.syncStateManager.getState().folders
			let newFilesFound = 0
			let newFoldersFound = 0
			let staleEntriesRemoved = 0

			// Process folders first to ensure directory structure exists
			for (const vaultItem of vaultFiles) {
				if (vaultItem.isFolder) {
					// Track folder in index
					if (!folderIndex.has(vaultItem.path)) {
						console.log(`  📁 Found untracked folder: ${vaultItem.path}`)
						this.syncStateManager.trackFolder(
							vaultItem.path,
							vaultItem.mtime,
							0, // Will be updated later
							0, // Will be updated later
							undefined // No remote ID yet
						)
						newFoldersFound++
					}
					continue
				}

				if (!currentIndex.has(vaultFile.path)) {
					console.log(`  📄 Found untracked file: ${vaultFile.path}`)

					// Add to index with empty state (will be uploaded on next sync)
					currentIndex.set(vaultFile.path, {
						path: vaultFile.path,
						lastSyncedHash: '', // Empty = never synced
						lastSyncedTime: 0,
						lastSyncedSize: 0,
						remoteFileId: undefined
					})
					newFilesFound++

					// Immediately upload the file
					try {
						const file = this.vault.getAbstractFileByPath(vaultFile.path)
						if (file instanceof TFile) {
							await this.uploadSingleFile(file)
							console.log(`    ✅ Uploaded untracked file: ${vaultFile.path}`)
						}
					} catch (error) {
						console.error(`    ❌ Failed to upload untracked file ${vaultFile.path}:`, error)
					}
				}
			}

			// Check for stale entries in index (files that no longer exist)
			const vaultFilePaths = new Set(vaultFiles.filter(f => !f.isFolder).map(f => f.path))
			const indexPaths = Array.from(currentIndex.keys())

			for (const indexPath of indexPaths) {
				if (!vaultFilePaths.has(indexPath)) {
					// File exists in index but not in vault
					const fileState = currentIndex.get(indexPath)

					// Only remove if it doesn't have a remote file ID (hasn't been synced)
					// or if we're sure it's been deleted locally
					if (!fileState?.remoteFileId || fileState?.lastSyncedHash === '') {
						console.log(`  🗑️ Removing stale index entry: ${indexPath}`)
						this.syncStateManager.removeFile(indexPath)
						staleEntriesRemoved++
					} else {
						// File has been synced before but is missing locally
						// This might be a file that should be downloaded
						console.log(`  ⚠️ File in index but not in vault (may need download): ${indexPath}`)
					}
				}
			}

			if (newFilesFound > 0 || newFoldersFound > 0 || staleEntriesRemoved > 0) {
				console.log(`✅ Index reconciliation complete:`)
				console.log(`   - ${newFilesFound} new file(s) added to index`)
				console.log(`   - ${newFoldersFound} new folder(s) tracked`)
				console.log(`   - ${staleEntriesRemoved} stale entries removed`)
			} else {
				console.log('✅ Index is in sync with vault')
			}

			return newFilesFound
		} catch (error) {
			console.error('❌ Failed to reconcile index:', error)
			return 0
		}
	}

	// Upload a single file to Google Drive
	private async uploadSingleFile(file: TFile): Promise<void> {
		const isBinary = this.isBinaryFile(file.extension)
		const content = isBinary ? await this.vault.readBinary(file) : await this.vault.read(file)
		const hash = await this.computeHash(content)

		// Determine MIME type
		const mimeType = this.getMimeType(file.extension)

		// Convert content to ArrayBuffer if it's a string
		let fileData: ArrayBuffer
		if (isBinary) {
			fileData = content as ArrayBuffer
		} else {
			const encoder = new TextEncoder()
			fileData = encoder.encode(content as string).buffer
		}

		// Upload to Google Drive
		const result = await this.driveService.uploadFile(
			file.path,
			fileData,
			mimeType,
			this.vaultId
		)

		if (result.success && this.syncStateManager) {
			const metadata = await this.vaultScanner.getFileMetadata(file.path)
			this.syncStateManager.markSynced(
				file.path,
				hash,
				file.stat.mtime,
				file.stat.size,
				result.fileId,
				{
					ctime: metadata?.ctime,
					extension: metadata?.extension,
					operation: 'upload'
				}
			)
		} else {
			if (this.syncStateManager) {
				this.syncStateManager.markSyncError(file.path, result.error || 'Unknown error', 'upload')
			}
			throw new Error(`Upload failed: ${result.error}`)
		}
	}

	// Download a single file from Google Drive
	private async downloadSingleFile(fileInfo: DownloadCandidate): Promise<void> {
		const result = await this.driveService.downloadFile(fileInfo.id)

		if (!result.success || !result.data) {
			throw new Error(`Download failed: ${result.error}`)
		}

		const normalizedPath = normalizePath(fileInfo.filePath)
		const existingFile = this.vault.getAbstractFileByPath(normalizedPath)
		const extension = normalizedPath.substring(normalizedPath.lastIndexOf('.')).slice(1)
		const isBinary = this.isBinaryFile(extension)
		const fileData = result.data

		// Write file
		if (existingFile instanceof TFile) {
			// Update existing file
			if (isBinary) {
				await this.vault.modifyBinary(existingFile, fileData)
			} else {
				const textContent = new TextDecoder().decode(fileData)
				await this.vault.modify(existingFile, textContent)
			}
		} else {
			// Create new file (ensure parent directories exist)
			await this.ensureParentFoldersExist(normalizedPath)

			if (isBinary) {
				await this.vault.createBinary(normalizedPath, fileData)
			} else {
				const textContent = new TextDecoder().decode(fileData)
				await this.vault.create(normalizedPath, textContent)
			}
		}

		// Update sync state
		if (this.syncStateManager) {
			const file = this.vault.getAbstractFileByPath(normalizedPath)
			if (file instanceof TFile) {
				const content = isBinary ? await this.vault.readBinary(file) : await this.vault.read(file)
				const hash = await this.computeHash(content)
				const metadata = await this.vaultScanner.getFileMetadata(normalizedPath)

				this.syncStateManager.markSynced(
					normalizedPath,
					hash,
					file.stat.mtime,
					file.stat.size,
					fileInfo.id,
					{
						ctime: metadata?.ctime,
						extension: metadata?.extension,
						operation: 'download'
					}
				)
			}
		}
	}

	// Get MIME type based on file extension
	private getMimeType(extension: string): string {
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
		return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
	}
}