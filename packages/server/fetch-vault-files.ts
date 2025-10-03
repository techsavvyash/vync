import { GoogleDriveService } from './src/services/drive/GoogleDriveService'
import { google } from 'googleapis'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

/**
 * Standalone script to fetch all files from Google Drive for a specific vault ID
 * Usage: cd packages/server && bun run fetch-vault-files.ts
 */

async function main() {
  const vaultId = 'test-vault-obs-sync'

  console.log('🚀 Fetching files from Google Drive')
  console.log(`📦 Vault ID: ${vaultId}`)
  console.log('🔑 OAuth configured:', process.env.GOOGLE_CLIENT_ID ? 'Yes' : 'No')
  console.log('---')

  const driveService = new GoogleDriveService()

  // Wait a bit for authentication to complete
  await new Promise(resolve => setTimeout(resolve, 1000))

  if (!driveService.isAuthenticated()) {
    console.error('❌ Google Drive is not authenticated')
    console.error('Make sure you have either:')
    console.error('  1. credentials.json in the project root, OR')
    console.error('  2. oauth-tokens.json with valid OAuth tokens')
    process.exit(1)
  }

  // Get vault folder link and list files using RAW API
  const folderName = `vault_${vaultId}`
  const drive = (driveService as any).drive // Access private drive instance

  let vaultFolderId: string | null = null

  // First, check for ALL folders with this name pattern
  console.log('🔍 Searching for all vault folders matching pattern...\n')
  try {
    const allFoldersResponse = await drive.files.list({
      q: `name contains 'vault_' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive'
    })

    if (allFoldersResponse.data.files && allFoldersResponse.data.files.length > 0) {
      console.log(`Found ${allFoldersResponse.data.files.length} vault folder(s):\n`)
      allFoldersResponse.data.files.forEach((folder: any, idx: number) => {
        console.log(`${idx + 1}. ${folder.name}`)
        console.log(`   ID: ${folder.id}`)
        console.log(`   Link: ${folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`}`)
        console.log('')
      })
    }
  } catch (error) {
    console.warn('⚠️  Could not list vault folders:', error)
  }

  console.log('---\n')

  try {
    const folderResponse = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive'
    })

    if (folderResponse.data.files && folderResponse.data.files.length > 0) {
      const folder = folderResponse.data.files[0]
      vaultFolderId = folder.id
      console.log(`📁 Target Vault Folder: ${folder.name}`)
      console.log(`🔗 Folder Link: ${folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`}`)

      if (folderResponse.data.files.length > 1) {
        console.log(`⚠️  WARNING: Found ${folderResponse.data.files.length} folders with this exact name!`)
      }
      console.log('---\n')
    }
  } catch (error) {
    console.warn('⚠️  Could not fetch folder link:', error)
  }

  // Try RAW API call to list ALL items (including folders and Google Docs)
  if (vaultFolderId) {
    console.log('🔍 RAW API: Listing ALL items in vault folder (including folders)...')
    try {
      const rawResponse = await drive.files.list({
        q: `'${vaultFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, modifiedTime, size)',
        pageSize: 1000
      })

      console.log(`✅ RAW API found ${rawResponse.data.files?.length || 0} items (files + folders):\n`)
      if (rawResponse.data.files && rawResponse.data.files.length > 0) {
        rawResponse.data.files.forEach((file: any, index: number) => {
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
          const isGoogleDoc = file.mimeType?.startsWith('application/vnd.google-apps.')
          console.log(`${index + 1}. ${isFolder ? '📁' : '📄'} ${file.name}${isGoogleDoc ? ' (Google Doc/Sheet/etc)' : ''}`)
          console.log(`   ID: ${file.id}`)
          console.log(`   Type: ${file.mimeType}`)
          console.log(`   Size: ${file.size || 'N/A'} bytes`)
          console.log(`   Modified: ${file.modifiedTime}`)
          console.log('')
        })
      }
    } catch (error) {
      console.error('❌ RAW API error:', error)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📦 DriveService.listFiles() results:')
  console.log('='.repeat(60) + '\n')

  const result = await driveService.listFiles(vaultId)

  if (!result.success) {
    console.error('❌ Failed to fetch files:', result.error)
    process.exit(1)
  }

  console.log(`✅ DriveService found ${result.files?.length || 0} files\n`)

  if (result.files && result.files.length > 0) {
    console.log('Files:')
    console.log('---')
    result.files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`)
      console.log(`   ID: ${file.id}`)
      console.log(`   Type: ${file.mimeType}`)
      console.log(`   Size: ${file.size} bytes`)
      console.log(`   Modified: ${file.modifiedTime}`)
      console.log(`   View: ${file.webViewLink || 'N/A'}`)
      console.log('')
    })
  } else {
    console.log('No files found in this vault')
  }
}

main().catch(console.error)
