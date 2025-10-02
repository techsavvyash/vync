import { jest } from '@jest/globals'

// Set up global test environment
process.env.NODE_ENV = 'test'

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Set up fake timers for testing
jest.useFakeTimers()

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})