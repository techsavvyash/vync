import { Vault, TFile, TFolder, TAbstractFile, EventRef } from 'obsidian'

export interface VaultFileChange {
	filePath: string
	changeType: 'created' | 'modified' | 'deleted'
	timestamp: number
	hash?: string
	size?: number
	isFolder?: boolean
	oldPath?: string // For renames
}

export interface VaultFile {
	path: string
	name: string
	size: number
	mtime: number
	hash: string
}

export class VaultWatcherService {
	private vault: Vault
	private changeCallbacks: ((change: VaultFileChange) => void)[] = []
	private isWatching: boolean = false
	private eventRefs: EventRef[] = []

	constructor(vault: Vault) {
		this.vault = vault
	}

	async startWatching(): Promise<void> {
		if (this.isWatching) return

		this.isWatching = true
		console.log('Starting vault watcher using Obsidian API')

		// Listen for file/folder creation
		const createRef = this.vault.on('create', (file: TAbstractFile) => {
			if (file instanceof TFile && this.isRelevantFile(file.name)) {
				this.notifyChange({
					filePath: file.path,
					changeType: 'created',
					timestamp: Date.now(),
					size: file.stat.size,
					isFolder: false
				})
			} else if (file instanceof TFolder) {
				this.notifyChange({
					filePath: file.path,
					changeType: 'created',
					timestamp: Date.now(),
					isFolder: true
				})
			}
		})
		this.eventRefs.push(createRef)

		// Listen for file modification
		const modifyRef = this.vault.on('modify', (file: TAbstractFile) => {
			if (file instanceof TFile && this.isRelevantFile(file.name)) {
				this.notifyChange({
					filePath: file.path,
					changeType: 'modified',
					timestamp: Date.now(),
					size: file.stat.size
				})
			}
		})
		this.eventRefs.push(modifyRef)

		// Listen for file/folder deletion
		const deleteRef = this.vault.on('delete', (file: TAbstractFile) => {
			if (file instanceof TFile && this.isRelevantFile(file.name)) {
				this.notifyChange({
					filePath: file.path,
					changeType: 'deleted',
					timestamp: Date.now(),
					isFolder: false
				})
			} else if (file instanceof TFolder) {
				this.notifyChange({
					filePath: file.path,
					changeType: 'deleted',
					timestamp: Date.now(),
					isFolder: true
				})
			}
		})
		this.eventRefs.push(deleteRef)

		// Listen for file/folder rename
		const renameRef = this.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (file instanceof TFile && this.isRelevantFile(file.name)) {
				// Notify old path as deleted
				this.notifyChange({
					filePath: oldPath,
					changeType: 'deleted',
					timestamp: Date.now(),
					isFolder: false,
					oldPath: oldPath
				})
				// Notify new path as created
				this.notifyChange({
					filePath: file.path,
					changeType: 'created',
					timestamp: Date.now(),
					size: file.stat.size,
					isFolder: false,
					oldPath: oldPath
				})
			} else if (file instanceof TFolder) {
				// Folder renamed - notify with oldPath for tracking
				console.log(`📁 Folder renamed: ${oldPath} → ${file.path}`)
				this.notifyChange({
					filePath: file.path,
					changeType: 'created', // Use 'created' with oldPath to indicate rename
					timestamp: Date.now(),
					isFolder: true,
					oldPath: oldPath
				})
			}
		})
		this.eventRefs.push(renameRef)

		console.log('Vault watcher started successfully')
	}

	stopWatching(): void {
		// Unregister all event listeners
		for (const ref of this.eventRefs) {
			this.vault.offref(ref)
		}
		this.eventRefs = []
		this.isWatching = false
		console.log('Vault watcher stopped')
	}

	onChange(callback: (change: VaultFileChange) => void): void {
		this.changeCallbacks.push(callback)
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
		const relevantExtensions = ['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg']
		const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
		return relevantExtensions.includes(extension)
	}

	getWatchedFileCount(): number {
		// Return count of files in vault
		const files = this.vault.getFiles()
		return files.filter(f => this.isRelevantFile(f.name)).length
	}
}