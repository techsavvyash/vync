# iOS Testing for Vync Plugin

This directory contains iOS-specific tests and documentation for the Vync plugin.

## Overview

The Vync plugin is designed to work on both desktop and mobile platforms. These tests ensure that the plugin functions correctly on iOS devices (iPhone and iPad).

## Test Files

### `mocks.ts`

Contains iOS-specific mocks including:
- Mock Platform objects for iPhone, iPad, and desktop
- Mock requestUrl functions simulating iOS network behavior
- Mock App objects for iOS environment
- iOS-specific event simulators (background, foreground, memory warnings)
- Mock OAuth responses for out-of-band flow
- Helper functions for creating test environments

### `platform.test.ts`

Tests for platform detection and platform-specific behavior:
- iOS vs desktop detection
- iPhone vs iPad differentiation
- Platform capabilities and feature flags
- WebKit/Safari detection
- Form factor responsive behavior

### `oauth.test.ts`

Tests for iOS OAuth authentication flow:
- Out-of-band (OOB) redirect URI handling
- Authorization URL generation
- Manual authorization code input
- Token exchange and storage
- Token refresh logic
- Multi-account support
- Error handling

### `network.test.ts`

Tests for iOS network and sync behavior:
- Network request handling via requestUrl API
- Network error scenarios (offline, timeout)
- Cellular vs WiFi detection
- Request retry logic with exponential backoff
- Background/foreground app lifecycle
- Storage quota management
- Memory pressure handling
- Batch operation optimization

## Running iOS Tests

### Run all iOS tests
```bash
bun run test:ios
```

### Run iOS tests in watch mode
```bash
bun run test:ios:watch
```

### Run specific test file
```bash
bun test tests/ios/platform.test.ts
```

### Run with coverage
```bash
bun test:coverage -- --testPathPattern=ios
```

## Manual Testing

For comprehensive manual testing on actual iOS devices, refer to:

- **[IOS_TESTING.md](../../docs/IOS_TESTING.md)** - Complete testing guide with step-by-step instructions
- **[IOS_TESTING_CHECKLIST.md](../../docs/IOS_TESTING_CHECKLIST.md)** - Detailed checklist for thorough testing

## Test Coverage

These tests cover:

### Platform Detection
- ✅ iOS vs Android vs Desktop
- ✅ iPhone vs iPad
- ✅ Safari/WebKit detection
- ✅ Touch vs mouse interface
- ✅ Form factor responsive UI

### Authentication
- ✅ OAuth OOB (out-of-band) flow
- ✅ Authorization URL generation
- ✅ Authorization code validation
- ✅ Token exchange and storage
- ✅ Token refresh
- ✅ Error handling

### Network Operations
- ✅ HTTP requests via requestUrl API
- ✅ Network error handling
- ✅ Offline detection
- ✅ Slow connection handling
- ✅ Request retry logic
- ✅ Cellular vs WiFi

### App Lifecycle
- ✅ Background/foreground transitions
- ✅ Background task constraints
- ✅ State persistence
- ✅ Memory warnings
- ✅ Storage quota

### Sync Operations
- ✅ Batch operations
- ✅ File upload/download
- ✅ Conflict detection
- ✅ Connection quality adaptation

## iOS-Specific Considerations

### OAuth Flow

On iOS, the plugin uses **out-of-band (OOB)** OAuth flow:
- Redirect URI: `urn:ietf:wg:oauth:2.0:oob`
- User manually copies authorization URL
- Opens URL in Safari
- Copies authorization code back
- Pastes into plugin

This differs from desktop which can use localhost redirect.

### Background Limitations

iOS restricts background execution:
- Sync may pause when app is backgrounded
- Background tasks have ~30 second limit
- Must save state before backgrounding
- Resume sync when returning to foreground

### Network API

Uses Obsidian's `requestUrl()` API:
- Works across all platforms
- Handles iOS network stack properly
- Subject to iOS network permissions
- May have different timeout behavior

### Storage Constraints

iOS has storage limitations:
- Apps have storage quotas
- Must handle low storage gracefully
- Should respond to memory warnings
- Cache management is critical

### UI Considerations

Mobile UI requirements:
- Touch targets: minimum 44x44 points
- Text size: readable without zoom (16px+)
- Responsive layout for different screen sizes
- Support for dark/light mode
- Handle keyboard appearance

## Adding New iOS Tests

When adding new iOS-specific tests:

1. **Create test file** in `tests/ios/`
2. **Import mocks** from `./mocks`
3. **Use iOS test environment**:
   ```typescript
   import { createIOSTestEnvironment } from './mocks'

   const env = createIOSTestEnvironment()
   ```
4. **Test iOS-specific behavior** not covered by general tests
5. **Update this README** with new test coverage

## Continuous Integration

iOS tests run as part of the main test suite:

```bash
# CI runs all tests including iOS
bun test
```

For iOS-specific CI (if needed):

```yaml
- name: Run iOS Tests
  run: bun run test:ios
```

## Known Limitations

### Cannot Test
- Actual iOS device APIs (requires real device)
- iOS-specific UI rendering (requires Obsidian Mobile)
- Apple's background execution policies
- iOS network stack quirks
- Safari/WebKit-specific bugs

### Mocked Behavior
These tests use mocks for iOS-specific functionality:
- Platform detection is simulated
- Network requests are mocked
- App lifecycle events are simulated
- Storage quotas are mocked

Real device testing is still required for final validation.

## Resources

### Internal Documentation
- [IOS_TESTING.md](../../docs/IOS_TESTING.md) - Complete testing guide
- [IOS_TESTING_CHECKLIST.md](../../docs/IOS_TESTING_CHECKLIST.md) - Testing checklist

### External Resources
- [Obsidian Mobile Development](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development)
- [Google OAuth for Mobile](https://developers.google.com/identity/protocols/oauth2/native-app)
- [iOS Web APIs](https://developer.apple.com/documentation/webkitjs)

## Troubleshooting

### Tests Failing

1. **Check imports**: Ensure all mocks are imported correctly
2. **Check Jest config**: Verify `jest.config.js` includes iOS test path
3. **Check TypeScript**: Run `bun run typecheck`
4. **Clear cache**: `jest --clearCache`

### Mock Issues

1. **Update mocks**: Keep mocks in sync with Obsidian API changes
2. **Check platform flags**: Ensure mock platform properties are consistent
3. **Network mocks**: Verify network mock responses match real behavior

### Adding New Mocks

When Obsidian adds new iOS-specific APIs:

1. Update `mocks.ts` with new mock implementations
2. Add tests for new functionality
3. Update documentation

## Contributing

When contributing iOS tests:

1. Follow existing test patterns
2. Use descriptive test names
3. Group related tests with `describe()`
4. Add comments for complex test logic
5. Update this README if adding new test files
6. Ensure tests pass on CI

## Support

For questions or issues with iOS testing:

1. Check existing test files for examples
2. Review iOS testing documentation
3. Check Obsidian API documentation
4. Open an issue with details
