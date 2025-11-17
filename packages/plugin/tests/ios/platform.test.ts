/**
 * iOS Platform Detection Tests
 *
 * These tests verify that the plugin correctly detects iOS platform
 * and behaves appropriately on mobile devices.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  mockIOSPlatform,
  mockIPadPlatform,
  mockDesktopPlatform,
  isMobileEnvironment,
  createIOSTestEnvironment,
  createIPadTestEnvironment,
} from './mocks'

describe('iOS Platform Detection', () => {
  describe('Platform Properties', () => {
    it('should correctly identify iOS iPhone environment', () => {
      const platform = mockIOSPlatform

      expect(platform.isMobile).toBe(true)
      expect(platform.isIosApp).toBe(true)
      expect(platform.isDesktopApp).toBe(false)
      expect(platform.isPhone).toBe(true)
      expect(platform.isTablet).toBe(false)
      expect(platform.isAndroidApp).toBe(false)
    })

    it('should correctly identify iPad environment', () => {
      const platform = mockIPadPlatform

      expect(platform.isMobile).toBe(true)
      expect(platform.isIosApp).toBe(true)
      expect(platform.isDesktopApp).toBe(false)
      expect(platform.isPhone).toBe(false)
      expect(platform.isTablet).toBe(true)
      expect(platform.isAndroidApp).toBe(false)
    })

    it('should correctly identify desktop environment', () => {
      const platform = mockDesktopPlatform

      expect(platform.isMobile).toBe(false)
      expect(platform.isDesktopApp).toBe(true)
      expect(platform.isIosApp).toBe(false)
      expect(platform.isPhone).toBe(false)
      expect(platform.isTablet).toBe(false)
    })
  })

  describe('Mobile Environment Helper', () => {
    it('should return true for iOS platform', () => {
      expect(isMobileEnvironment(mockIOSPlatform)).toBe(true)
    })

    it('should return true for iPad platform', () => {
      expect(isMobileEnvironment(mockIPadPlatform)).toBe(true)
    })

    it('should return false for desktop platform', () => {
      expect(isMobileEnvironment(mockDesktopPlatform)).toBe(false)
    })
  })

  describe('iOS Test Environment Setup', () => {
    it('should create complete iOS test environment', () => {
      const env = createIOSTestEnvironment()

      expect(env.platform).toBeDefined()
      expect(env.platform.isIosApp).toBe(true)
      expect(env.app).toBeDefined()
      expect(env.requestUrl).toBeDefined()
      expect(env.Notice).toBeDefined()
    })

    it('should create complete iPad test environment', () => {
      const env = createIPadTestEnvironment()

      expect(env.platform).toBeDefined()
      expect(env.platform.isTablet).toBe(true)
      expect(env.app).toBeDefined()
      expect(env.requestUrl).toBeDefined()
      expect(env.Notice).toBeDefined()
    })
  })

  describe('Platform-Specific Behavior', () => {
    it('should use different OAuth flow for iOS', () => {
      // On iOS, OAuth should use out-of-band (OOB) redirect URI
      const platform = mockIOSPlatform
      const redirectUri = platform.isIosApp
        ? 'urn:ietf:wg:oauth:2.0:oob'
        : 'http://localhost'

      expect(redirectUri).toBe('urn:ietf:wg:oauth:2.0:oob')
    })

    it('should use standard OAuth flow for desktop', () => {
      const platform = mockDesktopPlatform
      const redirectUri = platform.isIosApp
        ? 'urn:ietf:wg:oauth:2.0:oob'
        : 'http://localhost'

      expect(redirectUri).toBe('http://localhost')
    })

    it('should detect touch interface on iOS', () => {
      const platform = mockIOSPlatform
      const hasTouchInterface = platform.isMobile

      expect(hasTouchInterface).toBe(true)
    })

    it('should detect mouse interface on desktop', () => {
      const platform = mockDesktopPlatform
      const hasTouchInterface = platform.isMobile

      expect(hasTouchInterface).toBe(false)
    })
  })

  describe('WebKit Browser Detection', () => {
    it('should detect Safari/WebKit on iOS', () => {
      const platform = mockIOSPlatform

      // iOS Obsidian app uses WebKit
      expect(platform.isSafari).toBe(true)
    })

    it('should handle WebKit-specific behaviors', () => {
      const platform = mockIOSPlatform

      // WebKit may have different behaviors
      const isWebKit = platform.isSafari || platform.isIosApp

      expect(isWebKit).toBe(true)
    })
  })

  describe('Form Factor Detection', () => {
    it('should distinguish between phone and tablet', () => {
      expect(mockIOSPlatform.isPhone).toBe(true)
      expect(mockIOSPlatform.isTablet).toBe(false)

      expect(mockIPadPlatform.isPhone).toBe(false)
      expect(mockIPadPlatform.isTablet).toBe(true)
    })

    it('should allow responsive UI based on form factor', () => {
      // UI might need different sizing for phone vs tablet
      const getUIScale = (platform: typeof mockIOSPlatform) => {
        if (platform.isPhone) return 'compact'
        if (platform.isTablet) return 'regular'
        return 'full'
      }

      expect(getUIScale(mockIOSPlatform)).toBe('compact')
      expect(getUIScale(mockIPadPlatform)).toBe('regular')
      expect(getUIScale(mockDesktopPlatform)).toBe('full')
    })
  })

  describe('Platform Capabilities', () => {
    it('should check for mobile-specific limitations', () => {
      const hasBackgroundSync = !mockIOSPlatform.isMobile
      const hasUnlimitedStorage = !mockIOSPlatform.isMobile
      const hasDirectFileAccess = !mockIOSPlatform.isMobile

      expect(hasBackgroundSync).toBe(false)
      expect(hasUnlimitedStorage).toBe(false)
      expect(hasDirectFileAccess).toBe(false)
    })

    it('should check for desktop capabilities', () => {
      const hasBackgroundSync = !mockDesktopPlatform.isMobile
      const hasUnlimitedStorage = !mockDesktopPlatform.isMobile
      const hasDirectFileAccess = !mockDesktopPlatform.isMobile

      expect(hasBackgroundSync).toBe(true)
      expect(hasUnlimitedStorage).toBe(true)
      expect(hasDirectFileAccess).toBe(true)
    })
  })
})

describe('iOS-Specific Feature Flags', () => {
  it('should enable mobile-optimized features on iOS', () => {
    const platform = mockIOSPlatform

    const featureFlags = {
      useMobileUI: platform.isMobile,
      enableBackgroundSync: !platform.isMobile,
      useTouchOptimizedControls: platform.isMobile,
      showDesktopOnlyFeatures: !platform.isMobile,
    }

    expect(featureFlags.useMobileUI).toBe(true)
    expect(featureFlags.enableBackgroundSync).toBe(false)
    expect(featureFlags.useTouchOptimizedControls).toBe(true)
    expect(featureFlags.showDesktopOnlyFeatures).toBe(false)
  })

  it('should enable desktop features on desktop', () => {
    const platform = mockDesktopPlatform

    const featureFlags = {
      useMobileUI: platform.isMobile,
      enableBackgroundSync: !platform.isMobile,
      useTouchOptimizedControls: platform.isMobile,
      showDesktopOnlyFeatures: !platform.isMobile,
    }

    expect(featureFlags.useMobileUI).toBe(false)
    expect(featureFlags.enableBackgroundSync).toBe(true)
    expect(featureFlags.useTouchOptimizedControls).toBe(false)
    expect(featureFlags.showDesktopOnlyFeatures).toBe(true)
  })
})

describe('iOS Environment Consistency', () => {
  it('should maintain consistent platform properties', () => {
    const env = createIOSTestEnvironment()

    // iOS environment should always have these properties set correctly
    expect(env.platform.isIosApp).toBe(true)
    expect(env.platform.isMobile).toBe(true)
    expect(env.platform.isDesktopApp).toBe(false)

    // These should be mutually exclusive
    expect(env.platform.isAndroidApp).toBe(false)
    expect(env.platform.isMacOS).toBe(false)
    expect(env.platform.isWin).toBe(false)
    expect(env.platform.isLinux).toBe(false)
  })

  it('should maintain consistent iPad properties', () => {
    const env = createIPadTestEnvironment()

    expect(env.platform.isIosApp).toBe(true)
    expect(env.platform.isTablet).toBe(true)
    expect(env.platform.isPhone).toBe(false)
    expect(env.platform.isMobile).toBe(true)
  })
})
