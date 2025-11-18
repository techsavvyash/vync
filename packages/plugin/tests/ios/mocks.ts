/**
 * iOS-specific mocks for testing mobile functionality
 */

import { Platform, RequestUrlParam, RequestUrlResponse } from 'obsidian'

/**
 * Mock Obsidian Platform object for iOS
 */
export const mockIOSPlatform: Platform = {
  isMobile: true,
  isDesktopApp: false,
  isIosApp: true,
  isAndroidApp: false,
  isMacOS: false,
  isWin: false,
  isLinux: false,
  isSafari: true, // iOS app uses WebKit
  isPhone: true,
  isTablet: false,
}

/**
 * Mock Obsidian Platform object for iPad
 */
export const mockIPadPlatform: Platform = {
  isMobile: true,
  isDesktopApp: false,
  isIosApp: true,
  isAndroidApp: false,
  isMacOS: false,
  isWin: false,
  isLinux: false,
  isSafari: true,
  isPhone: false,
  isTablet: true,
}

/**
 * Mock Obsidian Platform object for desktop (for comparison)
 */
export const mockDesktopPlatform: Platform = {
  isMobile: false,
  isDesktopApp: true,
  isIosApp: false,
  isAndroidApp: false,
  isMacOS: true,
  isWin: false,
  isLinux: false,
  isSafari: false,
  isPhone: false,
  isTablet: false,
}

/**
 * Mock requestUrl function that simulates iOS behavior
 * iOS may have different timeout/retry characteristics
 */
export const mockIOSRequestUrl = async (request: RequestUrlParam): Promise<RequestUrlResponse> => {
  // Simulate iOS-specific behavior
  const { url, method = 'GET', headers = {}, body } = request

  // Simulate network delay on mobile (typically slower)
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Mock successful response
  return {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    arrayBuffer: new ArrayBuffer(0),
    json: {},
    text: JSON.stringify({ success: true }),
  }
}

/**
 * Mock requestUrl that simulates network failure on iOS
 */
export const mockIOSRequestUrlWithNetworkError = async (): Promise<RequestUrlResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 50))
  throw new Error('Network request failed: The Internet connection appears to be offline')
}

/**
 * Mock requestUrl that simulates slow network on cellular
 */
export const mockIOSRequestUrlSlow = async (request: RequestUrlParam): Promise<RequestUrlResponse> => {
  // Simulate slow cellular connection
  await new Promise((resolve) => setTimeout(resolve, 3000))

  return {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    arrayBuffer: new ArrayBuffer(0),
    json: {},
    text: JSON.stringify({ success: true }),
  }
}

/**
 * Mock App object for iOS
 */
export const mockIOSApp = {
  vault: {
    adapter: {
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue('# Test Note'),
      write: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue({
        files: ['note1.md', 'note2.md'],
        folders: ['folder1'],
      }),
      stat: jest.fn().mockResolvedValue({
        type: 'file',
        mtime: Date.now(),
        ctime: Date.now(),
        size: 1024,
      }),
    },
    getFiles: jest.fn().mockReturnValue([
      {
        path: 'note1.md',
        name: 'note1.md',
        extension: 'md',
        stat: { mtime: Date.now(), ctime: Date.now(), size: 1024 },
      },
    ]),
    getAbstractFileByPath: jest.fn().mockReturnValue({
      path: 'note1.md',
      name: 'note1.md',
    }),
  },
  metadataCache: {
    getFileCache: jest.fn().mockReturnValue({}),
    on: jest.fn(),
    off: jest.fn(),
  },
  workspace: {
    on: jest.fn(),
    off: jest.fn(),
    getActiveFile: jest.fn().mockReturnValue(null),
  },
  loadLocalStorage: jest.fn((key: string) => {
    // Simulate iOS localStorage
    return null
  }),
  saveLocalStorage: jest.fn((key: string, value: string) => {
    // Simulate saving to iOS localStorage
  }),
}

/**
 * Mock Notice for iOS (notifications)
 */
export class MockIOSNotice {
  constructor(public message: string, public duration?: number) {
    // iOS notices may behave differently
  }

  hide() {
    // Hide the notice
  }
}

/**
 * Simulate iOS backgrounding event
 */
export const simulateIOSBackground = () => {
  // In real iOS, this would trigger when app goes to background
  const event = new Event('blur')
  const win = typeof window !== 'undefined' ? window : (global as any).window
  if (win) win.dispatchEvent(event)
}

/**
 * Simulate iOS foreground event
 */
export const simulateIOSForeground = () => {
  // In real iOS, this would trigger when app comes to foreground
  const event = new Event('focus')
  const win = typeof window !== 'undefined' ? window : (global as any).window
  if (win) win.dispatchEvent(event)
}

/**
 * Simulate iOS memory warning
 */
export const simulateIOSMemoryWarning = () => {
  // iOS can send memory warnings when low on memory
  const event = new Event('memorywarning')
  const win = typeof window !== 'undefined' ? window : (global as any).window
  if (win) win.dispatchEvent(event)
}

/**
 * Mock iOS storage constraints
 */
export const mockIOSStorageQuota = {
  quota: 5 * 1024 * 1024 * 1024, // 5GB typical iOS app quota
  usage: 2 * 1024 * 1024 * 1024, // 2GB used
  remaining: 3 * 1024 * 1024 * 1024, // 3GB remaining
}

/**
 * Check if running in a mobile environment
 * Useful for conditional test behavior
 */
export const isMobileEnvironment = (platform: Platform): boolean => {
  return platform.isMobile && (platform.isIosApp || platform.isAndroidApp)
}

/**
 * Mock OAuth response for iOS (out-of-band flow)
 */
export const mockIOSOAuthResponse = {
  // iOS uses OOB (out-of-band) flow
  authorizationUrl:
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/drive.file',
  // User must manually copy this code
  authorizationCode: '4/0AY0e-g7XXXXXXXXXXXXXXXXXXXXXXXXXXX',
  tokenResponse: {
    access_token: 'ya29.a0XXXXXXXXXXXXXXXXXXXXXXXXXX',
    refresh_token: '1//0gXXXXXXXXXXXXXXXXXXXXXXXX',
    scope: 'https://www.googleapis.com/auth/drive.file',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000,
  },
}

/**
 * Simulate touch events on iOS
 */
export const simulateIOSTouchEvent = (element: HTMLElement, type: 'start' | 'end' | 'move') => {
  const eventType = `touch${type}`
  const event = new TouchEvent(eventType, {
    bubbles: true,
    cancelable: true,
    touches: [
      {
        identifier: 0,
        target: element,
        clientX: 100,
        clientY: 100,
        pageX: 100,
        pageY: 100,
        screenX: 100,
        screenY: 100,
        radiusX: 10,
        radiusY: 10,
        rotationAngle: 0,
        force: 1,
      } as Touch,
    ],
  })
  element.dispatchEvent(event)
}

/**
 * Mock iOS-specific error types
 */
export class IOSStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IOSStorageError'
  }
}

export class IOSNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IOSNetworkError'
  }
}

export class IOSBackgroundTaskError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IOSBackgroundTaskError'
  }
}

/**
 * Helper to create iOS test environment
 */
export const createIOSTestEnvironment = () => {
  return {
    platform: mockIOSPlatform,
    app: mockIOSApp,
    requestUrl: mockIOSRequestUrl,
    Notice: MockIOSNotice,
  }
}

/**
 * Helper to create iPad test environment
 */
export const createIPadTestEnvironment = () => {
  return {
    platform: mockIPadPlatform,
    app: mockIOSApp,
    requestUrl: mockIOSRequestUrl,
    Notice: MockIOSNotice,
  }
}
