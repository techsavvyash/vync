import { promises as fs } from 'fs'
import path from 'path'

export interface SyncResult {
  success: boolean
  message: string
  uploadedFiles?: number
  downloadedFiles?: number
  conflicts?: number
}

export interface SyncFile {
  path: string
  content: string
  size: number
  hash: string
}

// Note: This is a client-side sync service that will communicate with the server
// The actual drive service operations are handled by the server

export class SyncService {
	private serverUrl: string
	private vaultId: string

	constructor(serverUrl: string, vaultId: string) {
		this.serverUrl = serverUrl
		this.vaultId = vaultId
	}

	async syncVault(vaultPath: string): Promise<SyncResult> {
		try {
			console.log(`Starting sync for vault: ${this.vaultId}`)

			// Get files that need to be synced
			const filesToSync = await this.getFilesToSync(vaultPath)

			if (filesToSync.length === 0) {
				return {
					success: true,
					message: 'No files to sync',
					uploadedFiles: 0,
					downloadedFiles: 0,
					conflicts: 0
				}
			}

			// Upload files to server
			const uploadResults = await this.uploadFiles(filesToSync)

			// Check for remote changes
			const remoteChanges = await this.checkRemoteChanges()

			// Download remote changes
			const downloadResults = await this.downloadFiles(remoteChanges, vaultPath)

			// Handle conflicts
			const conflicts = await this.getConflicts()

			return {
				success: true,
				message: 'Sync completed successfully',
				uploadedFiles: uploadResults.length,
				downloadedFiles: downloadResults.length,
				conflicts: conflicts.length
			}

		} catch (error) {
			console.error('Sync failed:', error)
			return {
				success: false,
				message: `Sync failed: ${error}`
			}
		}
	}

	private async getFilesToSync(vaultPath: string): Promise<SyncFile[]> {
		const files: SyncFile[] = []
		const relevantExtensions = ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg']

		try {
			const entries = await fs.readdir(vaultPath, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(vaultPath, entry.name)
				const relativePath = entry.name

				if (entry.isDirectory()) {
					// Skip directories for now
					continue
				} else if (entry.isFile()) {
					const extension = path.extname(entry.name).toLowerCase()
					if (relevantExtensions.includes(extension)) {
						try {
							const content = await fs.readFile(fullPath, 'utf8')
							const stats = await fs.stat(fullPath)
							const crypto = await import('crypto')
							const hash = crypto.createHash('md5').update(content).digest('hex')

							files.push({
								path: relativePath,
								content,
								size: stats.size,
								hash
							})
						} catch (error) {
							console.warn(`Failed to read file ${fullPath}:`, error)
						}
					}
				}
			}
		} catch (error) {
			console.error(`Error scanning vault directory:`, error)
		}

		return files
	}

	private async uploadFiles(files: SyncFile[]): Promise<any[]> {
		const results: any[] = []

		for (const file of files) {
			try {
				const response = await fetch(`${this.serverUrl}/sync/upload`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						vaultId: this.vaultId,
						filePath: file.path,
						fileData: file.content,
						lastModified: Date.now()
					})
				})

				if (response.ok) {
					const result = await response.json()
					results.push(result)
					console.log(`Uploaded: ${file.path}`)
				} else {
					console.warn(`Failed to upload ${file.path}:`, response.statusText)
				}
			} catch (error) {
				console.error(`Error uploading ${file.path}:`, error)
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

	private async downloadFiles(remoteFiles: any[], vaultPath: string): Promise<any[]> {
		const results: any[] = []

		for (const remoteFile of remoteFiles) {
			try {
				// Check if we need to download this file
				const localPath = path.join(vaultPath, remoteFile.filePath)
				const exists = await this.fileExists(localPath)

				if (!exists) {
					// Download the file
					const response = await fetch(`${this.serverUrl}/sync/download/${remoteFile.id}`)

					if (response.ok) {
						const result = await response.json()
						if (result.success && result.data) {
							// Write file to disk
							await fs.writeFile(localPath, result.data.fileData, 'base64')
							results.push(result)
							console.log(`Downloaded: ${remoteFile.filePath}`)
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

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	// Method to trigger sync on file changes
	async syncOnChange(vaultPath: string, changedFiles: string[]): Promise<void> {
		console.log(`Sync triggered by changes to: ${changedFiles.join(', ')}`)

		// For now, do a full sync. In the future, we could optimize to only sync changed files
		await this.syncVault(vaultPath)
	}
}