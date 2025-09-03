import { config } from '@vue/test-utils'
import { vi, beforeEach } from 'vitest'

// Mock Vue Router
config.global.mocks = {
  $route: {
    path: '/',
    params: {},
    query: {},
  },
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  },
}

// Global test setup
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
})

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock navigator.geolocation
Object.defineProperty(navigator, 'geolocation', {
  writable: true,
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock fetch API for API service tests
global.fetch = vi.fn().mockImplementation((url: string) => {
  // Return different responses based on URL
  if (url.includes('/status')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ token: 'mock-token-123' }),
      text: vi.fn().mockResolvedValue('{"token":"mock-token-123"}'),
      url: url,
      clone: vi.fn()
    } as unknown as Response)
  }
  
  // Default response
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue('{}'),
    url: url,
    clone: vi.fn()
  } as unknown as Response)
})

// Mock import.meta.env for API configuration
Object.defineProperty(import.meta, 'env', {
  value: {
    PROD: false,
    MODE: 'test',
    VITE_API_TIMEOUT: '30000'
  },
  writable: true
})