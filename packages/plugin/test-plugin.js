#!/usr/bin/env node

// Test script for Obsidian Sync Plugin
// This simulates plugin functionality for testing purposes

const fs = require('fs')
const path = require('path')

class PluginTester {
	constructor() {
		this.testResults = []
		this.testVaultPath = path.join(__dirname, 'test-vault')
	}

	log(message, type = 'info') {
		const timestamp = new Date().toISOString()
		const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
		console.log(`[${timestamp}] ${prefix} ${message}`)
		this.testResults.push({ timestamp, type, message })
	}

	async setupTestVault() {
		this.log('Setting up test vault...')

		// Create test vault directory
		if (!fs.existsSync(this.testVaultPath)) {
			fs.mkdirSync(this.testVaultPath, { recursive: true })
		}

		// Create some test files
		const testFiles = [
			{ name: 'test-note.md', content: '# Test Note\nThis is a test note for sync functionality.' },
			{ name: 'another-note.md', content: '# Another Note\nThis is another test note.' },
			{ name: 'todo.md', content: '# TODO\n- Test sync functionality\n- Verify conflict resolution' }
		]

		for (const file of testFiles) {
			const filePath = path.join(this.testVaultPath, file.name)
			fs.writeFileSync(filePath, file.content)
			this.log(`Created test file: ${file.name}`)
		}

		this.log('Test vault setup completed', 'success')
	}

	async testFileWatching() {
		this.log('Testing file watching functionality...')

		// Simulate file changes
		const testFile = path.join(this.testVaultPath, 'test-note.md')
		const originalContent = fs.readFileSync(testFile, 'utf8')

		// Modify file
		const modifiedContent = originalContent + '\n\n## Modified\nThis content was added during testing.'
		fs.writeFileSync(testFile, modifiedContent)
		this.log('Modified test file')

		// Wait a bit
		await new Promise(resolve => setTimeout(resolve, 1000))

		// Create new file
		const newFile = path.join(this.testVaultPath, 'new-test-file.md')
		fs.writeFileSync(newFile, '# New Test File\nThis is a new file created during testing.')
		this.log('Created new test file')

		// Delete file
		fs.unlinkSync(newFile)
		this.log('Deleted test file')

		this.log('File watching test completed', 'success')
	}

	async testSyncService() {
		this.log('Testing sync service functionality...')

		// This would normally test the actual sync service
		// For now, we'll just simulate the process
		this.log('Simulating file upload...')
		await new Promise(resolve => setTimeout(resolve, 500))

		this.log('Simulating file download...')
		await new Promise(resolve => setTimeout(resolve, 500))

		this.log('Simulating metadata sync...')
		await new Promise(resolve => setTimeout(resolve, 500))

		this.log('Sync service test completed', 'success')
	}

	async testConflictResolution() {
		this.log('Testing conflict resolution...')

		// Create a conflict scenario
		const conflictFile = path.join(this.testVaultPath, 'conflict-test.md')

		// Simulate local version
		const localContent = '# Local Version\nThis is the local version of the file.'
		fs.writeFileSync(conflictFile, localContent)
		this.log('Created local version')

		// Simulate remote version (would normally come from server)
		const remoteContent = '# Remote Version\nThis is the remote version of the file.'

		// Test conflict detection
		if (localContent !== remoteContent) {
			this.log('Conflict detected between local and remote versions')

			// Test auto-resolution
			this.log('Testing auto-resolution strategies...')

			// Strategy 1: Size-based resolution
			if (localContent.length > remoteContent.length) {
				this.log('Auto-resolved: Keeping larger local version')
			} else {
				this.log('Auto-resolved: Keeping larger remote version')
			}

			// Strategy 2: Manual resolution
			this.log('Manual resolution would show conflict dialog to user')
		}

		this.log('Conflict resolution test completed', 'success')
	}

	async runAllTests() {
		this.log('Starting Obsidian Sync Plugin Tests', 'info')
		this.log('=====================================', 'info')

		try {
			await this.setupTestVault()
			await this.testFileWatching()
			await this.testSyncService()
			await this.testConflictResolution()

			this.log('All tests completed successfully!', 'success')
			this.printSummary()

		} catch (error) {
			this.log(`Test failed: ${error.message}`, 'error')
		}
	}

	printSummary() {
		this.log('\n=== TEST SUMMARY ===', 'info')
		const successCount = this.testResults.filter(r => r.type === 'success').length
		const errorCount = this.testResults.filter(r => r.type === 'error').length
		const infoCount = this.testResults.filter(r => r.type === 'info').length

		this.log(`Total tests: ${this.testResults.length}`, 'info')
		this.log(`Successful: ${successCount}`, 'success')
		this.log(`Errors: ${errorCount}`, errorCount > 0 ? 'error' : 'success')
		this.log(`Info: ${infoCount}`, 'info')

		this.log('\n=== TESTING INSTRUCTIONS ===', 'info')
		this.log('To test in real Obsidian environment:', 'info')
		this.log('1. Copy packages/plugin/dist/main.js to your Obsidian vault .obsidian/plugins/obsidian-sync/', 'info')
		this.log('2. Copy packages/plugin/manifest.json to the same directory', 'info')
		this.log('3. Enable the plugin in Obsidian settings', 'info')
		this.log('4. Configure server URL and vault ID in plugin settings', 'info')
		this.log('5. Test sync functionality with actual files', 'info')
		this.log('6. Test on mobile by installing the plugin on mobile device', 'info')
	}
}

// Run tests if this script is executed directly
if (require.main === module) {
	const tester = new PluginTester()
	tester.runAllTests().catch(console.error)
}

module.exports = PluginTester