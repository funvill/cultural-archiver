import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { 
  User, 
  MagicLinkRequest, 
  MagicLinkConsumeRequest,
  Permission
} from '../types'
import { apiService, getErrorMessage } from '../services/api'

/**
 * Authentication store for managing user state and tokens
 * Updated to work with the new UUID-based authentication system
 */
export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const permissions = ref<Permission[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed getters
  const isAuthenticated = computed(() => !!user.value && user.value.emailVerified)
  const isAnonymous = computed(() => !!token.value && !isAuthenticated.value)
  const isReviewer = computed(() => (user.value?.isReviewer ?? false) || permissions.value.includes('moderator') || permissions.value.includes('admin'))
  const isAdmin = computed(() => permissions.value.includes('admin'))
  const isEmailVerified = computed(() => user.value?.emailVerified ?? false)

  // Actions
  function setUser(userData: User): void {
    user.value = userData
    error.value = null
  }

  function setToken(tokenValue: string): void {
    token.value = tokenValue
    // Store token in localStorage for persistence
    localStorage.setItem('user-token', tokenValue)
  }

  function setPermissions(userPermissions: Permission[]): void {
    permissions.value = userPermissions
  }

  function clearAuth(): void {
    user.value = null
    token.value = null
    permissions.value = []
    localStorage.removeItem('user-token')
    error.value = null
  }

  function setError(message: string): void {
    error.value = message
  }

  function clearError(): void {
    error.value = null
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading
  }

  // Initialize auth from localStorage and check status
  async function initializeAuth(): Promise<void> {
    console.log('[AUTH DEBUG] Starting authentication initialization:', {
      timestamp: new Date().toISOString(),
      currentToken: token.value,
      currentUser: user.value?.id,
      userEmailVerified: user.value?.emailVerified
    })
    
    try {
      setLoading(true)
      
      // Check for existing token in localStorage first
      const storedToken = localStorage.getItem('user-token')
      console.log('[AUTH DEBUG] Checking localStorage for existing token:', {
        storedToken: storedToken,
        currentToken: token.value,
        tokensMatch: storedToken === token.value
      })
      
      if (storedToken) {
        token.value = storedToken
        console.log('[AUTH DEBUG] Updated token from localStorage:', storedToken)
      }
      
      // Get current auth status from backend
      console.log('[AUTH DEBUG] Requesting auth status from backend')
      const statusResponse = await apiService.getAuthStatus()
      
      console.log('[AUTH DEBUG] Raw status response received:', {
        statusResponse: statusResponse,
        hasData: !!statusResponse?.data,
        dataKeys: statusResponse?.data ? Object.keys(statusResponse.data) : 'no_data',
        fullJson: JSON.stringify(statusResponse, null, 2)
      })
      
      if (statusResponse.data) {
        const authStatus = statusResponse.data
        console.log('[AUTH DEBUG] Auth status received:', {
          is_authenticated: authStatus.is_authenticated,
          is_anonymous: authStatus.is_anonymous,
          user_token: authStatus.user_token,
          stored_token: token.value,
          user_exists: !!authStatus.user,
          user_email: authStatus.user?.email
        })
        
        // CRITICAL DEBUG: Log the complete response structure
        console.log('[AUTH DEBUG] Complete auth status response:', {
          fullResponse: authStatus,
          hasUserObject: !!authStatus.user,
          userObjectKeys: authStatus.user ? Object.keys(authStatus.user) : 'no_user_object',
          responseKeys: Object.keys(authStatus),
          jsonString: JSON.stringify(authStatus, null, 2)
        })
        
        // ENHANCED: Check for UUID consistency issues
        if (authStatus.user_token && authStatus.user_token !== token.value) {
          console.log('[AUTH DEBUG] Token mismatch detected:', {
            stored: token.value,
            backend: authStatus.user_token,
            authenticated: authStatus.is_authenticated,
            user_exists: !!authStatus.user
          })
          
          // CRITICAL FIX: Only update token if user is NOT authenticated
          // If user is authenticated, keep the existing token to maintain session
          if (!authStatus.is_authenticated) {
            // Only update token for anonymous users to prevent session loss
            console.log('[AUTH DEBUG] Updating anonymous token from', token.value, 'to', authStatus.user_token)
            setToken(authStatus.user_token)
          } else {
            // For authenticated users, this might indicate a session issue
            console.warn('[AUTH DEBUG] Authenticated user has token mismatch - investigating:', {
              stored: token.value,
              backend: authStatus.user_token,
              authenticated: authStatus.is_authenticated,
              action: 'keeping_existing_token'
            })
            
            // In this case, we should probably use the backend token since it's authenticated
            console.log('[AUTH DEBUG] Forcing token consistency for authenticated user')
            setToken(authStatus.user_token)
          }
        } else {
          console.log('[AUTH DEBUG] Token consistency confirmed:', {
            token: token.value,
            authenticated: authStatus.is_authenticated
          })
        }
        
        // Create user object from auth status
        if (authStatus.user && authStatus.is_authenticated) {
          const userData: User = {
            id: authStatus.user.uuid,
            email: authStatus.user.email,
            emailVerified: true,
            isReviewer: false, // Will be updated from profile
            createdAt: authStatus.user.created_at
          }
          setUser(userData)
          
          // Fetch user profile to get reviewer permissions
          try {
            const profileResponse = await apiService.getUserProfile()
            if (profileResponse.data?.is_reviewer) {
              userData.isReviewer = true
            }
            
            // Extract permissions from profile debug info
            if (profileResponse.data?.debug?.permissions) {
              const permissionObjects = profileResponse.data.debug.permissions as Array<{
                permission: string;
                is_active: boolean;
              }>
              const userPermissions = permissionObjects
                .filter(p => p.is_active)
                .map(p => p.permission as Permission)
              setPermissions(userPermissions)
              
              console.log('[AUTH DEBUG] Permissions extracted from profile:', {
                permissions: userPermissions,
                isReviewer: userPermissions.includes('moderator') || userPermissions.includes('admin'),
                isAdmin: userPermissions.includes('admin')
              })
            }
            
            setUser(userData)
          } catch (profileError) {
            console.warn('[AUTH DEBUG] Failed to fetch user profile:', profileError)
          }
          
          console.log('[AUTH DEBUG] User authenticated successfully:', {
            id: userData.id,
            email: userData.email,
            emailVerified: userData.emailVerified,
            isReviewer: userData.isReviewer
          })
        } else {
          // Anonymous user - still check for permissions
          const userData: User = {
            id: authStatus.user_token,
            email: '',
            emailVerified: false,
            isReviewer: false,
            createdAt: new Date().toISOString()
          }
          
          // Fetch user profile to check for reviewer permissions (even for anonymous users)
          try {
            const profileResponse = await apiService.getUserProfile()
            if (profileResponse.data?.is_reviewer) {
              userData.isReviewer = true
            }
            
            // Extract permissions from profile debug info (even for anonymous users)
            if (profileResponse.data?.debug?.permissions) {
              const permissionObjects = profileResponse.data.debug.permissions as Array<{
                permission: string;
                is_active: boolean;
              }>
              const userPermissions = permissionObjects
                .filter(p => p.is_active)
                .map(p => p.permission as Permission)
              setPermissions(userPermissions)
              
              console.log('[AUTH DEBUG] Anonymous user permissions extracted from profile:', {
                permissions: userPermissions,
                isReviewer: userPermissions.includes('moderator') || userPermissions.includes('admin'),
                isAdmin: userPermissions.includes('admin')
              })
            }
          } catch (profileError) {
            console.warn('[AUTH DEBUG] Failed to fetch user profile for anonymous user:', profileError)
          }
          
          setUser(userData)
          console.log('[AUTH DEBUG] User set as anonymous:', {
            id: userData.id,
            emailVerified: userData.emailVerified,
            isReviewer: userData.isReviewer,
            backend_authenticated: authStatus.is_authenticated
          })
        }
        
        // Final state validation
        console.log('[AUTH DEBUG] Authentication initialization complete:', {
          final_token: token.value,
          final_user_id: user.value?.id,
          final_authenticated: isAuthenticated.value,
          final_anonymous: isAnonymous.value,
          tokens_match: token.value === user.value?.id
        })
      }
    } catch (err) {
      console.error('[AUTH DEBUG] Auth initialization error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        current_token: token.value,
        current_user: user.value?.id
      })
      // If auth check fails, ensure we have an anonymous token
      if (!token.value) {
        console.log('[AUTH DEBUG] No token available, generating anonymous token')
        await generateAnonymousToken()
      }
    } finally {
      setLoading(false)
      console.log('[AUTH DEBUG] Authentication initialization finished:', {
        loading: isLoading.value,
        token: token.value,
        user_id: user.value?.id,
        authenticated: isAuthenticated.value
      })
    }
  }

  // Generate anonymous user token
  async function generateAnonymousToken(): Promise<void> {
    console.log('[AUTH DEBUG] Generating new anonymous token:', {
      timestamp: new Date().toISOString(),
      currentToken: token.value,
      currentUser: user.value?.id
    })
    
    try {
      // Call status endpoint to trigger token generation
      const response = await apiService.generateToken()
      console.log('[AUTH DEBUG] Generate token response:', {
        success: response.success,
        token: response.data?.token
      })
      
      if (response.data?.token) {
        setToken(response.data.token)
        const userData: User = {
          id: response.data.token,
          email: '',
          emailVerified: false,
          isReviewer: false,
          createdAt: new Date().toISOString()
        }
        setUser(userData)
        console.log('[AUTH DEBUG] Anonymous token generated successfully:', {
          token: response.data.token,
          user_id: userData.id
        })
      }
    } catch (err) {
      console.error('[AUTH DEBUG] Failed to generate anonymous token:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error'
      })
      // Fallback to client-generated UUID
      const fallbackToken = crypto.randomUUID()
      setToken(fallbackToken)
      const userData: User = {
        id: fallbackToken,
        email: '',
        emailVerified: false,
        isReviewer: false,
        createdAt: new Date().toISOString()
      }
      setUser(userData)
      console.log('[AUTH DEBUG] Using fallback client-generated token:', {
        token: fallbackToken,
        user_id: userData.id
      })
    }
  }

  // Request magic link for account creation or login
  async function requestMagicLink(email: string): Promise<{ success: boolean; message: string; isSignup?: boolean }> {
    setLoading(true)
    clearError()
    
    try {
      const request: MagicLinkRequest = { email }
      const response = await apiService.requestMagicLink(request)
      
      if (response.data) {
        return {
          success: true,
          message: response.data.message,
          isSignup: response.data.is_signup
        }
      }
      
      return { success: false, message: 'Failed to send magic link' }
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }

  // Verify and consume magic link token
  async function verifyMagicLink(magicToken: string): Promise<{ success: boolean; message: string; isNewAccount?: boolean }> {
    console.log('[AUTH DEBUG] Starting magic link verification:', {
      token: magicToken?.substring(0, 8) + '...',
      currentToken: token.value,
      currentUser: user.value?.id,
      timestamp: new Date().toISOString()
    })
    
    setLoading(true)
    clearError()

    try {
      const request: MagicLinkConsumeRequest = { token: magicToken }
      console.log('[AUTH DEBUG] Sending magic link verification request')
      
      const response = await apiService.verifyMagicLink(request)
      console.log('[AUTH DEBUG] Magic link verification response:', {
        success: response.success,
        userUuid: response.data?.user?.uuid,
        email: response.data?.user?.email,
        isNewAccount: response.data?.is_new_account,
        uuidReplaced: response.data?.uuid_replaced
      })
      
      if (response.success && response.data) {
        const authenticatedUUID = response.data.user.uuid
        console.log('[AUTH DEBUG] Magic link verification successful, processing authentication:', {
          previousToken: token.value,
          newToken: authenticatedUUID,
          email: response.data.user.email,
          isNewAccount: response.data.is_new_account
        })
        
        // CRITICAL: Ensure UUID consistency across all storage
        if (authenticatedUUID) {
          console.log('[AUTH DEBUG] Updating token to authenticated UUID:', authenticatedUUID)
          setToken(authenticatedUUID)
        }
        
        // Update user state with verified user
        const userData: User = {
          id: response.data.user.uuid,
          email: response.data.user.email,
          emailVerified: true,
          isReviewer: false, // Will be determined by permissions
          createdAt: response.data.user.created_at
        }
        setUser(userData)
        console.log('[AUTH DEBUG] User data updated:', {
          id: userData.id,
          email: userData.email,
          emailVerified: userData.emailVerified
        })
        
        // SKIP initializeAuth() here to prevent race condition
        // Instead, manually update the authentication state
        console.log('[AUTH DEBUG] Manually updating authentication state after successful verification')
        
        // REMOVE the forced page refresh - it causes the magic link to be processed twice
        // Instead, let the component handle the success state and redirect
        console.log('[AUTH DEBUG] Magic link verification complete, letting component handle redirect')
        
        return {
          success: true,
          message: response.data.message || 'Login successful',
          isNewAccount: response.data.is_new_account
        }
      }
      
      console.log('[AUTH DEBUG] Magic link verification failed:', response.message || 'Unknown error')
      return { success: false, message: response.message || 'Failed to verify magic link' }
    } catch (err) {
      const message = getErrorMessage(err)
      console.error('[AUTH DEBUG] Magic link verification error:', {
        error: message,
        token: magicToken?.substring(0, 8) + '...',
        currentState: {
          token: token.value,
          user: user.value?.id,
          isAuthenticated: isAuthenticated.value
        }
      })
      setError(message)
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }

  // Logout and get new anonymous token
  async function logout(): Promise<void> {
    console.log('[AUTH DEBUG] Starting logout process:', {
      currentToken: token.value,
      currentUser: user.value?.id,
      isAuthenticated: isAuthenticated.value,
      timestamp: new Date().toISOString()
    })
    
    setLoading(true)
    clearError()
    
    try {
      console.log('[AUTH DEBUG] Calling backend logout endpoint')
      const response = await apiService.logout()
      console.log('[AUTH DEBUG] Logout response:', {
        success: response.data?.success,
        newToken: response.data?.new_user_token
      })
      
      if (response.data?.success) {
        // Clear current auth state
        console.log('[AUTH DEBUG] Clearing authentication state')
        clearAuth()
        
        // Set new anonymous token
        if (response.data.new_user_token) {
          console.log('[AUTH DEBUG] Setting new anonymous token from logout response:', response.data.new_user_token)
          setToken(response.data.new_user_token)
          const userData: User = {
            id: response.data.new_user_token,
            email: '',
            emailVerified: false,
            isReviewer: false,
            createdAt: new Date().toISOString()
          }
          setUser(userData)
          console.log('[AUTH DEBUG] New anonymous user data set:', {
            id: userData.id,
            emailVerified: userData.emailVerified
          })
        }
      }
    } catch (err) {
      console.error('[AUTH DEBUG] Logout error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error'
      })
      // Fallback: clear auth and generate new anonymous token
      console.log('[AUTH DEBUG] Using fallback logout process')
      clearAuth()
      await generateAnonymousToken()
    } finally {
      setLoading(false)
      console.log('[AUTH DEBUG] Logout process completed:', {
        newToken: token.value,
        newUser: user.value?.id,
        isAuthenticated: isAuthenticated.value
      })
    }
  }

  // Get current user token (for API requests)
  function getUserToken(): string {
    return token.value || ''
  }

  // Ensure user has a token (for anonymous submissions)
  async function ensureUserToken(): Promise<string> {
    if (token.value) {
      return token.value
    }
    
    await generateAnonymousToken()
    return token.value || ''
  }

  // Refresh auth status from backend
  async function refreshAuthStatus(): Promise<void> {
    try {
      const statusResponse = await apiService.getAuthStatus()
      if (statusResponse.data) {
        const authStatus = statusResponse.data
        
        if (authStatus.user && authStatus.is_authenticated) {
          const userData: User = {
            id: authStatus.user.uuid,
            email: authStatus.user.email,
            emailVerified: true,
            isReviewer: false, // Will be determined by permissions
            createdAt: authStatus.user.created_at
          }
          setUser(userData)
          
          // TODO: Refresh permissions as well
        }
      }
    } catch (err) {
      console.error('Failed to refresh auth status:', err)
    }
  }

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
    isReviewer,
    isAdmin,
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
    generateAnonymousToken,
    requestMagicLink,
    verifyMagicLink,
    logout,
    getUserToken,
    ensureUserToken,
    refreshAuthStatus
  }
})