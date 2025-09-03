import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { 
  User, 
  MagicLinkRequest, 
  MagicLinkConsumeRequest,
  AuthStatusResponse,
  VerifyMagicLinkResponse,
  LogoutResponse
} from '../types'
import { apiService, getErrorMessage, isUnauthorized } from '../services/api'

/**
 * Authentication store for managing user state and tokens
 * Updated to work with the new UUID-based authentication system
 */
export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed getters
  const isAuthenticated = computed(() => !!user.value && user.value.emailVerified)
  const isAnonymous = computed(() => !!token.value && !isAuthenticated.value)
  const isReviewer = computed(() => user.value?.isReviewer ?? false)
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

  function clearAuth(): void {
    user.value = null
    token.value = null
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
    try {
      setLoading(true)
      
      // Check for existing token in localStorage first
      const storedToken = localStorage.getItem('user-token')
      if (storedToken) {
        token.value = storedToken
      }
      
      // Get current auth status from backend
      const statusResponse = await apiService.getAuthStatus()
      if (statusResponse.data) {
        const authStatus = statusResponse.data
        
        // Update token if backend provided a different one
        if (authStatus.user_token && authStatus.user_token !== token.value) {
          setToken(authStatus.user_token)
        }
        
        // Create user object from auth status
        if (authStatus.user && authStatus.is_authenticated) {
          const userData: User = {
            id: authStatus.user.uuid,
            email: authStatus.user.email,
            emailVerified: true,
            isReviewer: false, // TODO: Add reviewer field to backend
            createdAt: authStatus.user.created_at
          }
          setUser(userData)
        } else {
          // Anonymous user
          const userData: User = {
            id: authStatus.user_token,
            email: '',
            emailVerified: false,
            isReviewer: false,
            createdAt: new Date().toISOString()
          }
          setUser(userData)
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err)
      // If auth check fails, ensure we have an anonymous token
      if (!token.value) {
        await generateAnonymousToken()
      }
    } finally {
      setLoading(false)
    }
  }

  // Generate anonymous user token
  async function generateAnonymousToken(): Promise<void> {
    try {
      // Call status endpoint to trigger token generation
      const response = await apiService.generateToken()
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
      }
    } catch (err) {
      console.error('Failed to generate anonymous token:', err)
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
    setLoading(true)
    clearError()

    try {
      const request: MagicLinkConsumeRequest = { token: magicToken }
      const response = await apiService.verifyMagicLink(request)
      
      if (response.data?.success) {
        const verifyResponse = response.data
        
        // Update token if it was replaced (cross-device login)
        if (verifyResponse.user.uuid) {
          setToken(verifyResponse.user.uuid)
        }
        
        // Update user state with verified user
        const userData: User = {
          id: verifyResponse.user.uuid,
          email: verifyResponse.user.email,
          emailVerified: true,
          isReviewer: false, // TODO: Add reviewer field to backend
          createdAt: verifyResponse.user.created_at
        }
        setUser(userData)
        
        return {
          success: true,
          message: verifyResponse.message,
          isNewAccount: verifyResponse.is_new_account
        }
      }
      
      return { success: false, message: 'Failed to verify magic link' }
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }

  // Logout and get new anonymous token
  async function logout(): Promise<void> {
    setLoading(true)
    clearError()
    
    try {
      const response = await apiService.logout()
      
      if (response.data?.success) {
        // Clear current auth state
        clearAuth()
        
        // Set new anonymous token
        if (response.data.new_user_token) {
          setToken(response.data.new_user_token)
          const userData: User = {
            id: response.data.new_user_token,
            email: '',
            emailVerified: false,
            isReviewer: false,
            createdAt: new Date().toISOString()
          }
          setUser(userData)
        }
      }
    } catch (err) {
      console.error('Logout error:', err)
      // Fallback: clear auth and generate new anonymous token
      clearAuth()
      await generateAnonymousToken()
    } finally {
      setLoading(false)
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
            isReviewer: false,
            createdAt: authStatus.user.created_at
          }
          setUser(userData)
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
    isLoading,
    error,
    
    // Computed
    isAuthenticated,
    isAnonymous,
    isReviewer,
    isEmailVerified,
    
    // Actions
    setUser,
    setToken,
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