import { Vault, TFile, normalizePath } from 'obsidian'
import { SyncStateManager } from './syncState'
import { VaultScanner } from './vaultScanner'

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

// Client-side sync service that communicates with the server
export class SyncService {
	private serverUrl: string
	private vaultId: string
	private vault: Vault
	private syncStateManager?: SyncStateManager
	private vaultScanner: VaultScanner

	constructor(serverUrl: string, vaultId: string, vault: Vault, syncStateManager?: SyncStateManager) {
		this.serverUrl = serverUrl
		this.vaultId = vaultId
		this.vault = vault
		this.syncStateManager = syncStateManager
		this.vaultScanner = new VaultScanner(vault)
	}

	async syncVault(): Promise<SyncResult> {
		try {
			console.log(`\n🔄 Starting delta sync for vault: ${this.vaultId}`)

			// Get local index state
			if (!this.syncStateManager) {
				console.warn('⚠️  No sync state manager - falling back to basic sync')
				return await this.syncVaultLegacy()
			}

			const localState = this.syncStateManager.getState()
			console.log(`📋 Local index: ${Object.keys(localState.files).length} file(s)`)

			// Filter local index to only include files that actually exist locally OR were actually synced
			// This prevents stale sync-index entries from being sent to the server
			const validLocalFiles = new Map<string, any>()
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

			// Send local index to server for delta calculation
			console.log('📡 Requesting delta from server...')
			const deltaResponse = await fetch(`${this.serverUrl}/sync/delta`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					vaultId: this.vaultId,
					localIndex: {
						files: Object.fromEntries(validLocalFiles)
					}
				})
			})

			if (!deltaResponse.ok) {
				throw new Error(`Delta request failed: ${deltaResponse.statusText}`)
			}

			const deltaResult = await deltaResponse.json()
			if (!deltaResult.success || !deltaResult.delta) {
				throw new Error(`Delta calculation failed: ${deltaResult.message}`)
			}

			const delta = deltaResult.delta
			console.log('\n📊 Delta received from server:')
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
					if (this.syncStateManager) {
						this.syncStateManager.markConflict(conflict.filePath)
					}
				}
			}

			// Mark sync completed
			if (this.syncStateManager) {
				this.syncStateManager.markFullSyncCompleted()
				this.syncStateManager.markRemoteCheckCompleted()
			}

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

	// Legacy sync method (fallback if no sync state manager)
	private async syncVaultLegacy(): Promise<SyncResult> {
		try {
			console.log('Using legacy sync method')

			const filesToSync = await this.getFilesToSync()
			const uploadResults = filesToSync.length > 0 ? await this.uploadFiles(filesToSync) : []

			const remoteChanges = await this.checkRemoteChanges()
			const downloadResults = await this.downloadFiles(remoteChanges)

			const conflicts = await this.getConflicts()

			return {
				success: true,
				message: 'Sync completed successfully (legacy mode)',
				uploadedFiles: uploadResults.length,
				downloadedFiles: downloadResults.length,
				conflicts: conflicts.length,
				skippedFiles: 0
			}
		} catch (error) {
			console.error('Legacy sync failed:', error)
			return {
				success: false,
				message: `Sync failed: ${error}`
			}
		}
	}

	private async getFilesToSync(): Promise<SyncFile[]> {
		const files: SyncFile[] = []
		const relevantExtensions = ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg']

		try {
			console.log('📂 Scanning vault using efficient vault.adapter methods...')
			const startTime = Date.now()

			// Use VaultScanner for efficient file listing
			const fileMetadata = await this.vaultScanner.scanVault({
				includeExtensions: relevantExtensions,
				recursive: true
			})

			const scanTime = Date.now() - startTime
			console.log(`✅ Scanned ${fileMetadata.length} file(s) in ${scanTime}ms`)

			// Filter to only files (not folders)
			const fileItems = fileMetadata.filter(item => !item.isFolder)

			for (const fileMeta of fileItems) {
				try {
					// Quick check with metadata first (no file read!)
					if (this.syncStateManager) {
						// Check if we can skip based on mtime/size alone
						const fileState = this.syncStateManager.getFileState(fileMeta.path)
						if (fileState &&
							fileState.lastSyncedTime === fileMeta.mtime &&
							fileState.lastSyncedSize === fileMeta.size) {
							console.log(`⏭️  Skipping unchanged file (quick check): ${fileMeta.path}`)
							continue
						}
					}

					// Need to read file for hash check
					const file = this.vault.getAbstractFileByPath(fileMeta.path)
					if (!(file instanceof TFile)) {
						continue
					}

					const isBinary = this.isBinaryFile(file.extension)
					let content: string | ArrayBuffer
					let hash: string

					if (isBinary) {
						content = await this.vault.readBinary(file)
						hash = await this.computeHash(content)
					} else {
						content = await this.vault.read(file)
						hash = await this.computeHash(content)
					}

					// Final check with hash
					if (this.syncStateManager) {
						const needsSync = this.syncStateManager.needsSync(
							fileMeta.path,
							hash,
							fileMeta.mtime,
							fileMeta.size
						)

						if (!needsSync) {
							console.log(`⏭️  Skipping unchanged file (hash check): ${fileMeta.path}`)
							continue
						}
					}

					files.push({
						path: fileMeta.path,
						content,
						size: fileMeta.size,
						hash,
						isBinary,
						mtime: fileMeta.mtime
					})
				} catch (error) {
					console.warn(`Failed to read file ${fileMeta.path}:`, error)
				}
			}
		} catch (error) {
			console.error('Error scanning vault:', error)
		}

		return files
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

	private async uploadFiles(files: SyncFile[]): Promise<any[]> {
		const results: any[] = []

		for (const file of files) {
			try {
				// Convert content to base64 for transmission
				let fileData: string
				if (file.isBinary) {
					// Convert ArrayBuffer to base64
					const bytes = new Uint8Array(file.content as ArrayBuffer)
					fileData = btoa(String.fromCharCode(...bytes))
				} else {
					// Text content - encode to base64 for consistency
					fileData = btoa(unescape(encodeURIComponent(file.content as string)))
				}

				const response = await fetch(`${this.serverUrl}/sync/upload`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						vaultId: this.vaultId,
						filePath: file.path,
						fileData: fileData,
						lastModified: Date.now()
					})
				})

				if (response.ok) {
					const result = await response.json()
					results.push(result)
					console.log(`Uploaded: ${file.path}`)

					// Mark file as synced with enhanced metadata
					if (this.syncStateManager && result.data?.fileId) {
						// Get creation time from vault scanner
						const metadata = await this.vaultScanner.getFileMetadata(file.path)

						this.syncStateManager.markSynced(
							file.path,
							file.hash,
							file.mtime,
							file.size,
							result.data.fileId,
							{
								ctime: metadata?.ctime,
								extension: metadata?.extension,
								operation: 'upload'
							}
						)
					}
				} else if (response.status === 401) {
					throw new Error('Authentication required. Please authenticate with Google Drive in plugin settings.')
				} else {
					console.warn(`Failed to upload ${file.path}:`, response.statusText)
					// Mark error
					if (this.syncStateManager) {
						this.syncStateManager.markSyncError(file.path, response.statusText, 'upload')
					}
				}
			} catch (error) {
				console.error(`Error uploading ${file.path}:`, error)
				// Mark error
				if (this.syncStateManager) {
					this.syncStateManager.markSyncError(file.path, String(error), 'upload')
				}
			}
		}

		return results
	}

	private async checkRemoteChanges(): Promise<any[]> {
		try {
			const response = await fetch(`${this.serverUrl}/sync/metadata/${this.vaultId}`)

			if (response.ok) {
				const metadata = await response.json()
				return metadata.files || []
			} else {
				console.warn('Failed to check remote changes:', response.statusText)
				return []
			}
		} catch (error) {
			console.error('Error checking remote changes:', error)
			return []
		}
	}

	private async downloadFiles(remoteFiles: any[]): Promise<any[]> {
		const results: any[] = []

		console.log(`\n🔍 Checking ${remoteFiles.length} remote file(s) for download...`)

		// Get local index state for comparison
		let localIndexFiles: Set<string> = new Set()
		if (this.syncStateManager) {
			const state = this.syncStateManager.getState()
			localIndexFiles = new Set(state.files.keys())
			console.log(`📋 Local index contains ${localIndexFiles.size} tracked file(s)`)
		}

		for (const remoteFile of remoteFiles) {
			try {
				// Check if we need to download this file
				const normalizedPath = normalizePath(remoteFile.filePath)
				const existingFile = this.vault.getAbstractFileByPath(normalizedPath)

				console.log(`\n📄 Evaluating remote file: ${normalizedPath}`)
				console.log(`  Remote ID: ${remoteFile.id}`)
				console.log(`  Remote mtime: ${remoteFile.lastModified}`)
				console.log(`  Exists in local vault: ${existingFile instanceof TFile}`)
				console.log(`  Tracked in local index: ${localIndexFiles.has(normalizedPath)}`)

				// Update remote file info in sync state
				if (this.syncStateManager) {
					this.syncStateManager.updateRemoteFileInfo(
						normalizedPath,
						remoteFile.id,
						remoteFile.lastModified,
						remoteFile.hash
					)
				}

				// Determine download action using sync state manager
				let downloadAction: 'download' | 'conflict' | 'skip' = 'skip'
				let isUpdate = false

				if (this.syncStateManager) {
					// Get local file info
					let localMtime = 0
					let localHash = ''
					const localExists = existingFile instanceof TFile

					if (localExists) {
						localMtime = existingFile.stat.mtime
						const content = this.isBinaryFile(existingFile.extension)
							? await this.vault.readBinary(existingFile)
							: await this.vault.read(existingFile)
						localHash = await this.computeHash(content)
						console.log(`  Local mtime: ${localMtime}`)
						console.log(`  Local hash: ${localHash.substring(0, 16)}...`)
					}

					// Use sync state manager to determine action
					downloadAction = this.syncStateManager.shouldDownloadRemoteFile(
						normalizedPath,
						remoteFile.id,
						remoteFile.lastModified,
						localExists,
						localMtime,
						localHash
					)

					console.log(`  Download action: ${downloadAction}`)

					isUpdate = localExists
				} else {
					// Fallback if no sync state manager
					if (!existingFile) {
						downloadAction = 'download'
						isUpdate = false
					}
				}

				const shouldDownload = (downloadAction === 'download')

				if (downloadAction === 'conflict') {
					console.warn(`⚠️  CONFLICT: ${normalizedPath}`)
					// Mark conflict in sync state
					if (this.syncStateManager) {
						this.syncStateManager.markConflict(normalizedPath)
					}
					// TODO: Show conflict UI
					// For now, skip conflicted files
					continue
				}

				if (shouldDownload) {
					// Download the file
					const response = await fetch(`${this.serverUrl}/sync/download/${remoteFile.id}`)

					if (response.status === 401) {
						throw new Error('Authentication required. Please authenticate with Google Drive in plugin settings.')
					}

					if (response.ok) {
						const result = await response.json()
						if (result.success && result.data && result.data.fileData) {
							// Decode base64 and write file
							const base64Data = result.data.fileData
							const extension = normalizedPath.substring(normalizedPath.lastIndexOf('.')).slice(1)
							const isBinary = this.isBinaryFile(extension)

							if (isUpdate) {
								// Update existing file
								if (isBinary) {
									const binaryString = atob(base64Data)
									const bytes = new Uint8Array(binaryString.length)
									for (let i = 0; i < binaryString.length; i++) {
										bytes[i] = binaryString.charCodeAt(i)
									}
									await this.vault.modifyBinary(existingFile as TFile, bytes.buffer)
								} else {
									const textContent = decodeURIComponent(escape(atob(base64Data)))
									await this.vault.modify(existingFile as TFile, textContent)
								}
								console.log(`Updated: ${remoteFile.filePath}`)
							} else {
								// Create new file
								if (isBinary) {
									const binaryString = atob(base64Data)
									const bytes = new Uint8Array(binaryString.length)
									for (let i = 0; i < binaryString.length; i++) {
										bytes[i] = binaryString.charCodeAt(i)
									}
									await this.vault.createBinary(normalizedPath, bytes.buffer)
								} else {
									const textContent = decodeURIComponent(escape(atob(base64Data)))
									await this.vault.create(normalizedPath, textContent)
								}
								console.log(`Downloaded: ${remoteFile.filePath}`)
							}

							// Update sync state after successful download
							if (this.syncStateManager) {
								// Compute hash of downloaded content
								let hash: string
								if (isBinary) {
									const binaryString = atob(base64Data)
									const bytes = new Uint8Array(binaryString.length)
									for (let i = 0; i < binaryString.length; i++) {
										bytes[i] = binaryString.charCodeAt(i)
									}
									hash = await this.computeHash(bytes.buffer)
								} else {
									const textContent = decodeURIComponent(escape(atob(base64Data)))
									hash = await this.computeHash(textContent)
								}

								this.syncStateManager.markSynced(
									normalizedPath,
									hash,
									remoteFile.lastModified,
									remoteFile.size,
									remoteFile.id
								)
							}

							results.push(result)
						}
					} else {
						console.warn(`Failed to download ${remoteFile.filePath}:`, response.statusText)
					}
				}
			} catch (error) {
				console.error(`Error downloading ${remoteFile.filePath}:`, error)
			}
		}

		return results
	}

	public async getConflicts(): Promise<any[]> {
		try {
			const response = await fetch(`${this.serverUrl}/sync/conflicts`)

			if (response.ok) {
				const result = await response.json()
				return result.data?.conflicts || []
			} else {
				console.warn('Failed to check conflicts:', response.statusText)
				return []
			}
		} catch (error) {
			console.error('Error checking conflicts:', error)
			return []
		}
	}

	// Method to resolve conflicts with the server
	async resolveConflict(conflictId: string, strategy: 'local' | 'remote' | 'manual', resolvedContent?: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.serverUrl}/sync/resolve-conflict`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					conflictId,
					strategy,
					resolvedContent
				})
			})

			if (response.ok) {
				const result = await response.json()
				return result.success || false
			} else {
				console.warn('Failed to resolve conflict:', response.statusText)
				return false
			}
		} catch (error) {
			console.error('Error resolving conflict:', error)
			return false
		}
	}

	// Method to auto-resolve conflicts
	async autoResolveConflict(conflictId: string): Promise<any> {
		try {
			const response = await fetch(`${this.serverUrl}/sync/auto-resolve`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					conflictId
				})
			})

			if (response.ok) {
				return await response.json()
			} else {
				console.warn('Failed to auto-resolve conflict:', response.statusText)
				return { success: false }
			}
		} catch (error) {
			console.error('Error auto-resolving conflict:', error)
			return { success: false }
		}
	}

	// Method to watch files on the server
	async watchFiles(filePaths: string[]): Promise<boolean> {
		try {
			for (const filePath of filePaths) {
				const response = await fetch(`${this.serverUrl}/sync/watch`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						filePath
					})
				})

				if (!response.ok) {
					console.warn(`Failed to watch file ${filePath}:`, response.statusText)
				}
			}
			return true
		} catch (error) {
			console.error('Error setting up file watching:', error)
			return false
		}
	}

	// Method to get file changes from server
	async getFileChanges(): Promise<any> {
		try {
			const response = await fetch(`${this.serverUrl}/sync/changes`)

			if (response.ok) {
				return await response.json()
			} else {
				console.warn('Failed to get file changes:', response.statusText)
				return { success: false }
			}
		} catch (error) {
			console.error('Error getting file changes:', error)
			return { success: false }
		}
	}

	// Method to test server connection
	async testConnection(): Promise<{ connected: boolean; message: string }> {
		try {
			const response = await fetch(`${this.serverUrl}/health`)

			if (response.ok) {
				const health = await response.json()
				return {
					connected: true,
					message: `Server is healthy. Version: ${health.version}`
				}
			} else {
				return {
					connected: false,
					message: `Server responded with status: ${response.status}`
				}
			}
		} catch (error) {
			return {
				connected: false,
				message: `Connection failed: ${error}`
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

	// Method to reconcile index with actual vault files
	// This ensures any files created outside of Obsidian events are tracked
	async reconcileIndex(): Promise<number> {
		console.log('🔍 Reconciling sync index with vault files...')

		if (!this.syncStateManager) {
			console.warn('  ⚠️ No sync state manager available')
			return 0
		}

		try {
			// Scan vault for all relevant files
			const vaultFiles = await this.vaultScanner.scanVault({
				includeExtensions: ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg'],
				recursive: true
			})

			const currentIndex = this.syncStateManager.getState().files
			let newFilesFound = 0
			let staleEntriesRemoved = 0

			// Check for files in vault but not in index
			for (const vaultFile of vaultFiles) {
				if (vaultFile.isFolder) continue

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

			if (newFilesFound > 0 || staleEntriesRemoved > 0) {
				console.log(`✅ Index reconciliation complete:`)
				console.log(`   - ${newFilesFound} new file(s) added to index`)
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

	// Upload a single file to the server
	private async uploadSingleFile(file: TFile): Promise<void> {
		const isBinary = this.isBinaryFile(file.extension)
		const content = isBinary ? await this.vault.readBinary(file) : await this.vault.read(file)
		const hash = await this.computeHash(content)

		// Convert content to base64
		let fileData: string
		if (isBinary) {
			const bytes = new Uint8Array(content as ArrayBuffer)
			fileData = btoa(String.fromCharCode(...bytes))
		} else {
			fileData = btoa(unescape(encodeURIComponent(content as string)))
		}

		const response = await fetch(`${this.serverUrl}/sync/upload`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				vaultId: this.vaultId,
				filePath: file.path,
				fileData: fileData,
				lastModified: file.stat.mtime
			})
		})

		if (response.ok) {
			const result = await response.json()
			if (result.success && this.syncStateManager) {
				const metadata = await this.vaultScanner.getFileMetadata(file.path)
				this.syncStateManager.markSynced(
					file.path,
					hash,
					file.stat.mtime,
					file.stat.size,
					result.data?.fileId,
					{
						ctime: metadata?.ctime,
						extension: metadata?.extension,
						operation: 'upload'
					}
				)
			}
		} else {
			if (this.syncStateManager) {
				this.syncStateManager.markSyncError(file.path, response.statusText, 'upload')
			}
			throw new Error(`Upload failed: ${response.statusText}`)
		}
	}

	// Download a single file from the server
	private async downloadSingleFile(fileInfo: any): Promise<void> {
		const response = await fetch(`${this.serverUrl}/sync/download/${fileInfo.id}`)

		if (response.status === 401) {
			throw new Error('Authentication required')
		}

		if (!response.ok) {
			throw new Error(`Download failed: ${response.statusText}`)
		}

		const result = await response.json()
		if (!result.success || !result.data || !result.data.fileData) {
			throw new Error('Invalid download response')
		}

		const normalizedPath = normalizePath(fileInfo.filePath)
		const existingFile = this.vault.getAbstractFileByPath(normalizedPath)
		const extension = normalizedPath.substring(normalizedPath.lastIndexOf('.')).slice(1)
		const isBinary = this.isBinaryFile(extension)
		const base64Data = result.data.fileData

		// Decode and write file
		if (existingFile instanceof TFile) {
			// Update existing file
			if (isBinary) {
				const binaryString = atob(base64Data)
				const bytes = new Uint8Array(binaryString.length)
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i)
				}
				await this.vault.modifyBinary(existingFile, bytes.buffer)
			} else {
				const textContent = decodeURIComponent(escape(atob(base64Data)))
				await this.vault.modify(existingFile, textContent)
			}
		} else {
			// Create new file (ensure parent directories exist)
			const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))
			if (parentPath && !this.vault.getAbstractFileByPath(parentPath)) {
				// Create parent directories recursively
				const parts = parentPath.split('/')
				let currentPath = ''
				for (const part of parts) {
					currentPath = currentPath ? `${currentPath}/${part}` : part
					if (!this.vault.getAbstractFileByPath(currentPath)) {
						await this.vault.createFolder(currentPath)
					}
				}
			}

			if (isBinary) {
				const binaryString = atob(base64Data)
				const bytes = new Uint8Array(binaryString.length)
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i)
				}
				await this.vault.createBinary(normalizedPath, bytes.buffer)
			} else {
				const textContent = decodeURIComponent(escape(atob(base64Data)))
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
}