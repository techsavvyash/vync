# iOS Testing Guide for Vync Plugin

This guide provides comprehensive instructions for testing the Vync plugin on iOS (Obsidian Mobile).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation on iOS](#installation-on-ios)
- [Manual Testing Steps](#manual-testing-steps)
- [Test Scenarios](#test-scenarios)
- [Known iOS Limitations](#known-ios-limitations)
- [Troubleshooting](#troubleshooting)
- [Automated Testing](#automated-testing)

## Prerequisites

### Required Software

- **iOS Device or Simulator**: iOS 14.0 or higher
- **Obsidian Mobile**: Latest version from App Store
- **TestFlight** (optional): For beta testing
- **Google Cloud Project**: With OAuth credentials configured

### Required Access

- Apple Developer account (for TestFlight deployment)
- Google Cloud Console access
- iOS device with Obsidian installed

## Installation on iOS

### Method 1: Manual Installation (Development)

1. **Prepare the Plugin Build**
   ```bash
   cd packages/plugin
   bun run build
   ```

2. **Transfer to iOS Device**
   - Use iTunes File Sharing, or
   - Use a cloud service (iCloud, Dropbox), or
   - Use Obsidian's built-in plugin sync

3. **Install in Obsidian Mobile**
   - Open Obsidian on iOS
   - Navigate to Settings → Community Plugins
   - Ensure "Safe mode" is OFF
   - Place `main.js` and `manifest.json` in:
     ```
     YourVault/.obsidian/plugins/vync/
     ```
   - Return to Community Plugins
   - Enable "Vync" plugin

### Method 2: Using iCloud Drive

1. **Copy Plugin Files to iCloud**
   - Build the plugin
   - Copy `main.js` and `manifest.json` to iCloud Drive

2. **Access from iOS**
   - Open Files app on iOS
   - Navigate to your Obsidian vault
   - Create folder: `.obsidian/plugins/vync/`
   - Copy the plugin files into this folder

3. **Enable in Obsidian**
   - Open Obsidian Mobile
   - Go to Settings → Community Plugins
   - Enable Vync

### Method 3: Using Obsidian Sync (Recommended for Testing)

If you have Obsidian Sync:
1. Install and configure plugin on desktop
2. Enable plugin sync in Obsidian Sync settings
3. Wait for sync to complete
4. Plugin should appear on mobile automatically

## Manual Testing Steps

### 1. Initial Setup Test

**Objective**: Verify plugin loads and settings are accessible

1. Open Obsidian on iOS
2. Navigate to Settings → Community Plugins → Vync
3. **Verify**:
   - [ ] Settings page loads without errors
   - [ ] All settings fields are visible and accessible
   - [ ] UI elements are properly sized for mobile screen
   - [ ] Text is readable without zooming
   - [ ] Input fields respond to touch

### 2. OAuth Authentication Test

**Objective**: Test Google Drive authentication on mobile

1. Enter Google OAuth credentials:
   - Client ID
   - Client Secret
   - Vault ID

2. Tap "Authenticate with Google Drive"

3. **Verify**:
   - [ ] Authorization URL is generated
   - [ ] URL can be copied successfully
   - [ ] URL opens in Safari when tapped
   - [ ] OAuth consent screen displays correctly
   - [ ] Can grant permissions
   - [ ] Authorization code is provided
   - [ ] Can paste code back into plugin
   - [ ] Authentication completes successfully
   - [ ] Success message is displayed

**Note**: OAuth flow on mobile uses "out-of-band" (OOB) method, which requires manual code copy-paste.

### 3. Connection Test

**Objective**: Verify Google Drive connectivity

1. In plugin settings, use "Test Google Drive Connection" command
2. **Verify**:
   - [ ] Test completes without errors
   - [ ] Success notification appears
   - [ ] Network request succeeds despite mobile environment

### 4. File Sync Test (Upload)

**Objective**: Test file upload from iOS to Google Drive

1. Create a new note in Obsidian:
   ```markdown
   # Test Note from iOS
   This note was created on iPhone/iPad.
   ```

2. Trigger manual sync (ribbon icon or command palette)

3. **Verify**:
   - [ ] Sync starts successfully
   - [ ] Progress indicator shows (if implemented)
   - [ ] File uploads to Google Drive
   - [ ] Sync completes with success message
   - [ ] Check Google Drive web interface to confirm file exists
   - [ ] File content matches exactly

### 5. File Sync Test (Download)

**Objective**: Test file download from Google Drive to iOS

1. Using desktop or Google Drive web:
   - Create or modify a file in the vault folder

2. On iOS, trigger manual sync

3. **Verify**:
   - [ ] Sync detects remote changes
   - [ ] File downloads successfully
   - [ ] File appears in Obsidian vault on iOS
   - [ ] Content is correct
   - [ ] File metadata preserved (if applicable)

### 6. Conflict Resolution Test

**Objective**: Test conflict detection and resolution on mobile

1. Modify the same note both locally and remotely
2. Trigger sync
3. **Verify**:
   - [ ] Conflict is detected
   - [ ] Conflict UI appears correctly on mobile
   - [ ] UI is usable on small screen
   - [ ] Can select resolution option
   - [ ] Conflict resolves according to selection
   - [ ] No data loss occurs

### 7. Auto-Sync Test

**Objective**: Verify automatic sync works on mobile

1. Enable auto-sync in settings
2. Set sync interval (e.g., 60 seconds)
3. Create a new note
4. Wait for auto-sync interval
5. **Verify**:
   - [ ] Auto-sync triggers automatically
   - [ ] Runs in background
   - [ ] Doesn't drain battery excessively
   - [ ] Completes successfully
   - [ ] Check Google Drive for uploaded file

### 8. Performance Test

**Objective**: Assess performance on mobile hardware

1. Sync a vault with multiple files (10, 50, 100 files)
2. **Verify**:
   - [ ] Sync completes in reasonable time
   - [ ] App remains responsive during sync
   - [ ] No crashes or freezes
   - [ ] Memory usage is acceptable
   - [ ] Battery drain is reasonable

### 9. Network Resilience Test

**Objective**: Test behavior with poor/intermittent connectivity

1. Enable airplane mode mid-sync
2. **Verify**:
   - [ ] Graceful error handling
   - [ ] Clear error message
   - [ ] No data corruption
   - [ ] Can retry after network restored

2. Use cellular data instead of WiFi
3. **Verify**:
   - [ ] Sync works on cellular
   - [ ] Data usage is reasonable
   - [ ] Optional: Warning about cellular usage

### 10. Background App Test

**Objective**: Test behavior when app is backgrounded

1. Start a sync operation
2. Switch to another app mid-sync
3. **Verify**:
   - [ ] Sync continues in background (if supported)
   - [ ] Or sync pauses gracefully
   - [ ] Can resume when returning to app
   - [ ] No data corruption

## Test Scenarios

### Scenario A: First-Time User on iOS

1. Install plugin fresh
2. Configure OAuth from scratch
3. Authenticate with Google
4. Perform first sync
5. Create notes and sync again

**Expected Result**: Smooth onboarding, clear instructions, successful sync.

### Scenario B: Existing Desktop User Adding iOS

1. Already using plugin on desktop
2. Install on iOS
3. Use same OAuth credentials
4. Sync existing vault

**Expected Result**: Seamless transition, all files sync correctly, no duplicates.

### Scenario C: iOS-Only User

1. Only use Obsidian on iPad/iPhone
2. Set up plugin entirely on mobile
3. Manage vault only from iOS

**Expected Result**: Full functionality without desktop, all features accessible.

### Scenario D: Multi-File Operations

1. Create 10 notes rapidly
2. Modify 5 existing notes
3. Delete 2 notes
4. Trigger sync

**Expected Result**: All changes sync correctly, no missing updates, tombstones work.

### Scenario E: Large Vault Sync

1. Vault with 100+ markdown files
2. Include images and attachments
3. Perform full sync

**Expected Result**: Completes successfully, handles memory constraints, proper progress indication.

## Known iOS Limitations

### Platform Differences

1. **OAuth Flow**:
   - iOS uses "out-of-band" (OOB) flow requiring manual code copy-paste
   - No automatic redirect like desktop browsers
   - Users must switch between Safari and Obsidian

2. **File System Access**:
   - Limited compared to desktop
   - Files managed through Obsidian's API only
   - Cannot directly browse Google Drive folder

3. **Background Processing**:
   - iOS restricts background execution
   - Auto-sync may pause when app is backgrounded
   - May need to keep app in foreground for long syncs

4. **Network API**:
   - Uses Obsidian's `requestUrl()` API
   - Subject to iOS network restrictions
   - May need VPN or network permission handling

5. **Storage**:
   - Limited by iOS storage management
   - Large vaults may trigger storage warnings
   - Cache management is critical

### Mobile-Specific Considerations

- **Touch Targets**: Ensure all buttons are at least 44x44 points
- **Text Size**: Readable without zooming (minimum 16px)
- **Modals**: Should be dismissible by tapping outside
- **Keyboards**: Don't obscure input fields
- **Notifications**: Must be non-intrusive
- **Battery**: Sync operations should be efficient

## Troubleshooting

### Issue: Plugin Doesn't Appear in Settings

**Solution**:
1. Verify files are in correct directory: `.obsidian/plugins/vync/`
2. Ensure both `main.js` and `manifest.json` are present
3. Check manifest.json has `"isDesktopOnly": false`
4. Restart Obsidian app completely
5. Check file permissions

### Issue: OAuth Authentication Fails

**Solution**:
1. Verify Client ID and Secret are for "Desktop app" type
2. Ensure you're copying the entire authorization URL
3. Complete OAuth flow in Safari (not in-app browser)
4. Check for error messages in console (if accessible)
5. Try revoking and re-granting permissions in Google Account settings

### Issue: Sync Fails on iOS but Works on Desktop

**Solution**:
1. Check iOS network permissions for Obsidian
2. Verify not blocked by VPN or firewall
3. Test on different network (WiFi vs cellular)
4. Check if `requestUrl()` has platform-specific issues
5. Review console logs for iOS-specific errors

### Issue: App Freezes During Sync

**Solution**:
1. Reduce sync batch size
2. Implement proper async/await handling
3. Add progress indicators
4. Test with smaller vault first
5. Check for memory leaks

### Issue: Auto-Sync Stops Working

**Solution**:
1. Check if app is being backgrounded
2. Verify iOS isn't restricting background activity
3. Keep app in foreground during development testing
4. Consider implementing foreground-only sync mode

## Automated Testing

### Running iOS-Specific Tests

```bash
cd packages/plugin
bun test -- --testPathPattern=ios
```

This runs test files in `tests/ios/` directory.

### Test Coverage

Automated tests should cover:
- [ ] Platform detection (detecting iOS environment)
- [ ] OAuth flow differences (OOB mode)
- [ ] Mobile-specific API mocking
- [ ] Network request behavior on mobile
- [ ] Storage constraints
- [ ] Background/foreground transitions

### Continuous Integration

Add iOS testing to CI/CD:

```yaml
# .github/workflows/test-ios.yaml
name: iOS Plugin Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      - name: Install dependencies
        run: bun install
      - name: Run iOS tests
        run: bun test -- --testPathPattern=ios
```

## Testing Checklist

Use this checklist for comprehensive iOS testing:

### Pre-Flight
- [ ] Plugin builds successfully
- [ ] All automated tests pass
- [ ] No TypeScript errors
- [ ] manifest.json has `"isDesktopOnly": false`

### Installation
- [ ] Plugin installs on iOS simulator
- [ ] Plugin installs on physical iOS device
- [ ] Plugin appears in settings
- [ ] Settings UI renders correctly

### Authentication
- [ ] Can enter OAuth credentials
- [ ] Authorization URL generates
- [ ] OAuth flow completes
- [ ] Tokens are stored
- [ ] Can sign out
- [ ] Can re-authenticate

### Core Functionality
- [ ] Manual sync works
- [ ] Auto-sync works
- [ ] File upload works
- [ ] File download works
- [ ] Conflict detection works
- [ ] Conflict resolution works
- [ ] Delete operations work
- [ ] Tombstones function correctly

### Performance
- [ ] Small vault (< 10 files) syncs quickly
- [ ] Medium vault (10-50 files) acceptable
- [ ] Large vault (> 50 files) completes
- [ ] No memory leaks
- [ ] Reasonable battery usage
- [ ] App stays responsive

### Edge Cases
- [ ] Handles network loss
- [ ] Handles app backgrounding
- [ ] Handles iOS interruptions (calls, notifications)
- [ ] Handles storage full scenarios
- [ ] Handles invalid credentials
- [ ] Handles corrupted files

### UX
- [ ] UI elements properly sized for touch
- [ ] Text is readable
- [ ] Modals work correctly
- [ ] Notifications are appropriate
- [ ] Error messages are clear
- [ ] Loading states are visible

### Compatibility
- [ ] Works on iOS 14.0+
- [ ] Works on iPhone (various sizes)
- [ ] Works on iPad
- [ ] Works in split-screen mode
- [ ] Works in dark mode
- [ ] Works in light mode

## Reporting Issues

When reporting iOS-specific issues, include:

1. **Device Information**:
   - Device model (iPhone 12, iPad Pro, etc.)
   - iOS version
   - Available storage

2. **Obsidian Information**:
   - Obsidian version
   - Other active plugins
   - Vault size

3. **Plugin Information**:
   - Vync version
   - Settings configuration
   - Authentication status

4. **Steps to Reproduce**:
   - Detailed step-by-step
   - Expected vs actual behavior
   - Screenshots or screen recordings

5. **Logs** (if available):
   - Console logs
   - Error messages
   - Network request failures

## Resources

- [Obsidian Mobile API Documentation](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development)
- [iOS Developer Documentation](https://developer.apple.com/documentation/)
- [Google OAuth for Mobile](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Obsidian Plugin Development](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

## Next Steps

After completing iOS testing:

1. Document any iOS-specific issues found
2. Implement fixes for mobile-specific bugs
3. Consider mobile-specific optimizations
4. Add iOS-specific features (if needed)
5. Prepare for App Store review (if applicable)
6. Create mobile-specific user documentation
