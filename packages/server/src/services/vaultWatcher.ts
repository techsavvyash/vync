import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface VaultFileChange {
	filePath: string
	changeType: 'created' | 'modified' | 'deleted'
	timestamp: number
	hash?: string
	size?: number
}

export interface VaultFile {
	path: string
	name: string
	size: number
	mtime: number
	hash: string
}

export class VaultWatcherService {
	private vaultPath: string
	private watchedFiles: Map<string, VaultFile> = new Map()
	private changeCallbacks: ((change: VaultFileChange) => void)[] = []
	private isWatching: boolean = false
	private watchTimer: NodeJS.Timeout | null = null

	constructor(vaultPath: string) {
		this.vaultPath = vaultPath
	}

	async startWatching(): Promise<void> {
		if (this.isWatching) return

		this.isWatching = true
		console.log(`Starting vault watcher for: ${this.vaultPath}`)

		// Initial scan
		await this.initialScan()

		// Set up periodic checking
		this.watchTimer = setInterval(() => {
			this.checkForChanges()
		}, 2000) // Check every 2 seconds
	}

	stopWatching(): void {
		if (this.watchTimer) {
			clearInterval(this.watchTimer)
			this.watchTimer = null
		}
		this.isWatching = false
		this.watchedFiles.clear()
		console.log('Vault watcher stopped')
	}

	onChange(callback: (change: VaultFileChange) => void): void {
		this.changeCallbacks.push(callback)
	}

	private async initialScan(): Promise<void> {
		try {
			const files = await this.scanDirectory(this.vaultPath)
			for (const file of files) {
				this.watchedFiles.set(file.path, file)
			}
			console.log(`Initial scan complete: ${files.length} files found`)
		} catch (error) {
			console.error('Error during initial scan:', error)
		}
	}

	private async scanDirectory(dirPath: string): Promise<VaultFile[]> {
		const files: VaultFile[] = []

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name)
				const relativePath = path.relative(this.vaultPath, fullPath)

				if (entry.name.startsWith('.')) continue

				if (entry.isDirectory()) {
					const subFiles = await this.scanDirectory(fullPath)
					files.push(...subFiles)
				} else if (entry.isFile() && this.isRelevantFile(entry.name)) {
					try {
						const fileInfo = await this.getFileInfo(fullPath, relativePath)
						files.push(fileInfo)
					} catch (error) {
						console.warn(`Failed to get info for ${fullPath}:`, error)
					}
				}
			}
		} catch (error) {
			console.error(`Error scanning directory ${dirPath}:`, error)
		}

		return files
	}

	private async getFileInfo(fullPath: string, relativePath: string): Promise<VaultFile> {
		const stats = await fs.stat(fullPath)
		const content = await fs.readFile(fullPath, 'utf8')
		const hash = crypto.createHash('md5').update(content).digest('hex')

		return {
			path: relativePath,
			name: path.basename(relativePath),
			size: stats.size,
			mtime: stats.mtime.getTime(),
			hash
		}
	}

	private async checkForChanges(): Promise<void> {
		try {
			const currentFiles = await this.scanDirectory(this.vaultPath)
			const currentFileMap = new Map(currentFiles.map(f => [f.path, f]))

			// Check for new and modified files
			for (const currentFile of currentFiles) {
				const previousFile = this.watchedFiles.get(currentFile.path)

				if (!previousFile) {
					this.notifyChange({
						filePath: currentFile.path,
						changeType: 'created',
						timestamp: Date.now(),
						hash: currentFile.hash,
						size: currentFile.size
					})
				} else if (previousFile.hash !== currentFile.hash) {
					this.notifyChange({
						filePath: currentFile.path,
						changeType: 'modified',
						timestamp: Date.now(),
						hash: currentFile.hash,
						size: currentFile.size
					})
				}
			}

			// Check for deleted files
			for (const [filePath] of this.watchedFiles) {
				if (!currentFileMap.has(filePath)) {
					this.notifyChange({
						filePath,
						changeType: 'deleted',
						timestamp: Date.now()
					})
				}
			}

			this.watchedFiles = currentFileMap
		} catch (error) {
			console.error('Error checking for changes:', error)
		}
	}

	private notifyChange(change: VaultFileChange): void {
		for (const callback of this.changeCallbacks) {
			try {
				callback(change)
			} catch (error) {
				console.error('Error in change callback:', error)
			}
		}
	}

	private isRelevantFile(fileName: string): boolean {
		const relevantExtensions = ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg']
		const extension = path.extname(fileName).toLowerCase()
		return relevantExtensions.includes(extension)
	}

	getWatchedFileCount(): number {
		return this.watchedFiles.size
	}
}