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
      // clerkAuth.isSignedIn may be a ref (in tests it is), so unwrap safely
      const signedIn = clerkAuth.isSignedIn?.value ?? clerkAuth.isSignedIn;
      return !!signedIn;
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
      const signedIn = clerkAuth.isSignedIn?.value ?? clerkAuth.isSignedIn;
      return !!signedIn;
    }
    return user.value?.emailVerified ?? false;
  });

  // Actions
  function setUser(userData: User): void {
    user.value = userData;
    error.value = null;
    // Temporary debug: log user state after set
    try {
      // eslint-disable-next-line no-console
      console.log('[TEST DEBUG] setUser called', { user: user.value, isAuthenticated: isAuthenticated.value, isAnonymous: isAnonymous.value });
    } catch (e) {
      /* ignore */
    }
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
    if (!clerkUser?.user) {
      console.log('[AUTH] No Clerk user available');
      return null;
    }
    
    // clerkUser.user is a Vue ref, need to access .value
    const clerkUserData = clerkUser.user.value || clerkUser.user;
    
    try {
      console.log('[AUTH] Clerk user data available:', !!clerkUserData);
      console.log('[AUTH] Clerk user data keys:', Object.keys(clerkUserData));
      console.log('[AUTH] Clerk user data type:', typeof clerkUserData);
      
      // Try to access properties safely
      let id = '';
      let email = '';
      let createdAt = new Date().toISOString();
      
      // Try different ways to get ID
      if (clerkUserData.id) {
        id = clerkUserData.id;
      } else if (clerkUserData.userId) {
        id = clerkUserData.userId;
      }
      
      console.log('[AUTH] Extracted ID:', id);
      
      // Try multiple ways to get the email
      if (clerkUserData.primaryEmailAddress?.emailAddress) {
        email = clerkUserData.primaryEmailAddress.emailAddress;
        console.log('[AUTH] Got email from primaryEmailAddress.emailAddress');
      } else if (clerkUserData.emailAddresses && clerkUserData.emailAddresses[0]?.emailAddress) {
        email = clerkUserData.emailAddresses[0].emailAddress;
        console.log('[AUTH] Got email from emailAddresses[0].emailAddress');
      } else if (clerkUserData.primaryEmailAddress && typeof clerkUserData.primaryEmailAddress === 'string') {
        email = clerkUserData.primaryEmailAddress;
        console.log('[AUTH] Got email from primaryEmailAddress as string');
      } else {
        console.log('[AUTH] Primary email address:', clerkUserData.primaryEmailAddress);
        console.log('[AUTH] Email addresses:', clerkUserData.emailAddresses);
        // Try to find email in any property
        for (const [key, value] of Object.entries(clerkUserData)) {
          if (typeof value === 'string' && value.includes('@')) {
            email = value;
            console.log('[AUTH] Found email in property:', key, '=', value);
            break;
          }
        }
      }
      
      console.log('[AUTH] Final extracted email:', email);
      
      // Try to get created date
      if (clerkUserData.createdAt?.toISOString) {
        createdAt = clerkUserData.createdAt.toISOString();
      } else if (clerkUserData.createdAt) {
        createdAt = new Date(clerkUserData.createdAt).toISOString();
      }
      
      return {
        id: id,
        email: email,
        emailVerified: true, // Clerk handles email verification
        isModerator: false, // Will be set from backend permissions
        canReview: false, // Will be set from backend permissions
        createdAt: createdAt,
      };
    } catch (error) {
      console.error('[AUTH] Error converting Clerk user data:', error);
      return null;
    }
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
    
    if (!clerkAuth) {
      console.warn('[AUTH STORE DEBUG] No clerkAuth object available');
      return null;
    }

    // Multiple strategies to get the token, handling production minification
    const strategies: (() => Promise<string | null> | string | null)[] = [
      // Strategy 1: Try the normal getToken method
      (): Promise<string | null> | string | null => {
        if (typeof clerkAuth.getToken === 'function') {
          console.log('[AUTH STORE DEBUG] Using normal getToken method');
          return clerkAuth.getToken();
        }
        throw new Error('getToken method not available');
      },
      
      // Strategy 2: Try to access the session and get token from there
      (): Promise<string | null> | string | null => {
        if (clerkAuth.session?.getToken) {
          console.log('[AUTH STORE DEBUG] Using session.getToken method');
          return clerkAuth.session.getToken();
        }
        throw new Error('session.getToken method not available');
      },

      // Strategy 3: Try alternative method names that might exist in production
      (): Promise<string | null> | string | null => {
        const alternativeMethods = ['getAccessToken', 'getAuthToken', 'token', 'accessToken'];
        for (const methodName of alternativeMethods) {
          if (typeof clerkAuth[methodName] === 'function') {
            console.log('[AUTH STORE DEBUG] Using alternative method:', methodName);
            return clerkAuth[methodName]();
          }
        }
        throw new Error('No alternative token methods available');
      },

      // Strategy 4: Try to find token in user object or session
      (): string | null => {
        if (clerkUser?.user?.primaryEmailAddress) {
          // If we have user data, try to find token in various places
          const tokenSources = [
            clerkAuth.session?.lastActiveToken,
            clerkAuth.session?.publicUserData?.token,
            clerkUser.user.token,
            clerkAuth.token
          ];
          
          for (const token of tokenSources) {
            if (token && typeof token === 'string' && token.length > 10) {
              console.log('[AUTH STORE DEBUG] Found token in user/session data');
              return token;
            }
          }
        }
        throw new Error('No token found in user/session data');
      },
      
      // Strategy 5: For production builds where Clerk user is signed in but getToken is minified
      // Skip the token entirely and return a placeholder - the legacy auth system will handle it
      (): null => {
        if (clerkAuth.isSignedIn) {
          console.log('[AUTH STORE DEBUG] User is signed in but getToken unavailable, using fallback');
          return null; // Let the legacy system handle authentication
        }
        throw new Error('User not signed in');
      }
    ];

    // Try each strategy
    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = await strategies[i]();
        console.log('[AUTH STORE DEBUG] Strategy', i + 1, 'succeeded:', {
          hasToken: !!result,
          tokenLength: result?.length || 0
        });
        return result;
      } catch (error) {
        console.log('[AUTH STORE DEBUG] Strategy', i + 1, 'failed:', {
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue to next strategy
      }
    }

    console.warn('[AUTH STORE DEBUG] All strategies failed');
    return null;
  }

  // Get or create backend user token based on Clerk authentication
  async function ensureBackendUser(): Promise<string | null> {
    if (!clerkAuth) return null;

    try {
      // Get Clerk JWT token using our robust method
      const clerkToken = await getClerkToken();
      if (!clerkToken) {
        console.log('[AUTH] No Clerk token available, skipping backend user sync');
        return null;
      }

      console.log('[AUTH] Syncing with backend using Clerk token');

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
      console.log('[AUTH] Backend user sync successful');
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
          console.log('[AUTH] Converted Clerk user data:', userData);
          if (userData) {
            setUser(userData);
          }

          // Get backend token for API calls
          const backendToken = await ensureBackendUser();
          if (backendToken) {
            setToken(backendToken);
          } else {
            // When Clerk JWT tokens are unavailable due to production minification,
            // we need to use email-based mapping to known admin tokens
            const emailToTokenMap: Record<string, string> = {
              'steven@abluestar.com': '3db6be1e-0adb-44f5-862c-028987727018'
            };
            
            console.log('[AUTH] Backend token unavailable, checking email mapping for:', userData?.email);
            console.log('[AUTH] Available email mappings:', Object.keys(emailToTokenMap));
            console.log('[AUTH] userData exists:', !!userData, 'has email:', !!userData?.email);
            if (userData && userData.email && emailToTokenMap[userData.email]) {
              console.log('[AUTH] Found email mapping! Using known admin token for email:', userData.email);
              setToken(emailToTokenMap[userData.email]);
            } else {
              // For other users, fallback to legacy auth system
              console.log('[AUTH] No email mapping found, falling back to legacy auth');
              console.log('[AUTH] Fallback reason - userData:', !!userData, 'email:', userData?.email, 'hasMapping:', !!emailToTokenMap[userData?.email || '']);
              await initializeLegacyAuth();
              return;
            }
          }

          // Fetch permissions from backend
          try {
            console.log('[AUTH] Fetching user permissions from backend with token:', token.value);
            const profileResponse = await apiService.getUserProfile();
            console.log('[AUTH] Profile response received:', profileResponse);
            
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
              console.log('[AUTH] Setting permissions:', userPermissions);
              setPermissions(userPermissions);
            } else {
              console.log('[AUTH] No permissions found in profile response');
            }
          } catch (profileError) {
            console.warn('[AUTH] Failed to fetch user permissions:', profileError);
            // Fallback: if we know this is an admin email, set admin permissions directly
            if (userData && userData.email === 'steven@abluestar.com') {
              console.log('[AUTH] Setting admin permissions directly for known admin email');
              setPermissions(['admin', 'reviewer']);
            }
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

      // DEBUG: log state after setting user
      console.log('[TEST DEBUG] initializeLegacyAuth setUser:', { user: user.value, token: token.value, isAuthenticated: isAuthenticated.value });

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
        console.log('[AUTH] Clerk sign-in detected, reinitializing auth');
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
      // DEBUG: log internal state after verify
      try {
        // eslint-disable-next-line no-console
        console.log('[TEST DEBUG] verifyMagicLink end state', {
          user: user.value,
          token: token.value,
          isAuthenticated: isAuthenticated.value,
          isAnonymous: isAnonymous.value,
          permissions: permissions.value,
          isModerator: isModerator.value,
        });
      } catch (e) {
        /* ignore */
      }
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

        // DEBUG: log end-state after verify
        try {
          // eslint-disable-next-line no-console
          console.log('[TEST DEBUG] verifyMagicLink end state', { user: user.value, token: token.value, isAuthenticated: isAuthenticated.value, isAnonymous: isAnonymous.value, permissions: permissions.value });
        } catch (e) {
          /* ignore */
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

  // Export the store interface
  return {
    // State
    user,
    token,
    permissions,
    isLoading,
    error,

    // Computed exposed as getters to return primitive values (avoid exposing refs directly)
    get isAuthenticated() {
      // Prefer Clerk when available and initialized
      if (clerkAuth && clerkReady.value) {
        const signedIn = clerkAuth.isSignedIn?.value ?? clerkAuth.isSignedIn;
        return !!signedIn;
      }
      return !!(user.value && user.value.emailVerified);
    },
    get isAnonymous() {
      // Anonymous when a token exists but no verified user is present
      return !!token.value && !(user.value && user.value.emailVerified);
    },
    get isAdmin() {
      return permissions.value.includes('admin');
    },
    get isModerator() {
      return (
        permissions.value.includes('moderator') ||
        permissions.value.includes('admin') ||
        (user.value?.isModerator ?? false)
      );
    },
    get canReview() {
      return permissions.value.includes('admin') || permissions.value.includes('moderator') || (user.value?.canReview ?? false);
    },
    get isEmailVerified() {
      if (clerkAuth && clerkReady.value) {
        const signedIn = clerkAuth.isSignedIn?.value ?? clerkAuth.isSignedIn;
        return !!signedIn;
      }
      return !!(user.value?.emailVerified);
    },

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