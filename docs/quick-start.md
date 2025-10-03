# Quick Start Guide

Get Vync up and running in under 10 minutes. No server required!

## Prerequisites

- [Bun](https://bun.sh/) installed (for development)
- Google Cloud account (free tier works)
- Obsidian installed

---

## Step 1: Google Drive API Setup (5 minutes)

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "New Project" (or select existing project)
3. Name it "Obsidian Vync" (or your preference)
4. Click "Create"

### 1.2 Enable Google Drive API

1. In the left sidebar, go to **"APIs & Services" → "Library"**
2. Search for **"Google Drive API"**
3. Click on it and press **"Enable"**

### 1.3 Create OAuth Credentials

1. Go to **"APIs & Services" → "Credentials"**
2. Click **"Create Credentials" → "OAuth 2.0 Client ID"**
3. If prompted, configure OAuth consent screen:
   - User Type: **External**
   - App name: **Vync** (or your preference)
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue** through all steps
4. Back at "Create OAuth Client ID":
   - Application type: **Desktop app**
   - Name: **Vync Desktop Client**
   - Click **Create**
5. **Download JSON** or copy:
   - Client ID: `xxxxx.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxxxx`

**✅ Checkpoint**: You should have Client ID and Client Secret ready

---

## Step 2: Install Plugin (3 minutes)

### Option A: From Community Plugins (When Available)

1. Open Obsidian
2. Go to **Settings → Community Plugins**
3. Click **Browse**
4. Search for **"Vync"**
5. Click **Install** → **Enable**

### Option B: Manual Installation (Development)

```bash
# Clone repository
git clone <repository-url>
cd vync

# Install dependencies
bun install

# Build plugin
cd packages/plugin
bun run build

# Copy to your vault
mkdir -p /path/to/your/vault/.obsidian/plugins/vync
cp -r dist/* /path/to/your/vault/.obsidian/plugins/vync/
```

**For Development:**
```bash
# Create symlink instead of copying
ln -s $(pwd)/packages/plugin /path/to/your/vault/.obsidian/plugins/vync

# Then run dev mode
bun run dev
```

**✅ Checkpoint**: Plugin appears in Obsidian Settings → Community Plugins

---

## Step 3: Configure Plugin (2 minutes)

### 3.1 Enable Plugin

1. Open Obsidian
2. Go to **Settings → Community Plugins**
3. Find **Vync** in the list
4. Toggle it **ON**

### 3.2 Enter Google Credentials

1. Go to **Settings → Vync**
2. Under **"Google Drive Authentication"**:
   - Paste **Client ID** from Step 1.3
   - Paste **Client Secret** from Step 1.3
3. Click **"Authenticate with Google Drive"**
4. Browser will open → **Select your Google account**
5. Click **"Allow"** to grant permissions
6. Return to Obsidian

**✅ Checkpoint**: Status shows "✓ Connected to Google Drive"

### 3.3 Configure Sync Settings

```
Settings → Vync:
├── Auto Sync: ON
├── Sync Interval: 5 minutes
├── Conflict Resolution: Prompt me
└── Tombstone Grace Period: 30 days
```

**✅ Checkpoint**: Settings saved successfully

---

## Step 4: Test Sync (1 minute)

### 4.1 Create Test File

1. Create new note: **`test-sync.md`**
2. Add some content:
   ```markdown
   # Test Sync

   This is a test file to verify Vync is working!

   - Created at: [timestamp]
   - Synced via: Vync
   ```
3. Save (Cmd/Ctrl + S)

### 4.2 Verify Sync

**Check Obsidian Console** (Cmd/Ctrl + Shift + I):
```
[Vync] File created: test-sync.md
[Vync] Uploading to Google Drive...
[Vync] ✓ Upload successful: test-sync.md
```

**Check Google Drive**:
1. Go to [Google Drive](https://drive.google.com)
2. Look for **"Obsidian Vaults"** folder
3. Find your vault name folder
4. **`test-sync.md`** should be there!

**✅ Success!** Your vault is now syncing!

---

## Common Issues & Solutions

### Issue: "Authentication Failed"

**Symptoms**: Can't connect to Google Drive

**Solutions**:
1. **Check credentials**: Verify Client ID and Secret are correct
2. **OAuth consent screen**: Make sure it's configured in Google Cloud
3. **App type**: Must be "Desktop app", not "Web application"
4. **Try re-authenticating**: Remove credentials and add again

### Issue: "Files Not Syncing"

**Symptoms**: Files created but not appearing in Drive

**Solutions**:
```bash
# 1. Check auto-sync is enabled
Settings → Vync → Auto Sync: ON

# 2. Manually trigger sync
Cmd/Ctrl + P → "Vync: Full Sync"

# 3. Check sync status
Cmd/Ctrl + P → "Vync: Sync Status"

# 4. Check console for errors
Cmd/Ctrl + Shift + I (Developer Console)
```

### Issue: "Plugin Not Loading"

**Symptoms**: Plugin doesn't appear in settings

**Solutions**:
1. Check files exist:
   ```bash
   ls .obsidian/plugins/vync/
   # Should see: main.js, manifest.json, styles.css
   ```
2. Reload Obsidian: Cmd/Ctrl + R
3. Check Community Plugins are enabled
4. Check console for errors

---

## Useful Commands

### Plugin Commands (Cmd/Ctrl + P)

```
Vync: Full Sync           - Sync entire vault now
Vync: Sync Status         - View current sync state
Vync: Resolve Conflicts   - Handle pending conflicts
Vync: Clear Cache         - Reset sync state
```

### Developer Commands

```bash
# Build plugin
cd packages/plugin
bun run build

# Run tests
bun test

# Run linter
bun run lint

# Watch mode (auto-rebuild)
bun run dev
```

---

## Success Checklist

After completing this guide, you should have:

- ✅ Google Cloud project created
- ✅ Google Drive API enabled
- ✅ OAuth credentials configured
- ✅ Vync plugin installed in Obsidian
- ✅ Plugin authenticated with Google Drive
- ✅ Test file synced successfully
- ✅ File appears in Google Drive
- ✅ Auto-sync enabled and working

**Congratulations! 🎉** Your vault is now syncing with Google Drive!

---

## Getting Help

If you encounter issues:

1. **Check this guide**: Review troubleshooting section
2. **Check console logs**: Cmd/Ctrl + Shift + I in Obsidian
3. **Search issues**: [GitHub Issues](https://github.com/your-repo/issues)
4. **Documentation**: [README](README.md#-troubleshooting)

## Pro Tips 💡

1. **Start Small**: Sync a test vault first before your main vault
2. **Monitor First Sync**: Watch console during initial sync
3. **Understand Conflicts**: Learn conflict resolution before heavy use
4. **Keep Backups**: Vync syncs, but doesn't replace backups
5. **Check Status**: Use "Vync: Sync Status" to verify syncing

---

**Estimated Time**: 10 minutes
**Difficulty**: Beginner
**Prerequisites**: Google account, basic Obsidian knowledge
**Cost**: Free (Google Drive free tier: 15GB)

**Ready to sync?** Let's go! 🚀
