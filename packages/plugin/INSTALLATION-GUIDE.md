# Vync Plugin Installation Guide

## Prerequisites

1. **Obsidian** installed on your system
2. **Sync Server** running (see server setup instructions)
3. **Node.js** (for building the plugin if needed)

## Installation Steps

### Step 1: Prepare the Plugin Files

The plugin files are located in `packages/plugin/` directory:

```
packages/plugin/
├── main.js          # Main plugin file
├── manifest.json    # Plugin manifest
├── styles.css       # Plugin styles
└── services/        # Service files
    ├── vaultWatcher.js
    ├── syncService.js
    └── conflictUI.js
```

### Step 2: Install in Obsidian

1. **Open Obsidian**
2. **Open Settings** (gear icon in bottom left)
3. **Go to Community Plugins**
4. **Turn off Safe Mode** (if enabled)
5. **Click "Browse"** to see community plugins

### Step 3: Manual Installation

Since this is a custom plugin, you'll need to install it manually:

1. **Create Plugin Directory**:
   ```
   # On macOS/Linux
   mkdir -p ~/Documents/Obsidian\ Vault/.obsidian/plugins/vync

   # On Windows
   mkdir "%USERPROFILE%\Documents\Obsidian Vault\.obsidian\plugins\vync"
   ```

2. **Copy Plugin Files**:
   Copy the following files from `packages/plugin/` to your plugin directory:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   - `services/` directory (all .js files)

3. **Restart Obsidian** or reload plugins

### Step 4: Configure the Plugin

1. **Open Obsidian Settings**
2. **Find "Vync"** in the plugin list
3. **Enable the plugin** by toggling it on
4. **Configure Settings**:
   - **Server URL**: `http://localhost:3000` (or your server URL)
   - **Vault ID**: Choose a unique identifier for your vault (e.g., `my-personal-vault`)
   - **Sync Interval**: How often to auto-sync (in seconds)
   - **Auto Sync**: Enable automatic syncing on file changes
   - **Conflict Resolution**: Choose how to handle conflicts

### Step 5: Test the Connection

1. **Click "Test Connection"** button in plugin settings
2. **Check for success message**
3. **If connection fails**, ensure the sync server is running

## Troubleshooting

### Common Issues

#### 1. Plugin Not Loading
- **Check**: Are all files copied correctly?
- **Check**: Is the manifest.json valid?
- **Check**: Are you using the correct Obsidian vault?

#### 2. Server Connection Failed
- **Check**: Is the sync server running?
- **Check**: Is the server URL correct?
- **Check**: Are there any firewall issues?

#### 3. File Watching Not Working
- **Check**: Are you on a supported platform?
- **Check**: Does your vault have proper file permissions?
- **Check**: Are there any console errors in Obsidian?

#### 4. Sync Not Triggering
- **Check**: Is auto-sync enabled?
- **Check**: Is the vault ID set?
- **Check**: Are you making changes to supported file types?

### Debug Mode

1. **Open Obsidian**
2. **Press Ctrl+Shift+I** (or Cmd+Option+I on Mac) to open Developer Tools
3. **Go to Console tab**
4. **Look for error messages** when using the plugin

### Manual Testing

You can manually test the plugin:

1. **Open Command Palette** (Ctrl/Cmd + P)
2. **Search for "Vync"** commands
3. **Run "Sync Vault"** command
4. **Run "Test Connection"** command

## Server Setup

Before using the plugin, you need to set up and run the sync server:

### Quick Server Setup

1. **Navigate to server directory**:
   ```bash
   cd packages/server
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Start the server**:
   ```bash
   bun run src/index.ts
   ```

4. **Verify server is running**:
   - Open browser to `http://localhost:3000`
   - You should see "Vync Server is running!"

### Server Configuration

For production, you may want to:

1. **Set up Google Drive credentials** (optional)
2. **Configure environment variables**
3. **Set up proper logging**
4. **Deploy to a cloud platform**

## Supported File Types

The plugin supports syncing of:
- **Markdown files** (.md)
- **Text files** (.txt)
- **PDF documents** (.pdf)
- **Images** (.png, .jpg, .jpeg, .gif, .svg)
- **Audio files** (.mp3, .wav)
- **Video files** (.mp4, .webm)

## Features

### Core Features
- ✅ **File Watching**: Automatic detection of file changes
- ✅ **Auto Sync**: Configurable automatic syncing
- ✅ **Conflict Resolution**: Multiple resolution strategies
- ✅ **Server Integration**: Full API integration
- ✅ **Settings UI**: Easy configuration

### Advanced Features
- ✅ **Multi-Vault Support**: Different vaults can have different IDs
- ✅ **Progress Tracking**: Sync status and progress indicators
- ✅ **Error Recovery**: Graceful handling of network issues
- ✅ **Performance Optimized**: Efficient file operations

## Next Steps

After successful installation:

1. **Test with a few files** in your vault
2. **Monitor the sync process** in the console
3. **Adjust settings** as needed
4. **Set up multiple devices** for testing
5. **Explore advanced features** like conflict resolution

## Support

If you encounter issues:

1. **Check the troubleshooting section** above
2. **Review console logs** for error messages
3. **Verify server is running** and accessible
4. **Test with simple files** first
5. **Check file permissions** in your vault

## Development

If you want to modify the plugin:

1. **Edit source files** in `packages/plugin/src/`
2. **Rebuild the plugin**:
   ```bash
   cd packages/plugin
   npx tsc src/main.ts --outDir . --module commonjs --target es2020 --esModuleInterop --skipLibCheck
   ```
3. **Copy built files** to your Obsidian plugin directory
4. **Restart Obsidian** or reload plugins

---

**Installation Complete!** 🎉

Your Vync plugin is now ready to use. Start by testing the connection and then try syncing a few files to see the system in action!