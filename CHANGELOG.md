# Changelog

## [1.0.0] - 2024-01-XX

### 🎉 Major Features

#### File Sync Improvements
- ✅ **Real-time File Creation Sync**: Files are now immediately uploaded to Google Drive when created in Obsidian
- ✅ **Real-time File Modification Sync**: File changes are synced immediately upon saving
- ✅ **Index Reconciliation**: Periodic scanning ensures all files are tracked and synced
- ✅ **Untracked File Detection**: Automatically detects and syncs files created outside of Obsidian

#### Folder Structure Support
- ✅ **Complete Folder Tracking**: Folders are now tracked in the sync index
- ✅ **Folder Hierarchy Preservation**: Full directory structure maintained in Google Drive
- ✅ **Nested Folder Support**: Automatic creation of nested folder paths
- ✅ **Folder Event Handling**: Real-time handling of folder create, delete, and rename operations
- ✅ **Smart Folder Creation**: Folders created automatically when files are uploaded

#### OAuth & Deployment
- ✅ **Dynamic OAuth Redirect URI**: Auto-detects redirect URI from incoming requests
- ✅ **Remote Deployment Support**: Works on any hosting platform without configuration
- ✅ **Environment Variable Override**: Optional manual redirect URI configuration
- ✅ **Multi-Environment Support**: Single OAuth setup works for dev, staging, and production

### 🐛 Bug Fixes

#### PDF/Binary File Upload
- ✅ **Fixed Stack Overflow**: Large file uploads (>65KB) no longer crash
- ✅ **Chunked Base64 Encoding**: Binary data processed in 32KB chunks
- ✅ **Support for Large Files**: PDFs, images, and videos of any size now work

#### Index & Sync Issues
- ✅ **New Files Not Syncing**: Fixed issue where newly created files weren't uploaded
- ✅ **Index Parity**: Ensures complete parity between vault and sync index
- ✅ **Folder Rename Issues**: All file paths properly updated on folder rename

#### Folder Download Issues
- ✅ **Fixed Folder Creation on Download**: Parent folders now created before downloading files
- ✅ **Remote Folder Sync**: Folder structure from other devices properly recreated locally
- ✅ **Recursive Folder Creation**: Deep nested folders handled correctly
- ✅ **Cross-Device Folder Sync**: Complete folder hierarchy preserved across all devices

### 📚 Documentation

#### New Documentation
- 📄 `DEPLOYMENT_GUIDE.md` - Complete deployment guide for various platforms
- 📄 `OAUTH_REDIRECT_FIX.md` - OAuth redirect URI implementation details
- 📄 `FOLDER_SYNC_DOCUMENTATION.md` - Folder sync features and usage
- 📄 `PDF_UPLOAD_FIX.md` - Binary file upload fix details
- 📄 `TEST_OAUTH_REDIRECT.md` - OAuth testing procedures
- 📄 `ENV_SETUP_GUIDE.md` - Environment configuration guide
- 📄 `packages/server/README.md` - Server documentation

#### Updated Documentation
- 📄 `TEST_INSTRUCTIONS.md` - Updated with new testing scenarios
- 📄 `.env.example` - Comprehensive environment variable documentation
- 📄 `.env` - Production-ready configuration

### 🔧 Technical Changes

#### Plugin (Client-Side)
```typescript
// New Methods in SyncService
- handleFileCreation(filePath: string)
- handleFileModification(filePath: string)
- handleFileDeletion(filePath: string)
- handleFolderCreation(folderPath: string)
- handleFolderDeletion(folderPath: string)
- handleFolderRename(oldPath: string, newPath: string)
- reconcileIndex() // Enhanced with folder support
- arrayBufferToBase64(buffer: ArrayBuffer) // Binary file fix
- ensureParentFoldersExist(filePath: string) // Folder download fix
```

#### Server
```typescript
// GoogleDriveService Updates
- getOAuth2Client(redirectUri?: string) // Dynamic redirect URI
- getAuthUrl(redirectUri?: string) // Pass redirect URI
- ensureFolderPath(folderPath: string, parentFolderId: string) // Folder creation
- createFolder(folderName: string, parentFolderId?: string) // Single folder creation
- uploadFile() // Now handles folder paths
```

#### Event Handling
```typescript
// Main Plugin
- Immediate file event handling (create, modify, delete)
- Immediate folder event handling (create, delete, rename)
- Index reconciliation timer (every 5 minutes)
- Initial reconciliation on startup (5 seconds delay)
```

### 🚀 Performance Improvements

- **Chunked Binary Encoding**: 32KB chunks prevent stack overflow
- **Immediate Sync**: Files uploaded as soon as they're created/modified
- **Periodic Reconciliation**: Catches missed files every 5 minutes
- **Smart Folder Creation**: Only creates folders when needed

### 🔐 Security Enhancements

- **Auto-Detected Redirect URI**: Prevents hardcoded localhost URLs
- **Environment-Specific Config**: Separate credentials per environment
- **HTTPS Support**: Automatic protocol detection
- **CORS Configuration**: Configurable allowed origins

### 📦 Dependencies

No new dependencies added. All features implemented using existing packages.

### 🔄 Migration Notes

#### For Existing Users

1. **Update Environment Variables**:
   ```bash
   # Optional: Remove hardcoded redirect URI
   # GOOGLE_REDIRECT_URI will be auto-detected
   ```

2. **Google Cloud Console**:
   ```
   Add production redirect URI:
   https://your-domain.com/auth/google/callback
   ```

3. **Reload Plugin**:
   ```
   Cmd/Ctrl + R in Obsidian
   ```

4. **Run Index Reconciliation**:
   ```
   Use "Reconcile Sync Index" command to catch any missed files
   ```

### ⚠️ Breaking Changes

None. All changes are backward compatible.

### 🎯 What's Next

#### Planned Features
- [ ] File deletion from Google Drive
- [ ] Folder deletion from Google Drive
- [ ] Empty folder syncing option
- [ ] Folder-level conflict resolution
- [ ] Selective sync (include/exclude patterns)
- [ ] Bandwidth optimization
- [ ] Delta sync improvements
- [ ] Real-time collaboration features

#### Known Limitations
- Empty folders not synced (only created when files added)
- Folder deletion in Google Drive requires manual cleanup
- Large file uploads may be slow (no chunked upload yet)

### 📊 Metrics

- **Code Quality**: All TypeScript, fully typed
- **Test Coverage**: Manual testing completed
- **Documentation**: Comprehensive guides and API docs
- **Platform Support**: Works on all major hosting platforms

### 🙏 Credits

Built with:
- [Bun](https://bun.sh/) - Fast JavaScript runtime
- [Elysia](https://elysiajs.com/) - Web framework
- [Google Drive API](https://developers.google.com/drive) - Storage backend
- [Obsidian API](https://docs.obsidian.md/) - Plugin integration

---

## How to Update

### For Development
```bash
git pull origin main
cd packages/plugin && bun install && bun run build
cd ../server && bun install && bun run build
```

### For Production
```bash
# Update server
cd packages/server
git pull origin main
bun install
bun run build
pm2 restart vync

# Update plugin (in Obsidian)
1. Close Obsidian
2. Replace plugin files
3. Restart Obsidian
```

### Verify Update
```bash
# Check server
curl http://localhost:3000/health

# In Obsidian
1. Open DevTools (Cmd/Ctrl + Option/Alt + I)
2. Run: "Reconcile Sync Index" command
3. Check console for reconciliation output
```