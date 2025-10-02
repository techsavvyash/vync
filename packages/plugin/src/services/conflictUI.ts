export interface Conflict {
	id: string
	filePath: string
	localVersion: {
		content: string
		lastModified: number
		size: number
	}
	remoteVersion: {
		content: string
		lastModified: number
		size: number
	}
	timestamp: number
}

export type ConflictResolution = 'local' | 'remote' | 'manual'

export interface ConflictResolutionResult {
	conflictId: string
	resolution: ConflictResolution
	resolvedContent?: string
}

export class ConflictUIService {
	private conflicts: Map<string, Conflict> = new Map()
	private resolutionCallbacks: ((result: ConflictResolutionResult) => void)[] = []

	onResolution(callback: (result: ConflictResolutionResult) => void): void {
		this.resolutionCallbacks.push(callback)
	}

	removeResolutionListener(callback: (result: ConflictResolutionResult) => void): void {
		const index = this.resolutionCallbacks.indexOf(callback)
		if (index > -1) {
			this.resolutionCallbacks.splice(index, 1)
		}
	}

	addConflict(conflict: Conflict): void {
		this.conflicts.set(conflict.id, conflict)
		console.log(`New conflict detected: ${conflict.filePath}`)
		this.displayConflictNotification(conflict)
	}

	getPendingConflicts(): Conflict[] {
		return Array.from(this.conflicts.values())
	}

	getConflict(conflictId: string): Conflict | null {
		return this.conflicts.get(conflictId) || null
	}

	async resolveConflict(
		conflictId: string,
		resolution: ConflictResolution,
		resolvedContent?: string
	): Promise<boolean> {
		const conflict = this.conflicts.get(conflictId)
		if (!conflict) {
			console.error(`Conflict ${conflictId} not found`)
			return false
		}

		// Create resolution result
		const result: ConflictResolutionResult = {
			conflictId,
			resolution,
			...(resolvedContent !== undefined && { resolvedContent })
		}

		// Notify all callbacks
		for (const callback of this.resolutionCallbacks) {
			try {
				callback(result)
			} catch (error) {
				console.error('Error in resolution callback:', error)
			}
		}

		// Remove conflict from pending list
		this.conflicts.delete(conflictId)

		console.log(`Conflict resolved: ${conflict.filePath} -> ${resolution}`)
		return true
	}

	private displayConflictNotification(conflict: Conflict): void {
		// Since we don't have access to Obsidian's UI components,
		// we'll use console output and basic prompts
		console.log('\n=== CONFLICT DETECTED ===')
		console.log(`File: ${conflict.filePath}`)
		console.log(`Local version: ${conflict.localVersion.size} bytes, modified: ${new Date(conflict.localVersion.lastModified).toLocaleString()}`)
		console.log(`Remote version: ${conflict.remoteVersion.size} bytes, modified: ${new Date(conflict.remoteVersion.lastModified).toLocaleString()}`)
		console.log('========================\n')

		// In a real implementation, this would show a modal dialog
		// For now, we'll auto-resolve based on the default strategy
		this.autoResolveConflict(conflict)
	}

	private async autoResolveConflict(conflict: Conflict): Promise<void> {
		// Simple auto-resolution logic
		const { localVersion, remoteVersion } = conflict

		let resolution: ConflictResolution = 'manual'
		let resolvedContent: string | undefined

		// Rule 1: If one version is significantly larger, keep it
		const sizeDifference = Math.abs(localVersion.size - remoteVersion.size)
		if (sizeDifference > 1024) { // 1KB difference threshold
			resolution = localVersion.size > remoteVersion.size ? 'local' : 'remote'
		}
		// Rule 2: Keep the more recently modified version
		else if (localVersion.lastModified !== remoteVersion.lastModified) {
			resolution = localVersion.lastModified > remoteVersion.lastModified ? 'local' : 'remote'
		}
		// Rule 3: If sizes are similar and modification times are close, require manual resolution
		else if (Math.abs(localVersion.lastModified - remoteVersion.lastModified) < 60000) { // Within 1 minute
			resolution = 'manual'
			// For manual resolution, we could merge the content or show a diff
			resolvedContent = this.mergeContent(localVersion.content, remoteVersion.content)
		}

		// Apply the resolution
		await this.resolveConflict(conflict.id, resolution, resolvedContent)
	}

	private mergeContent(localContent: string, remoteContent: string): string {
		// Simple merge strategy: combine both versions with conflict markers
		return `<<<<<<< LOCAL VERSION
${localContent}
=======
${remoteContent}
>>>>>>> REMOTE VERSION`
	}

	// Method to display conflict resolution options (for manual resolution)
	displayConflictOptions(conflict: Conflict): void {
		console.log(`\nConflict Resolution Options for: ${conflict.filePath}`)
		console.log('1. Keep local version')
		console.log('2. Keep remote version')
		console.log('3. Merge manually')
		console.log('4. View diff')
		console.log('\nChoose an option (1-4):')

		// In a real implementation, this would show an interactive dialog
		// For now, we'll just log the options
	}

	// Method to show diff between versions
	showDiff(conflict: Conflict): void {
		console.log(`\n=== DIFF for ${conflict.filePath} ===`)
		console.log('--- LOCAL VERSION ---')
		console.log(conflict.localVersion.content.substring(0, 500) + (conflict.localVersion.content.length > 500 ? '...' : ''))
		console.log('\n--- REMOTE VERSION ---')
		console.log(conflict.remoteVersion.content.substring(0, 500) + (conflict.remoteVersion.content.length > 500 ? '...' : ''))
		console.log('========================\n')
	}

	// Method to get conflict statistics
	getConflictStats(): {
		total: number
		resolved: number
		pending: number
	} {
		const total = this.conflicts.size
		// For now, all conflicts are pending since we don't track resolved ones separately
		return {
			total,
			resolved: 0,
			pending: total
		}
	}

	// Method to clear all conflicts
	clearConflicts(): void {
		this.conflicts.clear()
		console.log('All conflicts cleared')
	}
}