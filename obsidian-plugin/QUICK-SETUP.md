# Quick Setup Guide for Obsidian Sync

## 🚀 Get Syncing in 5 Minutes

### Step 1: Install Plugin (2 minutes)

1. **Copy the plugin folder**:
   ```bash
   cp -r obsidian-plugin ~/.obsidian/plugins/obsidian-sync/
   ```

2. **Restart Obsidian** (or reload plugins)

3. **Enable the plugin**:
   - Settings → Community Plugins → Find "Obsidian Sync" → Enable

### Step 2: Start Server (1 minute)

```bash
# In a new terminal
cd packages/server
bun install
bun run src/index.ts
```

### Step 3: Configure Plugin (2 minutes)

1. **Open Obsidian Settings**
2. **Find "Obsidian Sync"** in the plugin list
3. **Click the settings icon** (⚙️)
4. **Set these values**:
   - **Server URL**: `http://localhost:3000`
   - **Vault ID**: `my-vault` (or any unique name)
   - **Auto Sync**: ✅ Enabled
   - **Sync Interval**: 30 seconds
   - **Conflict Resolution**: Manual

5. **Click "Test Connection"** - should show success

### Step 4: Test Sync (30 seconds)

1. **Create a test file** in your vault:
   ```
   Test-Sync.md
   # Hello Sync
   This file should sync automatically!
   ```

2. **Wait 30 seconds** (or trigger manual sync)
3. **Check for notification**: "Sync completed"

## ✅ Success Indicators

- **Plugin loads** without errors
- **Test Connection** shows success (no CORS errors)
- **Sync notifications** appear
- **Server logs** show sync activity
- **CORS headers** are properly configured

## 🔧 If It Doesn't Work

### Most Common Issue: Missing Vault ID

**Symptoms**: "Please set a vault ID" error

**Fix**:
1. Go to Obsidian Settings
2. Find "Obsidian Sync"
3. Click settings icon
4. Set Vault ID to something unique
5. Save settings

### Server Not Running

**Symptoms**: Connection test fails

**Fix**:
```bash
cd packages/server
bun run src/index.ts
```

### CORS Issues

**Symptoms**: "CORS policy" errors in console

**Status**: ✅ **FIXED** - Server now includes proper CORS headers
- Server configured with `Access-Control-Allow-Origin: app://obsidian.md`
- All endpoints support OPTIONS preflight requests
- Credentials and proper headers are allowed

### Plugin Not Loading

**Symptoms**: Plugin doesn't appear in settings

**Fix**:
1. Check all files are copied correctly
2. Restart Obsidian completely
3. Check console for errors (Ctrl+Shift+I)

## 🎯 Quick Test

After setup, create this file in your vault:

```
Sync-Test.md
# Sync Test
- [ ] File created
- [ ] File synced
- [ ] Notification received
```

If you see a sync notification within 30 seconds, it's working! ✅

## 📞 Need Help?

1. Check the troubleshooting section in README.md
2. Verify all steps above are completed
3. Check console logs for error messages
4. Ensure server is running on port 3000

**The most common issue is forgetting to set the Vault ID!**