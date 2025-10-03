# Quick Start Guide

Get up and running with Obsidian Sync in under 10 minutes.

## Prerequisites

- [Bun](https://bun.sh/) installed
- Google Cloud account (for Google Drive sync)
- Obsidian installed

## Step 1: Server Setup (5 minutes)

### 1.1 Clone and Install
```bash
git clone <repository-url>
cd obs-sync/packages/server
bun install
```

### 1.2 Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# For development with local storage (no Google setup needed):
# Leave DRIVE_TYPE=local in .env

# For Google Drive (continue to Step 2):
# Set DRIVE_TYPE=google in .env
```

### 1.3 Start Server
```bash
bun run dev
```

You should see:
```
🦊 Server is running at localhost:3000
```

**✅ Checkpoint**: Visit http://localhost:3000/health - should show `"status": "ok"`

---

## Step 2: Google Drive Setup (Optional, 5 minutes)

Skip this if using local storage for testing.

### 2.1 Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project (or select existing)
3. Enable **Google Drive API**:
   - Search for "Google Drive API" in Library
   - Click Enable

4. Create **OAuth 2.0 Client ID**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Add redirect URI: `http://localhost:3000/auth/google/callback`
   - Click Create

5. Copy credentials:
   - Client ID: `123456789-abc.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxxxx`

### 2.2 Update .env
```bash
# Open .env file
DRIVE_TYPE=google
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

### 2.3 Authenticate
```bash
# Restart server
bun run dev

# Visit in browser
http://localhost:3000/auth/google

# Click "Authenticate with Google"
# Grant permissions
# You'll see "Authentication Successful!"
```

**✅ Checkpoint**: Visit http://localhost:3000/auth/status - should show `"authenticated": true`

---

## Step 3: Obsidian Plugin Setup (2 minutes)

### 3.1 Build Plugin
```bash
cd ../plugin
bun install
bun run build
```

### 3.2 Install Plugin

**Option A: Manual Install**
1. Copy `packages/plugin` folder to your vault's `.obsidian/plugins/`
2. Rename to `obsidian-sync`
3. Reload Obsidian (Cmd/Ctrl + R)
4. Enable plugin in Settings → Community Plugins

**Option B: Development Install**
1. Create symlink from your vault to plugin folder
2. Reload Obsidian

### 3.3 Configure Plugin

Open Obsidian Settings → Obsidian Sync:

```
Server URL: http://localhost:3000
Vault ID: my-vault
Auto Sync: ON
Sync Interval: 30 (seconds)
```

**✅ Checkpoint**: Click "Test Connection" - should show success message

---

## Step 4: Test Sync (1 minute)

### 4.1 Create Test File
1. Create new note in Obsidian: `test-sync.md`
2. Type some content
3. Save (Cmd/Ctrl + S)

### 4.2 Verify Upload
**Console (Cmd/Ctrl + Option/Alt + I):**
```
🆕 Handling new file creation: test-sync.md
✅ Added new file to sync index: test-sync.md
✅ Uploaded new file: test-sync.md
```

**Google Drive** (if using Google):
1. Go to Google Drive
2. Look for "Obsidian Vaults" folder
3. Should see your vault folder with `test-sync.md`

**✅ Success!** Your sync is working!

---

## Common Issues & Solutions

### Issue: Server won't start
**Error**: `Port 3000 already in use`
```bash
# Solution: Use different port
PORT=8080 bun run dev
# Update Obsidian plugin Server URL to http://localhost:8080
```

### Issue: OAuth Error
**Error**: `redirect_uri_mismatch`
```bash
# Solution: Add redirect URI to Google Console
1. Go to Google Cloud Console
2. Navigate to your OAuth Client
3. Add: http://localhost:3000/auth/google/callback
4. Save and retry
```

### Issue: Files not syncing
**Error**: Files created but not uploaded
```bash
# Solution 1: Check auto-sync is enabled
Settings → Obsidian Sync → Auto Sync: ON

# Solution 2: Run manual reconciliation
Cmd/Ctrl + P → "Reconcile Sync Index"

# Solution 3: Check server logs
# Look for errors in terminal where server is running
```

### Issue: Authentication Failed
**Error**: `Google Drive not authenticated`
```bash
# Solution: Complete OAuth flow
1. Visit http://localhost:3000/auth/google
2. Grant permissions
3. Check status: curl http://localhost:3000/auth/status
```

---

## Next Steps

### 1. Test Advanced Features

**Folder Sync:**
```
1. Create folder: docs/projects
2. Add file: docs/projects/readme.md
3. Check Google Drive structure matches
```

**Binary Files:**
```
1. Add PDF to vault
2. Watch console for upload confirmation
3. Verify in Google Drive
```

**Index Reconciliation:**
```
1. Copy files directly to vault folder (outside Obsidian)
2. Wait 5 seconds or run "Reconcile Sync Index"
3. Files should be detected and synced
```

### 2. Configure for Production

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for:
- Deploying to cloud platforms
- Setting up HTTPS
- Production environment variables
- Security best practices

### 3. Customize Settings

**Obsidian Plugin:**
- Sync interval (how often to check)
- Conflict resolution strategy
- File size limits

**Server:**
- CORS origins
- Debug logging
- Storage backend

---

## Useful Commands

### Development
```bash
# Start server
cd packages/server && bun run dev

# Build plugin
cd packages/plugin && bun run build

# Rebuild both
bun run build
```

### Testing
```bash
# Test server health
curl http://localhost:3000/health

# Test authentication
curl http://localhost:3000/auth/status

# Manual sync (from Obsidian)
Cmd/Ctrl + P → "Sync Vault"

# Reconcile index
Cmd/Ctrl + P → "Reconcile Sync Index"
```

### Debugging
```bash
# Start with debug logs
DEBUG=true bun run dev

# View Obsidian console
Cmd/Ctrl + Option/Alt + I

# Check sync index
cat .obsidian/sync-index.json
```

---

## Resources

### Documentation
- [Full Documentation](SUMMARY.md)
- [Environment Setup](packages/server/ENV_SETUP_GUIDE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Environment Variables](ENVIRONMENT_VARIABLES.md)

### Features
- [Folder Sync](FOLDER_SYNC_DOCUMENTATION.md)
- [OAuth Setup](OAUTH_REDIRECT_FIX.md)
- [PDF Upload Fix](PDF_UPLOAD_FIX.md)

### Testing
- [Test Instructions](TEST_INSTRUCTIONS.md)
- [OAuth Testing](TEST_OAUTH_REDIRECT.md)

---

## Success Checklist

After completing this guide, you should have:

✅ Server running on http://localhost:3000
✅ Google Drive authenticated (if using Google)
✅ Obsidian plugin installed and configured
✅ Test file successfully synced
✅ Folder structure preserved in Google Drive
✅ Real-time sync working on file save

**Congratulations! 🎉** Your Obsidian Sync is now fully operational!

---

## Getting Help

If you encounter issues:

1. **Check Console Logs**: Both Obsidian and server terminals
2. **Review Documentation**: See resources above
3. **Common Issues**: See troubleshooting section above
4. **GitHub Issues**: Open an issue with error logs

## Pro Tips 💡

1. **Use Local Storage First**: Test with `DRIVE_TYPE=local` before Google Drive
2. **Enable Debug Logs**: Set `DEBUG=true` while learning
3. **Test with Small Vault**: Start with a few files
4. **Monitor Console**: Keep DevTools open to watch sync activity
5. **Backup First**: Always backup your vault before testing sync

---

**Estimated Time**: 10-15 minutes
**Difficulty**: Beginner
**Prerequisites**: Basic command line knowledge