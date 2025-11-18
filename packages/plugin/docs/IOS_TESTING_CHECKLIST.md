# iOS Testing Checklist for Vync Plugin

Use this checklist to ensure comprehensive testing of the Vync plugin on iOS devices.

## Test Session Information

- **Date**: _______________
- **Tester**: _______________
- **Plugin Version**: _______________
- **Device Model**: _______________ (e.g., iPhone 14 Pro, iPad Air 5)
- **iOS Version**: _______________
- **Obsidian Version**: _______________

---

## Pre-Installation Checklist

- [ ] Plugin builds successfully without errors
- [ ] `manifest.json` has `"isDesktopOnly": false`
- [ ] All automated tests pass (`bun test`)
- [ ] TypeScript compilation succeeds (`bun run typecheck`)
- [ ] Plugin tested on desktop first (baseline verification)

---

## Installation Testing

### iOS Device Setup
- [ ] iOS device running iOS 14.0 or higher
- [ ] Obsidian Mobile installed from App Store
- [ ] Test vault created or existing vault available
- [ ] Sufficient storage space (at least 1GB free)

### Installation Methods
- [ ] **Method 1**: Manual file transfer via iCloud Drive
  - [ ] Files copied successfully
  - [ ] Plugin folder created in correct location
  - [ ] Files visible in Obsidian

- [ ] **Method 2**: Using Obsidian Sync (if available)
  - [ ] Plugin synced from desktop
  - [ ] Files transferred correctly
  - [ ] Plugin appears in mobile settings

- [ ] **Method 3**: Direct file transfer via iTunes/Finder
  - [ ] Files transferred successfully
  - [ ] Plugin recognized by Obsidian

### Plugin Activation
- [ ] Plugin appears in Community Plugins list
- [ ] Can enable plugin without errors
- [ ] Plugin loads successfully (no crash)
- [ ] Settings page accessible
- [ ] No error messages in console (if checkable)

---

## UI/UX Testing

### Settings Interface
- [ ] Settings page loads completely
- [ ] All text is readable without zooming
- [ ] Input fields are properly sized
- [ ] Touch targets are at least 44x44 points
- [ ] Can scroll through all settings
- [ ] Keyboard doesn't obscure input fields
- [ ] Can dismiss keyboard when done
- [ ] Settings save correctly

### Touch Interaction
- [ ] Buttons respond to tap
- [ ] No double-tap required
- [ ] Touch feedback is immediate
- [ ] Gestures work correctly (swipe, scroll)
- [ ] Can select text and copy
- [ ] Can paste into input fields

### Display
- [ ] **Portrait mode**: UI displays correctly
- [ ] **Landscape mode**: UI displays correctly
- [ ] **Dark mode**: All elements visible and styled
- [ ] **Light mode**: All elements visible and styled
- [ ] Text contrast is sufficient
- [ ] No UI elements cut off

### iPad Specific
- [ ] **Split View**: Plugin works in split view
- [ ] **Slide Over**: Plugin accessible in slide over
- [ ] **Stage Manager**: Plugin works with Stage Manager (iPadOS 16+)
- [ ] Proper use of screen real estate

---

## Authentication Testing

### OAuth Credential Entry
- [ ] Can enter Google Client ID
- [ ] Can enter Google Client Secret
- [ ] Can enter Vault ID
- [ ] Input validation works
- [ ] Can save credentials
- [ ] Credentials persist after app restart

### OAuth Flow
- [ ] "Authenticate with Google Drive" button works
- [ ] Authorization URL generates correctly
- [ ] Can copy authorization URL
- [ ] URL opens in Safari when tapped
- [ ] Can switch between Safari and Obsidian
- [ ] Google consent screen loads
- [ ] Can sign in to Google account
- [ ] Can grant permissions
- [ ] Authorization code is displayed
- [ ] Can copy authorization code
- [ ] Can paste code back into plugin
- [ ] Authentication completes successfully
- [ ] Success message displayed
- [ ] Tokens stored correctly

### Connection Verification
- [ ] "Test Google Drive Connection" command exists
- [ ] Command executes successfully
- [ ] Success notification appears
- [ ] Failure handled gracefully (if credentials invalid)
- [ ] Error messages are clear and helpful

---

## Sync Testing

### Manual Sync - Upload
- [ ] Create new markdown note
- [ ] Trigger manual sync (ribbon icon)
- [ ] Sync starts without errors
- [ ] Progress indicator shown (if implemented)
- [ ] Sync completes successfully
- [ ] Success notification appears
- [ ] File appears in Google Drive
- [ ] File content matches exactly
- [ ] File metadata preserved

### Manual Sync - Download
- [ ] Create/modify file in Google Drive
- [ ] Trigger manual sync on iOS
- [ ] Sync detects remote changes
- [ ] File downloads successfully
- [ ] File appears in vault
- [ ] Content matches exactly
- [ ] Metadata preserved

### Multiple Files
- [ ] Create 10 new notes
- [ ] Trigger sync
- [ ] All files upload successfully
- [ ] No files missed
- [ ] Correct file count in Google Drive

### Large Files
- [ ] Test with 1MB markdown file
- [ ] Test with 5MB image attachment
- [ ] Files upload/download completely
- [ ] No truncation or corruption
- [ ] Reasonable performance

---

## Auto-Sync Testing

### Configuration
- [ ] Can enable auto-sync
- [ ] Can set sync interval
- [ ] Settings save correctly
- [ ] Auto-sync starts after enabling

### Functionality
- [ ] Auto-sync triggers at specified interval
- [ ] Runs without manual intervention
- [ ] Syncs new files automatically
- [ ] Syncs modified files automatically
- [ ] Detects deletions correctly
- [ ] Doesn't trigger unnecessarily (no changes)

### Background Behavior
- [ ] Auto-sync works when app is active
- [ ] Behavior when app is backgrounded documented
- [ ] Resumes correctly when app returns to foreground
- [ ] No data loss during backgrounding

---

## Conflict Resolution

### Conflict Detection
- [ ] Modify same file locally and remotely
- [ ] Trigger sync
- [ ] Conflict is detected
- [ ] Conflict UI appears

### Conflict UI
- [ ] UI displays both versions
- [ ] Can see local changes
- [ ] Can see remote changes
- [ ] UI is usable on small screen
- [ ] Touch targets are adequate
- [ ] Can scroll through content

### Resolution Options
- [ ] "Keep Local" option works
- [ ] "Keep Remote" option works
- [ ] "Manual Merge" option works (if available)
- [ ] Selected option is applied correctly
- [ ] No data loss after resolution
- [ ] Sync state updates correctly

---

## File Operations

### Create
- [ ] Create new markdown note → syncs
- [ ] Create new folder → syncs
- [ ] Create note in subfolder → syncs with structure
- [ ] Create note with special characters in name → syncs

### Modify
- [ ] Edit existing note → syncs changes
- [ ] Modify multiple notes → all sync
- [ ] Rapid edits → syncs correctly

### Delete
- [ ] Delete note → tombstone created
- [ ] Deleted note removed from Google Drive
- [ ] Tombstone prevents re-download
- [ ] Delete folder → all files handled correctly

### Rename
- [ ] Rename note → updates in Google Drive
- [ ] Rename folder → updates structure
- [ ] No duplicate files created

### Move
- [ ] Move note to different folder → syncs
- [ ] Folder structure preserved
- [ ] No orphaned files

---

## Performance Testing

### Small Vault (< 10 files)
- [ ] Sync completes in < 10 seconds
- [ ] App remains responsive
- [ ] No lag or freezing
- [ ] Memory usage acceptable

### Medium Vault (10-50 files)
- [ ] Sync completes in < 30 seconds
- [ ] App remains responsive
- [ ] Can use app during sync
- [ ] No performance degradation

### Large Vault (> 50 files)
- [ ] Sync completes in reasonable time (< 2 minutes)
- [ ] Progress indication provided
- [ ] Can cancel if needed
- [ ] No crashes
- [ ] Memory usage acceptable

### Battery Impact
- [ ] Battery drain during sync is reasonable
- [ ] No excessive heating
- [ ] Auto-sync doesn't drain battery rapidly
- [ ] Can adjust sync frequency for battery saving

---

## Network Testing

### WiFi
- [ ] Sync works on WiFi
- [ ] Performance is good
- [ ] No connection errors

### Cellular Data
- [ ] Sync works on cellular (4G/5G)
- [ ] Data usage is reasonable
- [ ] Optional: Warning for cellular usage
- [ ] Can disable cellular sync in settings

### Network Interruption
- [ ] Start sync on WiFi
- [ ] Turn off WiFi mid-sync
- [ ] Error handled gracefully
- [ ] Clear error message shown
- [ ] No data corruption
- [ ] Can retry after network restored

### Airplane Mode
- [ ] Graceful handling when offline
- [ ] Clear offline status indication
- [ ] Queue syncs for when online (if supported)
- [ ] No crashes

### Poor Connection
- [ ] Works with slow connection
- [ ] Appropriate timeouts
- [ ] Retry logic works
- [ ] User feedback provided

---

## Error Handling

### Authentication Errors
- [ ] Invalid credentials → clear error message
- [ ] Expired token → prompts re-authentication
- [ ] Network error during auth → retry option
- [ ] User cancels OAuth → handled gracefully

### Sync Errors
- [ ] File not found → error logged, sync continues
- [ ] Permission denied → clear error message
- [ ] Network timeout → retry logic works
- [ ] Quota exceeded → appropriate warning
- [ ] Invalid file → error logged, sync continues

### Storage Errors
- [ ] Device storage full → clear warning
- [ ] Cannot write file → error message
- [ ] Cannot read file → error logged

---

## Edge Cases

### Rapid Changes
- [ ] Create 10 files rapidly (< 1 second each)
- [ ] All files sync correctly
- [ ] No race conditions

### Special Characters
- [ ] Files with emoji in name → sync correctly
- [ ] Files with unicode characters → sync correctly
- [ ] Files with spaces → sync correctly
- [ ] Files with special chars (&, %, $) → handled

### Large Operations
- [ ] Upload 100+ files → completes successfully
- [ ] Delete many files → tombstones work
- [ ] Rename many files → all update correctly

### App Lifecycle
- [ ] Sync during incoming call → handles interruption
- [ ] Sync during notification → continues correctly
- [ ] Force quit and restart → state preserved
- [ ] App updated → settings preserved

---

## Security & Privacy

### Token Storage
- [ ] Tokens stored securely in local storage
- [ ] Tokens not exposed in UI
- [ ] Tokens not logged to console
- [ ] Can clear tokens (sign out)

### Data Transfer
- [ ] HTTPS used for all requests
- [ ] No sensitive data in URLs
- [ ] Proper OAuth scopes requested
- [ ] Only accesses vault files in Google Drive

---

## Compatibility

### iOS Versions
- [ ] iOS 14.x
- [ ] iOS 15.x
- [ ] iOS 16.x
- [ ] iOS 17.x

### Devices Tested
- [ ] iPhone SE (small screen)
- [ ] iPhone 14/15 (standard screen)
- [ ] iPhone 14/15 Pro Max (large screen)
- [ ] iPad mini
- [ ] iPad Air
- [ ] iPad Pro

### Obsidian Versions
- [ ] Latest stable version
- [ ] Previous stable version
- [ ] Beta version (if available)

---

## Regression Testing

### After Each Update
- [ ] All previous passing tests still pass
- [ ] No new errors introduced
- [ ] Performance hasn't degraded
- [ ] UI hasn't broken
- [ ] Settings still work

---

## Final Verification

### End-to-End Test
- [ ] Fresh install on new device
- [ ] Complete OAuth setup
- [ ] Create 20 notes
- [ ] Sync all notes
- [ ] Verify all notes in Google Drive
- [ ] Delete 5 notes
- [ ] Modify 5 notes
- [ ] Sync again
- [ ] Verify changes in Google Drive
- [ ] Install on second device
- [ ] Sync down all notes
- [ ] All notes present and correct

### Sign-off
- [ ] All critical tests passed
- [ ] Known issues documented
- [ ] Performance acceptable
- [ ] Ready for release

---

## Notes & Issues Found

**Date**: _______________

### Issues

1. **Issue**: ____________________________
   - **Severity**: Critical / High / Medium / Low
   - **Steps to reproduce**: _______________
   - **Expected**: _______________
   - **Actual**: _______________
   - **Status**: _______________

2. **Issue**: ____________________________
   - **Severity**: Critical / High / Medium / Low
   - **Steps to reproduce**: _______________
   - **Expected**: _______________
   - **Actual**: _______________
   - **Status**: _______________

### Performance Observations

- Sync time for X files: _______________
- Memory usage: _______________
- Battery impact: _______________
- Network usage: _______________

### Recommendations

- ______________________________
- ______________________________
- ______________________________

---

## Sign-off

**Tester Signature**: _______________
**Date**: _______________
**Result**: Pass / Fail / Pass with Issues

**Notes**: ______________________________
