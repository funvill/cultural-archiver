import { config } from '@vue/test-utils';
import { vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// Ensure an active Pinia exists as soon as the test setup module is loaded.
// Some components access stores during their setup phase; creating an
// active Pinia immediately prevents "no active Pinia" errors during
// component initialization. We still recreate a fresh Pinia in beforeEach
// to avoid test-state leakage between tests.
setActivePinia(createPinia());

// Provide a safe Pinia provider for tests. Instead of pushing a single shared
// Pinia instance (which causes Vue to warn when multiple apps are created
// during tests), register a small plugin that will create and provide a new
// Pinia instance for the app only if it hasn't been provided already.
config.global.plugins = config.global.plugins || [];

// Instead of installing Pinia onto the app (which causes Vue to warn when
// multiple apps are created in tests), set an active Pinia instance per test
// run. Pinia's `useStore()` will fall back to the active Pinia when there is
// no injection context, which is suitable for unit tests.
beforeEach(() => {
  // Create a fresh Pinia instance for each test and make it the active one.
  setActivePinia(createPinia());
});

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
};

// Global test setup
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

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
});

// Mock navigator.geolocation
Object.defineProperty(navigator, 'geolocation', {
  writable: true,
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

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
      clone: vi.fn(),
    } as unknown as Response);
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
    clone: vi.fn(),
  } as unknown as Response);
});

// Mock import.meta.env for API configuration
Object.defineProperty(import.meta, 'env', {
  value: {
    PROD: false,
    MODE: 'test',
    VITE_API_TIMEOUT: '30000',
  },
  writable: true,
});
