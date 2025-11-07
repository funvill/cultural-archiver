// @ts-nocheck
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import type { User, Permission } from '../types';
import { apiService, getErrorMessage } from '../services/api';
import { useAnalytics } from '../composables/useAnalytics';

// Clerk integration
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/vue';

/**
 * Authentication store that bridges Clerk authentication with the existing system
 */
export const useAuthStore = defineStore('auth', () => {
  // Analytics
  const analytics = useAnalytics();
  
  // Clerk composables
  let clerkAuth: unknown = null;
  let clerkUser: unknown = null;
  
  // Initialize Clerk composables safely
  try {
    console.log('[AUTH STORE DEBUG] Initializing Clerk composables');
    clerkAuth = useClerkAuth();
    clerkUser = useClerkUser();
    console.log('[AUTH STORE DEBUG] Clerk composables initialized', {
      hasClerkAuth: !!clerkAuth,
      hasClerkUser: !!clerkUser,
      clerkAuthType: typeof clerkAuth,
      clerkUserType: typeof clerkUser
    });
  } catch (error) {
    console.error('[AUTH STORE DEBUG] Clerk initialization failed:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error
    });
    console.warn('[AUTH] Clerk not available, falling back to legacy auth');
  }

  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const permissions = ref<Permission[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const clerkReady = ref(false);

  // Computed getters
  const isAuthenticated = computed(() => {
    // If Clerk is available, use Clerk's authentication state
    if (clerkAuth && clerkReady.value) {
      return clerkAuth.isSignedIn;
    }
    // Fallback to legacy authentication
    return !!user.value && user.value.emailVerified;
  });

  const isAnonymous = computed(() => !!token.value && !isAuthenticated.value);
  
  // Role flags
  const isAdmin = computed(() => permissions.value.includes('admin'));
  const isModerator = computed(
    () =>
      permissions.value.includes('moderator') ||
      permissions.value.includes('admin') ||
      (user.value?.isModerator ?? false)
  );

  const canReview = computed(() => isModerator.value || isAdmin.value);
  const isEmailVerified = computed(() => {
    // If Clerk is available, user is always email verified if signed in
    if (clerkAuth && clerkReady.value && clerkAuth.isSignedIn) {
      return true;
    }
    return user.value?.emailVerified ?? false;
  });

  // Actions
  function setUser(userData: User): void {
    user.value = userData;
    error.value = null;
  }

  function setToken(tokenValue: string): void {
    token.value = tokenValue;
    // Store token in localStorage for persistence
    localStorage.setItem('user-token', tokenValue);
  }

  function setPermissions(userPermissions: Permission[]): void {
    permissions.value = userPermissions;
  }

  function clearAuth(): void {
    user.value = null;
    token.value = null;
    permissions.value = [];
    localStorage.removeItem('user-token');
    error.value = null;
  }

  function setError(message: string): void {
    error.value = message;
  }

  function clearError(): void {
    error.value = null;
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  // Clerk integration: Convert Clerk user to our User format
  function convertClerkUserToUser(): User | null {
    if (!clerkUser?.user) return null;
    
    const clerkUserData = clerkUser.user;
    return {
      id: clerkUserData.id,
      email: clerkUserData.primaryEmailAddress?.emailAddress || '',
      emailVerified: true, // Clerk handles email verification
      isModerator: false, // Will be set from backend permissions
      canReview: false, // Will be set from backend permissions
      createdAt: clerkUserData.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  // Get Clerk JWT token for API requests
  async function getClerkToken(): Promise<string | null> {
    console.log('[AUTH STORE DEBUG] getClerkToken called', {
      timestamp: new Date().toISOString(),
      hasClerkAuth: !!clerkAuth,
      hasGetTokenMethod: !!clerkAuth?.getToken,
      clerkReady: clerkReady.value,
      isSignedIn: clerkAuth?.isSignedIn
    });
    
    if (!clerkAuth?.getToken) {
      console.warn('[AUTH STORE DEBUG] No clerkAuth.getToken method available');
      return null;
    }

    try {
      const clerkToken = await clerkAuth.getToken();
      console.log('[AUTH STORE DEBUG] Clerk token retrieved', {
        hasToken: !!clerkToken,
        tokenLength: clerkToken?.length || 0
      });
      return clerkToken;
    } catch (error) {
      console.warn('[AUTH STORE DEBUG] Failed to get Clerk token:', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      return null;
    }
  }

  // Get or create backend user token based on Clerk authentication
  async function ensureBackendUser(): Promise<string | null> {
    if (!clerkAuth?.getToken) return null;

    try {
      // Get Clerk JWT token
      const clerkToken = await clerkAuth.getToken();
      if (!clerkToken) return null;

      // Call our backend to get/create user with Clerk token
      const response = await fetch('/api/auth/clerk/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clerkToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Backend user creation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('[AUTH] Failed to ensure backend user:', error);
      return null;
    }
  }

  // Initialize auth - handles both Clerk and legacy authentication
  async function initializeAuth(): Promise<void> {
    console.log('[AUTH] Starting authentication initialization');

    try {
      setLoading(true);

      // Check if Clerk is available and ready
      if (clerkAuth && clerkUser) {
        clerkReady.value = true;
        
        // If signed in with Clerk, sync with backend
        if (clerkAuth.isSignedIn && clerkUser.user) {
          console.log('[AUTH] Clerk user signed in, syncing with backend');
          
          // Convert Clerk user to our format
          const userData = convertClerkUserToUser();
          if (userData) {
            setUser(userData);
          }

          // Get backend token for API calls
          const backendToken = await ensureBackendUser();
          if (backendToken) {
            setToken(backendToken);
          }

          // Fetch permissions from backend
          try {
            const profileResponse = await apiService.getUserProfile();
            if (profileResponse.data?.is_reviewer) {
              if (user.value) {
                user.value.isModerator = true;
                user.value.canReview = true;
              }
            }

            // Extract permissions
            if (profileResponse.data?.debug?.permissions) {
              const permissionObjects = profileResponse.data.debug.permissions as Array<{
                permission: string;
                is_active: boolean;
              }>;
              const userPermissions = permissionObjects
                .filter(p => p.is_active)
                .map(p => p.permission as Permission);
              setPermissions(userPermissions);
            }
          } catch (profileError) {
            console.warn('[AUTH] Failed to fetch user permissions:', profileError);
          }

          console.log('[AUTH] Clerk authentication initialized successfully');
          return;
        }
      }

      // Fallback to legacy authentication system
      console.log('[AUTH] Using legacy authentication system');
      await initializeLegacyAuth();
      
    } catch (error) {
      console.error('[AUTH] Authentication initialization failed:', error);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // Legacy authentication initialization (existing logic)
  async function initializeLegacyAuth(): Promise<void> {
    // Check for existing token in localStorage
    const storedToken = localStorage.getItem('user-token');
    if (storedToken) {
      token.value = storedToken;
    }

    // Get current auth status from backend
    const statusResponse = await apiService.getAuthStatus();
    
    if (!statusResponse.success || !statusResponse.data) {
      // Create anonymous token if none exists
      if (!token.value) {
        await ensureUserToken();
      }
      return;
    }

    const authStatus = statusResponse.data;
    
    // Sync tokens
    if (authStatus.user_token !== token.value) {
      if (authStatus.is_authenticated) {
        setToken(authStatus.user_token);
      }
    }

    // Set user data
    if (authStatus.user && authStatus.is_authenticated) {
      const userData: User = {
        id: authStatus.user.uuid,
        email: authStatus.user.email,
        emailVerified: true,
        isModerator: false,
        canReview: false,
        createdAt: authStatus.user.created_at,
      };
      setUser(userData);

      // Fetch permissions
      try {
        const profileResponse = await apiService.getUserProfile();
        if (profileResponse.data?.is_reviewer) {
          userData.isModerator = true;
          userData.canReview = true;
        }

        if (profileResponse.data?.debug?.permissions) {
          const permissionObjects = profileResponse.data.debug.permissions as Array<{
            permission: string;
            is_active: boolean;
          }>;
          const userPermissions = permissionObjects
            .filter(p => p.is_active)
            .map(p => p.permission as Permission);
          setPermissions(userPermissions);
        }

        setUser(userData);
      } catch (profileError) {
        console.warn('[AUTH] Failed to fetch user profile:', profileError);
      }
    }
  }

  // Ensure user token exists (for anonymous users)
  async function ensureUserToken(): Promise<string> {
    if (token.value) {
      return token.value;
    }

    try {
      setLoading(true);
      // Generate a random UUID for anonymous users
      const anonymousId = crypto.randomUUID();
      const response = { success: true, data: { token: anonymousId } };
      
      if (response.success && response.data?.token) {
        setToken(response.data.token);
        return response.data.token;
      } else {
        throw new Error(response.message || 'Failed to create anonymous token');
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  // Logout function
  async function logout(): Promise<void> {
    try {
      // If using Clerk, sign out from Clerk
      if (clerkAuth?.signOut && clerkAuth.isSignedIn) {
        await clerkAuth.signOut();
      }

      // Clear local state
      clearAuth();
      
      // Track logout
      analytics.trackEvent('user_logout');
      
    } catch (error) {
      console.error('[AUTH] Logout failed:', error);
      // Still clear local state even if remote logout fails
      clearAuth();
    }
  }

  // Watch for Clerk authentication changes
  if (clerkAuth) {
    watch(() => clerkAuth.isSignedIn, (isSignedIn: boolean) => {
      if (isSignedIn) {
        console.log('[AUTH] Clerk sign-in detected, reinitializing auth');
        initializeAuth();
      } else {
        console.log('[AUTH] Clerk sign-out detected, clearing auth');
        clearAuth();
      }
    });
  }

  // Legacy magic link methods (will be removed eventually)
  async function requestMagicLink(_email: string): Promise<{ success: boolean; message: string; isSignup?: boolean }> {
    // Redirect to Clerk for now
    console.warn('[AUTH] Magic link authentication is deprecated. Please use Clerk authentication.');
    return {
      success: false,
      message: 'Magic link authentication is no longer supported. Please use the new authentication system.',
    };
  }

  async function verifyMagicLink(_token: string): Promise<{ success: boolean; message: string; isNewAccount?: boolean }> {
    // No longer supported
    return {
      success: false,
      message: 'Magic link verification is no longer supported.',
    };
  }

  // Export the store interface
  return {
    // State
    user,
    token,
    permissions,
    isLoading,
    error,
    
    // Computed
    isAuthenticated,
    isAnonymous,
    isAdmin,
    isModerator,
    canReview,
    isEmailVerified,
    
    // Actions
    setUser,
    setToken,
    setPermissions,
    clearAuth,
    setError,
    clearError,
    setLoading,
    initializeAuth,
    ensureUserToken,
    getClerkToken,
    logout,
    requestMagicLink,
    verifyMagicLink,
  };
});