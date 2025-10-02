#!/usr/bin/env node

// Simple test script to verify plugin structure
const fs = require('fs')
const path = require('path')

console.log('🧪 Testing Obsidian Sync Plugin Structure\n')

// Test 1: Check if all required files exist
const requiredFiles = [
  'main.js',
  'manifest.json',
  'styles.css',
  'services/vaultWatcher.js',
  'services/syncService.js',
  'services/conflictUI.js'
]

let allFilesExist = true
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file)
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} - Found`)
  } else {
    console.log(`❌ ${file} - Missing`)
    allFilesExist = false
  }
}

// Test 2: Check manifest.json
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))
  console.log(`✅ Manifest valid - ${manifest.name} v${manifest.version}`)
} catch (error) {
  console.log(`❌ Manifest invalid - ${error.message}`)
  allFilesExist = false
}

// Test 3: Check main.js can be loaded
try {
  const mainContent = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8')
  if (mainContent.includes('ObsidianSyncPlugin')) {
    console.log('✅ Main plugin file contains expected class')
  } else {
    console.log('❌ Main plugin file missing expected class')
    allFilesExist = false
  }
} catch (error) {
  console.log(`❌ Cannot read main.js - ${error.message}`)
  allFilesExist = false
}

// Test 4: Check service files
for (const service of ['vaultWatcher', 'syncService', 'conflictUI']) {
  try {
    const serviceContent = fs.readFileSync(path.join(__dirname, `services/${service}.js`), 'utf8')
    if (serviceContent.includes('class') || serviceContent.includes('function')) {
      console.log(`✅ ${service}.js contains code`)
    } else {
      console.log(`❌ ${service}.js appears empty`)
      allFilesExist = false
    }
  } catch (error) {
    console.log(`❌ Cannot read ${service}.js - ${error.message}`)
    allFilesExist = false
  }
}

console.log('\n📋 Installation Instructions:')
console.log('1. Copy this entire directory to: .obsidian/plugins/obsidian-sync/')
console.log('2. Restart Obsidian or reload plugins')
console.log('3. Enable the plugin in Community Plugins')
console.log('4. Configure server URL and vault ID')
console.log('5. Start the sync server (see server README)')

if (allFilesExist) {
  console.log('\n🎉 Plugin structure is valid and ready for installation!')
} else {
  console.log('\n⚠️  Some files are missing or invalid. Please check the structure.')
}

console.log('\n🔧 To test the plugin:')
console.log('- Install in Obsidian as described above')
console.log('- Start sync server: cd packages/server && bun run src/index.ts')
console.log('- Test connection in plugin settings')
console.log('- Create/modify files to test sync')