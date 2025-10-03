# Vync

A **serverless** plugin for syncing Obsidian vaults directly to Google Drive.

## Features

- **Serverless Architecture**: Connects directly to Google Drive - no server deployment required!
- **Secure**: OAuth tokens stored locally on your machine, never on any server
- **File Watching**: Automatically detects changes to vault files
- **Delta Sync**: Efficient sync - only uploads/downloads changed files
- **Conflict Resolution**: Detects and resolves sync conflicts
- **Auto-sync**: Configurable automatic syncing on file changes
- **Cross-platform**: Works on desktop Obsidian

## How It Works

The plugin syncs your vault directly to Google Drive:

1. Files are stored in a vault-specific folder in your Google Drive
2. OAuth authentication is handled entirely within the plugin
3. Tokens are stored locally in Obsidian's plugin settings
4. No intermediate server needed!

## Installation

1. Copy `main.js` and `manifest.json` to your Obsidian vault `.obsidian/plugins/vync/`
2. Enable the plugin in Obsidian settings
3. Configure Google OAuth credentials (see Configuration below)

## Configuration

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable "Google Drive API" for your project
4. Go to "APIs & Services" → "Credentials"
5. Click "Create Credentials" → "OAuth 2.0 Client ID"
6. Choose "Desktop app" as application type (NOT web application)
7. Copy the generated **Client ID** and **Client Secret**

### Step 2: Configure Plugin

1. Open Obsidian Settings
2. Navigate to the Vync plugin settings
3. Enter your **Google Client ID** and **Google Client Secret**
4. Enter a unique **Vault ID** (e.g., "my-vault")
5. Click **"Authenticate with Google Drive"**
6. Follow the OAuth flow:
   - Copy the authorization URL and open it in a browser
   - Grant permissions
   - Copy the authorization code
   - Paste it back into the plugin
7. You're ready to sync!

### Settings

- **Google Client ID**: OAuth 2.0 Client ID from Google Cloud Console
- **Google Client Secret**: OAuth 2.0 Client Secret from Google Cloud Console
- **Vault ID**: Unique identifier for your vault (creates a folder in Google Drive)
- **Sync Interval**: Auto-sync interval in seconds (default: 30)
- **Auto Sync**: Enable automatic syncing on file changes
- **Conflict Resolution**: How to handle sync conflicts (local/remote/manual)

## Usage

### Manual Sync

- Click the sync icon in the ribbon, or
- Use the command palette: "Sync Vault"

### Auto Sync

With auto-sync enabled, the plugin automatically:
- Uploads files when you create or modify them
- Downloads files from Google Drive periodically
- Detects and handles conflicts

### Testing Connection

Use the command "Test Google Drive Connection" to verify authentication.

## Development

### Building

```bash
cd packages/plugin
bun install
bun run build
```

The built plugin will be in `main.js`.

### Project Structure

```
src/
├── main.ts                     # Main plugin entry point
├── services/
│   ├── syncService.ts          # Core sync logic and delta calculation
│   ├── googleDriveAuth.ts      # Browser-compatible OAuth handling
│   ├── googleDriveService.ts   # Google Drive API operations
│   ├── vaultWatcher.ts         # File change detection
│   ├── syncState.ts            # Sync state management
│   └── conflictUI.ts           # Conflict resolution UI
```

## Architecture

### Serverless Design

The plugin uses a **completely serverless** architecture:

1. **OAuth Flow**: Handled client-side using browser-compatible APIs
2. **Token Storage**: Tokens stored in Obsidian's plugin settings (local machine)
3. **Delta Calculation**: Performed client-side by comparing local and remote states
4. **Google Drive API**: Called directly from the plugin using `requestUrl` API
5. **No Server**: No backend deployment, maintenance, or security concerns

### Benefits

- ✅ No server to deploy or maintain
- ✅ Better security (tokens never leave your machine)
- ✅ Lower latency (direct Google Drive connection)
- ✅ Reduced complexity
- ✅ Cost-effective (no server hosting fees)

## Sync Process

1. **Scan Local Vault**: Find all files and their metadata
2. **Fetch Remote Files**: List files from Google Drive
3. **Calculate Delta**: Determine which files need upload/download
4. **Upload Changes**: Upload new or modified files to Google Drive
5. **Download Changes**: Download files that were updated remotely
6. **Detect Conflicts**: Identify files modified both locally and remotely
7. **Update Sync State**: Track last sync time, hashes, and file IDs

## Troubleshooting

### Common Issues

**1. Authentication Failed**
- Verify your Client ID and Client Secret are correct
- Make sure you selected "Desktop app" type when creating OAuth credentials
- Try signing out and re-authenticating

**2. Sync Not Working**
- Check if Google Drive is authenticated (Settings → Test Google Drive Connection)
- Verify your Vault ID is set
- Check the developer console for error messages

**3. Files Not Syncing**
- Ensure auto-sync is enabled
- Check if the file type is supported (md, txt, pdf, png, jpg, etc.)
- Look for error messages in the console

**4. Conflicts Not Resolving**
- Review conflict resolution settings
- Manually resolve conflicts through the conflict UI

### Debug Mode

Enable Obsidian's developer tools:
- View → Toggle Developer Tools
- Check the Console tab for detailed logging
- All sync operations are logged with emojis for easy identification

### OAuth Token Issues

If you're having token issues:
1. Sign out from plugin settings
2. Clear the plugin settings
3. Re-enter OAuth credentials
4. Authenticate again

## File Storage in Google Drive

Files are stored in Google Drive with this structure:

```
Google Drive/
└── vault_{your-vault-id}/
    ├── note1.md
    ├── note2.md
    ├── folder1/
    │   ├── note3.md
    │   └── note4.md
    └── attachments/
        ├── image.png
        └── document.pdf
```

The folder structure matches your vault structure exactly.

## Security

- **OAuth Tokens**: Stored locally in Obsidian settings, never transmitted to any third-party server
- **Google Drive Access**: Uses OAuth 2.0 with minimal scope (`drive.file` - only accesses files created by the plugin)
- **No Server**: Tokens never pass through any intermediate server
- **Direct Connection**: Plugin communicates directly with Google Drive API over HTTPS

## Migration from Server-Based Setup

If you previously used a server-based version:

1. Your Google Drive data is compatible - no migration needed
2. Update to the latest plugin version
3. Stop/uninstall the old server
4. Configure OAuth credentials in plugin settings
5. Authenticate with Google Drive
6. Your files will be recognized and sync will continue seamlessly

## Support

For issues and questions:
- Check the console logs for detailed error messages
- Verify OAuth credentials are correct
- Ensure Google Drive API is enabled in your Google Cloud project
- Test with a simple vault first

## Future Enhancements

Potential improvements:
- Mobile support (Obsidian Mobile)
- End-to-end encryption
- Selective sync (exclude folders)
- Bandwidth throttling
- Offline mode improvements

## License

MIT License
