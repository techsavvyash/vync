import { promises as fs } from 'fs'
import path from 'path'
import { DriveServiceFactory } from './drive/DriveServiceFactory'
import { IDriveService } from './drive/IDriveService'

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

export class SyncService {
	private serverUrl: string
	private vaultId: string
	private driveService: IDriveService

	constructor(serverUrl: string, vaultId: string) {
		this.serverUrl = serverUrl
		this.vaultId = vaultId
		this.driveService = DriveServiceFactory.getDriveService()
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

			// Upload files to storage
			const uploadResults = await this.uploadFiles(filesToSync)

			// Check for remote changes
			const remoteChanges = await this.checkRemoteChanges()

			// Download remote changes
			const downloadResults = await this.downloadFiles(remoteChanges, vaultPath)

			// Handle conflicts
			const conflicts = await this.handleConflicts()

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
				const mimeType = this.getMimeType(file.path)
				const result = await this.driveService.uploadFile(
					file.path,
					Buffer.from(file.content),
					mimeType
				)

				if (result.success) {
					results.push(result)
					console.log(`Uploaded: ${file.path}`)
				} else {
					console.warn(`Failed to upload ${file.path}:`, result.error)
				}
			} catch (error) {
				console.error(`Error uploading ${file.path}:`, error)
			}
		}

		return results
	}

	private async checkRemoteChanges(): Promise<any[]> {
		try {
			const result = await this.driveService.listFiles()

			if (result.success) {
				return result.files || []
			} else {
				console.warn('Failed to check remote changes:', result.error)
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
				const localPath = path.join(vaultPath, remoteFile.name)
				const exists = await this.fileExists(localPath)

				if (!exists) {
					// Download the file
					const result = await this.driveService.downloadFile(remoteFile.id)

					if (result.success && result.data) {
						// Write file to disk
						await fs.writeFile(localPath, result.data)
						results.push(result)
						console.log(`Downloaded: ${remoteFile.name}`)
					} else {
						console.warn(`Failed to download ${remoteFile.name}:`, result.error)
					}
				}
			} catch (error) {
				console.error(`Error downloading ${remoteFile.name}:`, error)
			}
		}

		return results
	}

	private async handleConflicts(): Promise<any[]> {
		// For now, return empty array - conflicts would be handled by conflictUI service
		return []
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	private getMimeType(fileName: string): string {
		const extension = fileName.split('.').pop()?.toLowerCase() || ''
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
			'wav': 'audio/wav',
			'json': 'application/json',
			'css': 'text/css',
			'js': 'application/javascript',
			'ts': 'application/typescript'
		}
		return mimeTypes[extension] || 'application/octet-stream'
	}

	// Method to trigger sync on file changes
	async syncOnChange(vaultPath: string, changedFiles: string[]): Promise<void> {
		console.log(`Sync triggered by changes to: ${changedFiles.join(', ')}`)

		// For now, do a full sync. In the future, we could optimize to only sync changed files
		await this.syncVault(vaultPath)
	}
}