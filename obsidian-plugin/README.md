# Obsidian Sync Plugin

A custom sync plugin for Obsidian that uses Google Drive as storage (with local fallback).

## Installation

### Step 1: Install Plugin Files

1. **Create plugin directory** in your Obsidian vault:
   ```
   .obsidian/plugins/obsidian-sync/
   ```

2. **Copy all files** from this directory to your plugin folder:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   - `services/` directory (all files)

### Step 2: Enable Plugin

1. **Open Obsidian Settings**
2. **Go to Community Plugins**
3. **Turn off Safe Mode** (if enabled)
4. **Find "Obsidian Sync"** in the plugin list
5. **Enable the plugin**

### Step 3: Configure Plugin

1. **Open Obsidian Settings** (gear icon in bottom left)
2. **Go to Community Plugins**
3. **Find "Obsidian Sync"** in the plugin list
4. **Click the settings icon** (cog wheel) next to the plugin name
5. **Configure the following settings**:
   - **Server URL**: `http://localhost:3000`
   - **Vault ID**: Choose a unique name (e.g., `my-personal-vault`)
   - **Auto Sync**: Enable (toggle on)
   - **Sync Interval**: 30 seconds
   - **Conflict Resolution**: Manual (recommended)

6. **Click "Test Connection"** button to verify server connectivity
7. **Save settings** and close the settings window

### Step 4: Start Sync Server

Before using the plugin, you need to start the sync server:

```bash
# Navigate to server directory
cd packages/server

# Install dependencies
bun install

# Start server
bun run src/index.ts
```

### Step 5: Test Connection

1. **Click "Test Connection"** in plugin settings
2. **Create a test file** in your vault
3. **Watch for sync notifications**

## Features

- ✅ **File Watching**: Automatic detection of file changes
- ✅ **Auto Sync**: Configurable sync intervals
- ✅ **Conflict Resolution**: Multiple resolution strategies
- ✅ **Multi-Vault Support**: Different vaults can have different IDs
- ✅ **File Type Support**: Markdown, text, PDF, images, audio, video

## Troubleshooting

### Common Issues

#### 1. Plugin Not Loading
- Check that all files are copied correctly
- Verify manifest.json is valid
- Restart Obsidian completely
- Check console for error messages (Ctrl+Shift+I)

#### 2. Server Connection Failed
- Ensure sync server is running on port 3000
- Check server URL in plugin settings
- Verify no firewall blocking the connection
- Test server directly: `curl http://localhost:3000/health`
- **CORS Issue**: Server now includes proper CORS headers for Obsidian app

#### 3. Sync Not Working
- **Check vault ID is set** - This is the most common issue!
- Check console for error messages (Ctrl+Shift+I)
- Verify vault ID is set in plugin settings
- Test with simple markdown files first
- Ensure file permissions are correct

#### 4. Vault ID Not Set Error
- Open Obsidian Settings
- Go to Community Plugins
- Find "Obsidian Sync"
- Click the settings icon (cog wheel)
- Set a unique Vault ID (e.g., `my-personal-vault`)
- Save settings

#### 5. Files Not Syncing
- Check that auto-sync is enabled
- Verify server is running and responding
- Look for sync notifications in Obsidian
- Check server logs for sync activity
- Try manual sync using the command palette

## File Structure

```
obsidian-plugin/
├── main.js                    # Main plugin file
├── manifest.json             # Plugin manifest
├── styles.css                # Plugin styles
└── services/                 # Service modules
    ├── vaultWatcher.js       # File watching service
    ├── syncService.js        # Sync communication service
    └── conflictUI.js         # Conflict resolution service
```

## Commands

- **Sync Vault**: Manually trigger a vault sync
- **Test Server Connection**: Test connection to sync server

## Settings

- **Server URL**: URL of the sync server
- **Vault ID**: Unique identifier for your vault
- **Sync Interval**: Auto-sync interval in seconds
- **Auto Sync**: Enable automatic syncing
- **Conflict Resolution**: How to handle sync conflicts

## Testing the Sync

### Manual Testing Steps

1. **Create a test file** in your Obsidian vault:
   ```
   Test-Sync.md
   # Test Sync
   This file should be synced automatically.
   ```

2. **Wait for sync** (or trigger manual sync)
3. **Check server logs** for sync activity
4. **Verify file appears** in server storage

### Using Commands

1. **Open Command Palette** (Ctrl/Cmd + P)
2. **Search for "Obsidian Sync"** commands:
   - `Obsidian Sync: Sync Vault` - Manual sync
   - `Obsidian Sync: Test Server Connection` - Test connection

### Expected Behavior

- **File Creation**: New files should sync automatically
- **File Modification**: Changed files should sync automatically
- **Notifications**: You should see sync status notifications
- **Server Logs**: Server should show sync activity

## Support

For issues:
1. Check the troubleshooting section above
2. Review console logs for error messages
3. Verify server is running and accessible
4. Test with simple files first
5. Check that vault ID is properly configured

## Development

To modify the plugin:
1. Edit source files in `packages/plugin/src/`
2. Rebuild with TypeScript compiler
3. Copy built files to plugin directory
4. Restart Obsidian

---

**Ready to sync!** 🚀