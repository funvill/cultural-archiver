import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    generateToken: vi.fn().mockResolvedValue({
      data: { token: 'test-uuid-token', isNew: true },
    }),
    verifyMagicLink: vi.fn().mockResolvedValue({
      success: true,
      data: {
        user: { uuid: 'test-uuid', email: 'test@example.com', created_at: '2025-01-01' },
        message: 'Login successful',
        is_new_account: false,
      },
    }),
    requestMagicLink: vi.fn().mockResolvedValue({
      data: {
        success: true,
        is_signup: false,
        message: 'Magic link sent',
      },
    }),
    logout: vi.fn().mockResolvedValue({
      data: {
        success: true,
        new_user_token: 'new-anonymous-uuid',
      },
    }),
    getAuthStatus: vi.fn().mockResolvedValue({
      data: {
        is_authenticated: false,
        user_token: 'test-token',
        user: null,
      },
    }),
  },
  getErrorMessage: vi.fn().mockReturnValue('Test error message'),
  isUnauthorized: vi.fn().mockReturnValue(false),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn().mockReturnValue(null),
};
global.localStorage = localStorageMock;

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Initial State', () => {
    it('initializes with default values', () => {
      const store = useAuthStore();

      expect(store.isAuthenticated).toBe(false);
      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('loads user token from localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('stored-token');

      const store = useAuthStore();

      // Wait for initialization to complete
      await store.initializeAuth();

      expect(localStorageMock.getItem).toHaveBeenCalledWith('user-token');
    });
  });

  describe('Token Management', () => {
    it('ensures user token is generated when needed', async () => {
      const store = useAuthStore();

      const token = await store.ensureUserToken();

      expect(token).toBe('test-uuid-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user-token', 'test-uuid-token');
    });

    it('does not regenerate existing token', async () => {
      const store = useAuthStore();
      store.setToken('existing-token');

      const token = await store.ensureUserToken();

      expect(token).toBe('existing-token');
    });

    it('handles token generation failure gracefully', async () => {
      // Mock console.error to suppress expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockApi = await import('../../services/api');
      vi.mocked(mockApi.apiService.generateToken).mockRejectedValue(new Error('Network error'));

      const store = useAuthStore();

      await store.ensureUserToken();

      // Should fallback to crypto.randomUUID()
      expect(store.token).toBeTruthy();

      consoleSpy.mockRestore();
    });
  });

  describe('Magic Link Authentication', () => {
    it('requests magic link successfully', async () => {
      const store = useAuthStore();

      const result = await store.requestMagicLink('test@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Magic link sent');
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('handles magic link request failure', async () => {
      const mockApi = await import('../../services/api');
      vi.mocked(mockApi.apiService.requestMagicLink).mockRejectedValue(new Error('Rate limited'));

      const store = useAuthStore();

      const result = await store.requestMagicLink('test@example.com');

      expect(result.success).toBe(false);
      expect(store.error).toBe('Test error message');
    });

    it('verifies magic link successfully', async () => {
      const store = useAuthStore();

      const result = await store.verifyMagicLink('test-token');

      expect(result.success).toBe(true);
      expect(store.isAuthenticated).toBe(true);
      expect(store.user?.email).toBe('test@example.com');
    });

    it('handles magic link verification failure', async () => {
      const mockApi = await import('../../services/api');
      vi.mocked(mockApi.apiService.verifyMagicLink).mockRejectedValue(new Error('Invalid token'));

      const store = useAuthStore();

      const result = await store.verifyMagicLink('invalid-token');

      expect(result.success).toBe(false);
      expect(store.error).toBe('Test error message');
    });
  });

  describe('Authentication Status', () => {
    it('initializes authentication status', async () => {
      const store = useAuthStore();

      await store.initializeAuth();

      expect(store.token).toBeTruthy();
    });

    it('refreshes authentication status', async () => {
      const mockApi = await import('../../services/api');
      vi.mocked(mockApi.apiService.getAuthStatus).mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          is_authenticated: true,
          is_anonymous: false,
          user: {
            uuid: 'test-uuid',
            email: 'test@example.com',
            created_at: '2025-01-01',
            status: 'active',
          },
          user_token: 'test-token',
        },
      });

      const store = useAuthStore();

      await store.refreshAuthStatus();

      expect(store.isAuthenticated).toBe(true);
      expect(store.user?.email).toBe('test@example.com');
    });

    it('handles authentication status check failure', async () => {
      // Mock console.error to suppress expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockApi = await import('../../services/api');
      vi.mocked(mockApi.apiService.getAuthStatus).mockRejectedValue(new Error('Network error'));

      const store = useAuthStore();

      await store.initializeAuth();

      // Should still have generated an anonymous token
      expect(store.token).toBeTruthy();

      consoleSpy.mockRestore();
    });
  });

  describe('Logout', () => {
    it('logs out successfully', async () => {
      const store = useAuthStore();

      // Set up authenticated state
      store.setUser({
        id: 'test-uuid',
        email: 'test@example.com',
        emailVerified: true,
        // Deprecated field intentionally omitted
        createdAt: '2025-01-01',
      });

      await store.logout();

      expect(store.isAuthenticated).toBe(false);
      expect(store.token).toBe('new-anonymous-uuid');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user-token', 'new-anonymous-uuid');
    });

    it('handles logout failure gracefully', async () => {
      // Mock console.error to suppress expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockApi = await import('../../services/api');
      vi.mocked(mockApi.apiService.logout).mockRejectedValue(new Error('Server error'));

      const store = useAuthStore();

      await store.logout();

      // Should fallback to generating anonymous token
      expect(store.token).toBeTruthy();

      consoleSpy.mockRestore();
    });
  });

  describe('Error Management', () => {
    it('clears errors', () => {
      const store = useAuthStore();

      store.setError('Test error');
      store.clearError();

      expect(store.error).toBeNull();
    });

    it('sets loading state during async operations', async () => {
      const store = useAuthStore();

      const promise = store.requestMagicLink('test@example.com');

      // Loading should be true during the operation
      expect(store.isLoading).toBe(true);

      await promise;

      expect(store.isLoading).toBe(false);
    });
  });

  describe('State Persistence', () => {
    it('persists user token to localStorage', async () => {
      const store = useAuthStore();

      store.setToken('test-token');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('user-token', 'test-token');
    });

    it('updates token on logout', async () => {
      const store = useAuthStore();

      await store.logout();

      expect(localStorageMock.setItem).toHaveBeenCalledWith('user-token', expect.any(String));
    });
  });

  describe('Computed Properties', () => {
    it('returns correct authentication state for anonymous user', () => {
      const store = useAuthStore();

      store.setUser({
        id: 'test-uuid',
        email: '',
        emailVerified: false,
        createdAt: '2025-01-01',
      });
      store.setToken('test-token');

      expect(store.isAuthenticated).toBe(false);
      expect(store.isAnonymous).toBe(true);
    });

    it('returns correct authentication state for authenticated user', () => {
      const store = useAuthStore();

      store.setUser({
        id: 'test-uuid',
        email: 'test@example.com',
        emailVerified: true,
        createdAt: '2025-01-01',
      });

      expect(store.isAuthenticated).toBe(true);
      expect(store.isAnonymous).toBe(false);
    });

    it('returns correct reviewer status', () => {
      const store = useAuthStore();

      // Simulate moderator privilege (new canonical flag path)
      store.setPermissions(['moderator']);
      expect(store.isModerator).toBe(true);
      expect(store.canReview).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('gets user token', () => {
      const store = useAuthStore();

      store.setToken('test-token');

      expect(store.getUserToken()).toBe('test-token');
    });

    it('returns empty string when no token', () => {
      const store = useAuthStore();

      expect(store.getUserToken()).toBe('');
    });
  });

  describe('UUID Replacement Logic', () => {
    it('handles cross-device login with token replacement', async () => {
      const mockApi = await import('../../services/api');
      vi.mocked(mockApi.apiService.verifyMagicLink).mockResolvedValue({
        success: true,
        data: {
          success: true,
          user: {
            uuid: 'account-uuid',
            email: 'test@example.com',
            created_at: '2025-01-01',
            email_verified_at: '2025-01-01',
          },
          message: 'Login successful',
          session: { token: 'session-token', expires_at: '2025-01-02' },
          uuid_replaced: true,
          is_new_account: false,
        },
        timestamp: new Date().toISOString(),
      });

      const store = useAuthStore();
      store.setToken('browser-uuid');

      const result = await store.verifyMagicLink('test-token');

      expect(result.success).toBe(true);
      expect(store.token).toBe('account-uuid');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user-token', 'account-uuid');
    });
  });
});
