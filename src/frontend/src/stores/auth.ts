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
    clerkAuth = useClerkAuth();
    clerkUser = useClerkUser();
  } catch (error) {
    console.error('[AUTH] Clerk initialization failed:', error instanceof Error ? error.message : String(error));
    console.warn('[AUTH] Clerk not available, falling back to legacy auth');
  }

  /**
   * Extract Clerk user ID from the session/token before minification issues occur
   * This function tries multiple strategies to get the user ID and stores it in localStorage
   */
  function extractAndStoreClerkUserId(): string | null {
    if (!clerkAuth) {
      return null;
    }

    try {
      // PRIMARY: Use Clerk's userId from useAuth composable (most reliable)
      const clerkUserId = (clerkAuth as any).userId;
      
      if (clerkUserId && typeof clerkUserId === 'object' && 'value' in clerkUserId) {
        // It's a ref, unwrap it
        const id = clerkUserId.value;
        if (id && typeof id === 'string' && id.startsWith('user_')) {
          localStorage.setItem('clerk-user-id', id);
          return id;
        }
      } else if (typeof clerkUserId === 'string' && clerkUserId.startsWith('user_')) {
        // Direct value
        localStorage.setItem('clerk-user-id', clerkUserId);
        return clerkUserId;
      }

      // FALLBACK 1: Try session data
      if ((clerkAuth as any).session) {
        const sessionData = (clerkAuth as any).session.value || (clerkAuth as any).session;
        if (sessionData && sessionData.userId && typeof sessionData.userId === 'string') {
          localStorage.setItem('clerk-user-id', sessionData.userId);
          return sessionData.userId;
        }
      }

      // FALLBACK 2: Check localStorage for previously stored ID
      const storedId = localStorage.getItem('clerk-user-id');
      if (storedId && storedId.startsWith('user_')) {
        return storedId;
      }

      return null;
    } catch (error) {
      console.error('[AUTH] Error extracting Clerk user ID:', error);
      return null;
    }
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
      // clerkAuth.isSignedIn may be a ref (in tests it is), so unwrap safely
      const signedIn = clerkAuth.isSignedIn?.value ?? clerkAuth.isSignedIn;
      return !!signedIn;
    }
    // Fallback to legacy authentication
    return !!user.value && user.value.emailVerified;
  });

  const isAnonymous = computed(() => 
    !!token.value && !(user.value && user.value.emailVerified)
  );
  
  // Role flags
  const isAdmin = computed(() => permissions.value.includes('admin'));
  const isModerator = computed(
    () =>
      permissions.value.includes('moderator') ||
      permissions.value.includes('admin') ||
      (user.value?.isModerator ?? false)
  );

  const canReview = computed(() => 
    permissions.value.includes('admin') || 
    permissions.value.includes('moderator') || 
    (user.value?.canReview ?? false)
  );
  const isEmailVerified = computed(() => {
    // If Clerk is available, user is always email verified if signed in
    if (clerkAuth && clerkReady.value && clerkAuth.isSignedIn) {
      const signedIn = clerkAuth.isSignedIn?.value ?? clerkAuth.isSignedIn;
      return !!signedIn;
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
    if (!clerkAuth) {
      return null;
    }
    
    try {
      // Get user ID directly from useAuth() composable
      const clerkUserId = (clerkAuth as any).userId;
      let id = '';
      if (clerkUserId && typeof clerkUserId === 'object' && 'value' in clerkUserId) {
        id = clerkUserId.value || '';
      } else if (typeof clerkUserId === 'string') {
        id = clerkUserId;
      }

      // Get primary email from useUser() composable
      let email = '';
      if (clerkUser?.user) {
        const userData = clerkUser.user.value || clerkUser.user;
        if (userData?.primaryEmailAddress?.emailAddress) {
          email = userData.primaryEmailAddress.emailAddress;
        } else if (userData?.emailAddresses?.[0]?.emailAddress) {
          email = userData.emailAddresses[0].emailAddress;
        }
      }

      if (!id) {
        console.warn('[AUTH] Could not extract user ID from Clerk');
        return null;
      }

      return {
        id: id,
        email: email,
        emailVerified: true, // Clerk handles email verification
        isModerator: false, // Will be set from backend permissions
        canReview: false, // Will be set from backend permissions
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[AUTH] Error converting Clerk user data:', error);
      return null;
    }
  }

  // Get Clerk JWT token for API requests
  async function getClerkToken(): Promise<string | null> {
    if (!clerkAuth) {
      return null;
    }

    try {
      // The correct way to get the token from useAuth()
      const { getToken } = clerkAuth as any;
      
      if (getToken?.value && typeof getToken.value === 'function') {
        const token = await getToken.value();
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('[AUTH] Error getting Clerk token:', error);
      return null;
    }
  }

  // Initialize auth - handles both Clerk and legacy authentication
  async function initializeAuth(): Promise<void> {
    try {
      setLoading(true);

      // Check if Clerk is available and ready
      if (clerkAuth && clerkUser) {
        // CRITICAL: Wait for Clerk to be fully loaded before accessing user data
        const isLoaded = (clerkAuth as any).isLoaded;
        const isLoadedValue = isLoaded?.value ?? isLoaded;
        
        if (!isLoadedValue) {
          // Wait a bit for Clerk to initialize, then retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        clerkReady.value = true;
        
        // Check if signed in
        const isSignedIn = (clerkAuth as any).isSignedIn;
        const isSignedInValue = isSignedIn?.value ?? isSignedIn;
        
        // If signed in with Clerk, sync with backend
        if (isSignedInValue) {
          // CRITICAL: Try to extract and store Clerk user ID immediately before any minification issues
          extractAndStoreClerkUserId();
          
          // Convert Clerk user to our format
          let userData = convertClerkUserToUser();
          
          // PRODUCTION FIX: If we can't extract user ID from Clerk (minification issue),
          // but we know the user is signed in, try to use their Clerk user ID directly
          // Check if we have a stored Clerk ID mapping
          const storedClerkId = localStorage.getItem('clerk-user-id');
          if (!userData?.id && storedClerkId) {
            // Create minimal user data if conversion failed completely
            if (!userData) {
              userData = {
                id: storedClerkId,
                email: '', // Will be populated by backend
                emailVerified: true,
                isModerator: false,
                canReview: false,
                createdAt: new Date().toISOString(),
              };
            } else {
              userData.id = storedClerkId;
            }
          }
          
          // If we still don't have an ID but Clerk says signed in, this is the minification bug
          if (!userData?.id) {
            console.error('[AUTH] CRITICAL: Clerk reports signed in but cannot extract user ID due to minification');
            console.error('[AUTH] This is a known production build issue. Falling back to legacy auth.');
            await initializeLegacyAuth();
            return;
          }
          
          if (userData) {
            setUser(userData);
            // Store the Clerk ID for future use
            localStorage.setItem('clerk-user-id', userData.id);
          }

          // Get backend token for API calls
          // For Clerk users, use their Clerk ID as the token
          const clerkUserId = userData?.id;
          if (clerkUserId) {
            setToken(clerkUserId);
          } else {
            // Fallback to legacy auth system
            await initializeLegacyAuth();
            return;
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

          return;
        }
      }

      // Fallback to legacy authentication system
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
    let statusResponse;
    try {
      statusResponse = await apiService.getAuthStatus();
    } catch (err) {
      console.warn('[AUTH] getAuthStatus failed, falling back to anonymous token', err);
      if (!token.value) {
        await ensureUserToken();
      }
      return;
    }
    
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
      // Prefer backend-generated token via apiService
      try {
        const response = await apiService.generateToken();
        if (response && response.data && response.data.token) {
          setToken(response.data.token);
          return response.data.token;
        }
      } catch (e) {
        // Let outer catch handle fallback
        throw e;
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      // Fallback: generate anonymous token locally
      try {
        const anonymousId = crypto.randomUUID();
        setToken(anonymousId);
        return anonymousId;
      } catch (uuidError) {
        // If crypto.randomUUID isn't available, rethrow original
        throw error;
      }
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

      // Attempt server-side logout which may return a new anonymous token
      try {
        const response = await apiService.logout();
        if (response && response.data && response.data.new_user_token) {
          // Clear user but set anonymous token returned by server
          user.value = null;
          setToken(response.data.new_user_token);
        } else {
          // No token returned; clear state
          clearAuth();
        }
      } catch (apiError) {
        console.error('[AUTH] Remote logout failed, falling back to local clear:', apiError);
        // Fallback to generating anonymous token locally
        try {
          const anon = crypto.randomUUID();
          clearAuth();
          setToken(anon);
        } catch (uuidError) {
          clearAuth();
        }
      }

      // Track logout
      analytics.trackEvent('user_logout');

    } catch (error) {
      console.error('[AUTH] Logout failed:', error);
      // Ensure local state cleared
      clearAuth();
    }
  }

  // Watch for Clerk authentication changes
  if (clerkAuth) {
    watch(() => clerkAuth.isSignedIn, (isSignedIn: boolean) => {
      if (isSignedIn) {
        console.log('[AUTH] Clerk sign-in detected, extracting and storing user ID');
        // CRITICAL: Extract and store Clerk user ID immediately before minification issues occur
        extractAndStoreClerkUserId();
        console.log('[AUTH] Reinitializing auth after Clerk sign-in');
        initializeAuth();
      } else {
        console.log('[AUTH] Clerk sign-out detected, clearing auth');
        clearAuth();
      }
    });
  }

  // Legacy magic link methods (will be removed eventually)
  async function requestMagicLink(email: string): Promise<{ success: boolean; message: string; isSignup?: boolean }> {
    setLoading(true);
    clearError();
    try {
      const response = await apiService.requestMagicLink(email);
      // Normalize response
      const data = response?.data || {};
      return {
        success: !!data.success,
        message: data.message || '',
        isSignup: data.is_signup,
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }

  async function verifyMagicLink(tokenStr: string): Promise<{ success: boolean; message: string; isNewAccount?: boolean }> {
    setLoading(true);
    clearError();
    try {
      const response = await apiService.verifyMagicLink(tokenStr);
      if (response.success) {
        const userData = response.data?.user;
        if (userData) {
          setUser({
            id: userData.uuid,
            email: userData.email,
            emailVerified: true,
            isModerator: false,
            canReview: false,
            createdAt: userData.created_at,
          });
        }
        // If backend returned a token, set it
        if (response.data?.user_token) {
          setToken(response.data.user_token);
        }

        return { success: true, message: response.data?.message || 'Verified', isNewAccount: !!response.data?.is_new_account };
      }
      return { success: false, message: response.message || 'Verification failed' };
    } catch (error) {
      const msg = getErrorMessage(error);
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }

  // Compatibility methods for legacy code
  function getUserToken(): string {
    return token.value || '';
  }

  async function refreshAuthStatus(): Promise<void> {
    await initializeAuth();
  }

  // Try to extract and store Clerk user ID on store initialization (if user is already signed in)
  if (clerkAuth && clerkUser) {
    // Use a watcher to wait for Clerk's userId to be loaded
    import('vue').then(({ watch }) => {
      const userIdRef = (clerkAuth as any).userId;
      if (userIdRef && typeof userIdRef === 'object' && 'value' in userIdRef) {
        // Watch the userId ref until it has a value
        const stopWatch = watch(
          () => userIdRef.value,
          (newUserId) => {
            if (newUserId && typeof newUserId === 'string' && newUserId.startsWith('user_')) {
              localStorage.setItem('clerk-user-id', newUserId);
              stopWatch(); // Stop watching once we have the ID
            }
          },
          { immediate: true } // Check immediately in case it's already loaded
        );
      }
    });
  }

  // Export the store interface
  return {
    // State
    user,
    token,
    permissions,
    isLoading,
    error,

    // Expose computed refs directly for reactivity
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

    // Legacy compatibility methods
    getUserToken,
    refreshAuthStatus,
  };
});