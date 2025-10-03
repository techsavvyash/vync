/**
 * Vault Scanner Service
 * Efficient vault scanning using vault.adapter APIs
 * Provides better performance for large vaults
 */

import { Vault, TFile, TFolder } from 'obsidian'

export interface FileMetadata {
	path: string
	mtime: number
	ctime: number
	size: number
	isFolder: boolean
	extension?: string
}

export interface ScanOptions {
	includeExtensions?: string[]  // e.g., ['.md', '.txt']
	excludePaths?: string[]        // e.g., ['.git', 'node_modules']
	recursive?: boolean
}

export class VaultScanner {
	private vault: Vault
	private readonly DEFAULT_EXTENSIONS = ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg']

	constructor(vault: Vault) {
		this.vault = vault
	}

	/**
	 * Scan vault using vault.adapter.list() - more efficient than vault.getFiles()
	 */
	async scanVault(options: ScanOptions = {}): Promise<FileMetadata[]> {
		const includeExtensions = options.includeExtensions || this.DEFAULT_EXTENSIONS
		const excludePaths = options.excludePaths || ['.git', '.obsidian']
		const recursive = options.recursive !== false

		const results: FileMetadata[] = []

		try {
			await this.scanDirectory('', results, includeExtensions, excludePaths, recursive)
			return results
		} catch (error) {
			console.error('Error scanning vault:', error)
			return []
		}
	}

	/**
	 * Recursively scan a directory using vault.adapter.list()
	 */
	private async scanDirectory(
		dirPath: string,
		results: FileMetadata[],
		includeExtensions: string[],
		excludePaths: string[],
		recursive: boolean
	): Promise<void> {
		try {
			// Use vault.adapter.list() for efficient directory listing
			const listing = await this.vault.adapter.list(dirPath)

			// Process files
			for (const filePath of listing.files) {
				// Skip excluded paths
				if (this.isExcluded(filePath, excludePaths)) {
					continue
				}

				// Check extension
				const extension = this.getExtension(filePath)
				if (!includeExtensions.includes(extension)) {
					continue
				}

				// Get file metadata using vault.adapter.stat() - no file read needed!
				const stat = await this.vault.adapter.stat(filePath)
				if (stat) {
					results.push({
						path: filePath,
						mtime: stat.mtime,
						ctime: stat.ctime,
						size: stat.size,
						isFolder: false,
						extension: extension
					})
				}
			}

			// Process folders recursively
			if (recursive) {
				for (const folderPath of listing.folders) {
					// Skip excluded paths
					if (this.isExcluded(folderPath, excludePaths)) {
						continue
					}

					// Get folder metadata
					const stat = await this.vault.adapter.stat(folderPath)
					if (stat) {
						results.push({
							path: folderPath,
							mtime: stat.mtime,
							ctime: stat.ctime,
							size: 0,
							isFolder: true
						})
					}

					// Recurse into subfolder
					await this.scanDirectory(folderPath, results, includeExtensions, excludePaths, recursive)
				}
			}
		} catch (error) {
			console.error(`Error scanning directory ${dirPath}:`, error)
		}
	}

	/**
	 * Get file metadata without reading the file
	 */
	async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
		try {
			const stat = await this.vault.adapter.stat(filePath)
			if (!stat) {
				return null
			}

			return {
				path: filePath,
				mtime: stat.mtime,
				ctime: stat.ctime,
				size: stat.size,
				isFolder: stat.type === 'folder',
				extension: stat.type === 'file' ? this.getExtension(filePath) : undefined
			}
		} catch (error) {
			console.error(`Error getting metadata for ${filePath}:`, error)
			return null
		}
	}

	/**
	 * Check if a path should be excluded
	 */
	private isExcluded(path: string, excludePaths: string[]): boolean {
		for (const excluded of excludePaths) {
			if (path.startsWith(excluded) || path.includes(`/${excluded}/`)) {
				return true
			}
		}
		return false
	}

	/**
	 * Get file extension
	 */
	private getExtension(path: string): string {
		const lastDot = path.lastIndexOf('.')
		if (lastDot === -1) return ''
		return path.substring(lastDot).toLowerCase()
	}

	/**
	 * Count files and folders in a directory (non-recursive)
	 */
	async countDirectoryContents(dirPath: string): Promise<{ fileCount: number; folderCount: number }> {
		try {
			const listing = await this.vault.adapter.list(dirPath)
			return {
				fileCount: listing.files.length,
				folderCount: listing.folders.length
			}
		} catch (error) {
			console.error(`Error counting directory contents for ${dirPath}:`, error)
			return { fileCount: 0, folderCount: 0 }
		}
	}

	/**
	 * Check if a file exists using vault.adapter
	 */
	async fileExists(filePath: string): Promise<boolean> {
		return await this.vault.adapter.exists(filePath)
	}

	/**
	 * Get stats for multiple files efficiently (batch operation)
	 */
	async getMultipleFileMetadata(filePaths: string[]): Promise<Map<string, FileMetadata | null>> {
		const results = new Map<string, FileMetadata | null>()

		// Use Promise.all for parallel stat calls
		const statPromises = filePaths.map(async (path) => {
			const metadata = await this.getFileMetadata(path)
			results.set(path, metadata)
		})

		await Promise.all(statPromises)

		return results
	}

	/**
	 * Compare two file metadata objects to detect changes
	 */
	hasFileChanged(oldMeta: FileMetadata, newMeta: FileMetadata): boolean {
		return (
			oldMeta.mtime !== newMeta.mtime ||
			oldMeta.size !== newMeta.size
		)
	}
}
