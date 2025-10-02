# Obsidian Sync Plugin

A plugin for syncing Obsidian vaults using Google Drive as storage.

## Features

- **File Watching**: Automatically detects changes to vault files
- **Sync Service**: Handles uploading and downloading files to/from server
- **Conflict Resolution**: Detects and resolves sync conflicts
- **Auto-sync**: Configurable automatic syncing on file changes
- **Cross-platform**: Works on desktop and mobile Obsidian

## Installation

1. Copy `dist/main.js` to your Obsidian vault `.obsidian/plugins/obsidian-sync/`
2. Copy `manifest.json` to the same directory
3. Enable the plugin in Obsidian settings
4. Configure the plugin with your server URL and vault ID

## Configuration

- **Server URL**: URL of the sync server (default: http://localhost:3000)
- **Vault ID**: Unique identifier for your vault
- **Sync Interval**: Auto-sync interval in seconds
- **Auto Sync**: Enable automatic syncing on file changes
- **Conflict Resolution**: How to handle sync conflicts (local/remote/manual)

## Testing

### Automated Testing
Run the test script to verify plugin functionality:

```bash
cd packages/plugin
node test-plugin.js
```

### Manual Testing

1. **Desktop Testing**:
   - Install plugin in Obsidian
   - Create/modify files in your vault
   - Verify sync triggers automatically
   - Check server logs for sync activity

2. **Mobile Testing**:
   - Install Obsidian on mobile device
   - Install plugin using BRAT or manual installation
   - Configure with same server URL and vault ID
   - Test sync between desktop and mobile

3. **Conflict Testing**:
   - Modify same file on two devices
   - Trigger sync to create conflict
   - Test different resolution strategies

## Development

### Building
```bash
cd packages/plugin
bun run build
```

### Testing
```bash
cd packages/plugin
node test-plugin.js
```

## API Integration

The plugin communicates with the sync server using these endpoints:

- `POST /sync/upload` - Upload files
- `GET /sync/download/:fileId` - Download files
- `GET /sync/metadata/:vaultId` - Get file metadata
- `POST /sync/watch` - Set up file watching
- `GET /sync/changes` - Get file changes
- `GET /sync/conflicts` - Get pending conflicts
- `POST /sync/resolve-conflict` - Resolve conflicts

## Troubleshooting

### Common Issues

1. **Server Connection Failed**
   - Verify server is running
   - Check server URL configuration
   - Check network connectivity

2. **Sync Not Triggering**
   - Verify auto-sync is enabled
   - Check file watching is working
   - Review console logs for errors

3. **Conflicts Not Resolving**
   - Check conflict resolution settings
   - Verify server conflict endpoints
   - Review conflict resolution logs

### Debug Mode
Enable debug logging by checking the console in Obsidian's developer tools.

## Support

For issues and questions:
- Check the server logs for error details
- Verify plugin and server versions are compatible
- Test with a simple vault first
- Report issues with detailed logs and configuration