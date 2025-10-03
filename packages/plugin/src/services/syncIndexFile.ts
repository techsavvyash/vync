/**
 * Sync Index File Manager
 * Handles reading/writing the sync index to a separate JSON file
 * Located at: .obsidian/plugins/obsidian-sync/sync-index.json
 */

import { Vault } from 'obsidian'
import type { VaultSyncState, FileSyncState, FolderSyncState } from './syncState'

export interface SyncIndexData {
	version: string
	vaultId: string
	lastFullSync: number
	lastRemoteCheck: number
	files: Record<string, FileSyncState>
	folders: Record<string, FolderSyncState>
}

export class SyncIndexFile {
	private vault: Vault
	private indexPath: string
	private readonly CURRENT_VERSION = '1.0.0'

	constructor(vault: Vault, pluginDir: string = '.obsidian/plugins/obsidian-sync') {
		this.vault = vault
		this.indexPath = `${pluginDir}/sync-index.json`
	}

	/**
	 * Load sync index from JSON file
	 */
	async load(): Promise<VaultSyncState | null> {
		try {
			const fileExists = await this.vault.adapter.exists(this.indexPath)

			if (!fileExists) {
				console.log('📄 No sync index file found, will create on first save')
				return null
			}

			console.log('📄 Loading sync index from:', this.indexPath)
			const content = await this.vault.adapter.read(this.indexPath)
			const data: SyncIndexData = JSON.parse(content)

			// Validate version
			if (!data.version) {
				console.warn('⚠️ Sync index missing version, migrating...')
			}

			// Convert Record to Map for internal use
			const filesMap = new Map<string, FileSyncState>(Object.entries(data.files || {}))
			const foldersMap = new Map<string, FolderSyncState>(Object.entries(data.folders || {}))

			const state: VaultSyncState = {
				vaultId: data.vaultId,
				lastFullSync: data.lastFullSync || 0,
				lastRemoteCheck: data.lastRemoteCheck || 0,
				files: filesMap,
				folders: foldersMap
			}

			console.log(`✅ Loaded sync index: ${filesMap.size} file(s), ${foldersMap.size} folder(s)`)
			return state

		} catch (error) {
			console.error('❌ Failed to load sync index:', error)
			return null
		}
	}

	/**
	 * Save sync index to JSON file
	 */
	async save(state: VaultSyncState): Promise<boolean> {
		try {
			// Convert Map to Record for serialization
			const filesRecord: Record<string, FileSyncState> = {}
			state.files.forEach((value, key) => {
				filesRecord[key] = value
			})

			const foldersRecord: Record<string, FolderSyncState> = {}
			state.folders.forEach((value, key) => {
				foldersRecord[key] = value
			})

			const data: SyncIndexData = {
				version: this.CURRENT_VERSION,
				vaultId: state.vaultId,
				lastFullSync: state.lastFullSync,
				lastRemoteCheck: state.lastRemoteCheck,
				files: filesRecord,
				folders: foldersRecord
			}

			const content = JSON.stringify(data, null, 2)
			await this.vault.adapter.write(this.indexPath, content)

			console.log(`💾 Saved sync index: ${state.files.size} file(s), ${state.folders.size} folder(s) to ${this.indexPath}`)
			return true

		} catch (error) {
			console.error('❌ Failed to save sync index:', error)
			return false
		}
	}

	/**
	 * Migrate from old plugin data format to JSON file
	 */
	async migrateFromPluginData(oldData: any): Promise<VaultSyncState> {
		console.log('🔄 Migrating sync state from plugin data to JSON file...')

		const state: VaultSyncState = {
			vaultId: oldData.vaultId || '',
			lastFullSync: oldData.lastFullSync || 0,
			lastRemoteCheck: oldData.lastRemoteCheck || 0,
			files: new Map<string, FileSyncState>(),
			folders: new Map<string, FolderSyncState>()
		}

		// Convert files object to Map
		if (oldData.files) {
			if (oldData.files instanceof Map) {
				state.files = oldData.files
			} else {
				state.files = new Map(Object.entries(oldData.files))
			}
		}

		// Convert folders object to Map (if exists in old data)
		if (oldData.folders) {
			if (oldData.folders instanceof Map) {
				state.folders = oldData.folders
			} else {
				state.folders = new Map(Object.entries(oldData.folders))
			}
		}

		console.log(`✅ Migrated ${state.files.size} file(s), ${state.folders.size} folder(s)`)

		// Save to new format
		await this.save(state)

		return state
	}

	/**
	 * Check if sync index file exists
	 */
	async exists(): Promise<boolean> {
		return await this.vault.adapter.exists(this.indexPath)
	}

	/**
	 * Delete sync index file (useful for testing/reset)
	 */
	async delete(): Promise<boolean> {
		try {
			const exists = await this.exists()
			if (exists) {
				await this.vault.adapter.remove(this.indexPath)
				console.log('🗑️ Deleted sync index file')
				return true
			}
			return false
		} catch (error) {
			console.error('❌ Failed to delete sync index:', error)
			return false
		}
	}

	/**
	 * Get sync index file path
	 */
	getIndexPath(): string {
		return this.indexPath
	}

	/**
	 * Get sync index statistics
	 */
	async getStats(): Promise<{
		exists: boolean
		fileCount: number
		fileSizeKB?: number
		lastModified?: number
	}> {
		const exists = await this.exists()

		if (!exists) {
			return { exists: false, fileCount: 0 }
		}

		try {
			const stat = await this.vault.adapter.stat(this.indexPath)
			const state = await this.load()

			return {
				exists: true,
				fileCount: state?.files.size || 0,
				fileSizeKB: stat ? Math.round(stat.size / 1024) : undefined,
				lastModified: stat?.mtime
			}
		} catch (error) {
			console.error('Failed to get sync index stats:', error)
			return { exists: true, fileCount: 0 }
		}
	}
}
