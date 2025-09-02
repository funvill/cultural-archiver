/**
 * Authentication composable for managing user state and auth flows
 */

import { computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { apiService, getErrorMessage } from '../services/api'
import type { MagicLinkRequest, MagicLinkConsumeRequest, User } from '../types'

export function useAuth() { // eslint-disable-line @typescript-eslint/explicit-function-return-type
  const authStore = useAuthStore()

  // Reactive auth state
  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const isReviewer = computed(() => authStore.isReviewer)
  const isEmailVerified = computed(() => authStore.isEmailVerified)
  const user = computed(() => authStore.user)
  const token = computed(() => authStore.token)
  const isLoading = computed(() => authStore.isLoading)
  const error = computed(() => authStore.error)

  /**
   * Initialize authentication on app startup
   */
  const initAuth = async (): Promise<void> => {
    try {
      authStore.setLoading(true)
      
      // Check for existing token in localStorage
      const savedToken = localStorage.getItem('user-token')
      if (savedToken) {
        authStore.setToken(savedToken)
        
        // Verify token and get user profile
        const profile = await apiService.getUserProfile()
        if (profile.data) {
          const userData: User = {
            id: profile.data.user_token,
            email: profile.data.email || '',
            emailVerified: profile.data.email_verified,
            isReviewer: false, // TODO: Add reviewer field to backend
            createdAt: profile.data.created_at
          }
          authStore.setUser(userData)
        }
      } else {
        // Generate anonymous token
        await generateAnonymousToken()
      }
    } catch (error) {
      console.error('Auth initialization failed:', error)
      // Fall back to anonymous token
      await generateAnonymousToken()
    } finally {
      authStore.setLoading(false)
    }
  }

  /**
   * Generate and set anonymous user token
   */
  const generateAnonymousToken = async (): Promise<void> => {
    try {
      const response = await apiService.generateToken()
      if (response.data) {
        authStore.setToken(response.data.token)
        authStore.setUser({
          id: response.data.token,
          email: '',
          emailVerified: false,
          isReviewer: false,
          createdAt: new Date().toISOString()
        })
      }
    } catch (error) {
      authStore.setError(getErrorMessage(error))
      throw error
    }
  }

  /**
   * Request magic link for email verification
   */
  const requestMagicLink = async (email: string): Promise<boolean> => {
    try {
      authStore.setLoading(true)
      authStore.clearError()

      const request: MagicLinkRequest = { email }
      await apiService.requestMagicLink(request)
      
      return true
    } catch (error) {
      authStore.setError(getErrorMessage(error))
      return false
    } finally {
      authStore.setLoading(false)
    }
  }

  /**
   * Consume magic link token from email
   */
  const consumeMagicLink = async (magicToken: string): Promise<boolean> => {
    try {
      authStore.setLoading(true)
      authStore.clearError()

      const request: MagicLinkConsumeRequest = { token: magicToken }
      const response = await apiService.consumeMagicLink(request)
      
      // Update auth state with verified user
      if (response.data && response.data.user_token) {
        authStore.setToken(response.data.user_token)
        if (authStore.user) {
          authStore.setUser({
            ...authStore.user,
            email: authStore.user.email || 'verified@email.com', // Keep existing email or placeholder
            emailVerified: true
          })
        }
      }
      
      return true
    } catch (error) {
      authStore.setError(getErrorMessage(error))
      return false
    } finally {
      authStore.setLoading(false)
    }
  }

  /**
   * Check verification status
   */
  const checkVerificationStatus = async (): Promise<boolean> => {
    try {
      const response = await apiService.getVerificationStatus()
      
      if (authStore.user && response.data) {
        authStore.setUser({
          ...authStore.user,
          emailVerified: response.data.email_verified,
          email: response.data.email || authStore.user.email || ''
        })
      }
      
      return response.data?.email_verified || false
    } catch (error) {
      console.error('Failed to check verification status:', error)
      return false
    }
  }

  /**
   * Sign out and clear authentication
   */
  const signOut = (): void => {
    authStore.clearAuth()
    // Generate new anonymous token
    generateAnonymousToken()
  }

  /**
   * Refresh user profile data
   */
  const refreshProfile = async (): Promise<void> => {
    try {
      const profile = await apiService.getUserProfile()
      if (profile.data) {
        const userData: User = {
          id: profile.data.user_token,
          email: profile.data.email || '',
          emailVerified: profile.data.email_verified,
          isReviewer: false, // TODO: Add reviewer field to backend
          createdAt: profile.data.created_at
        }
        authStore.setUser(userData)
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error)
    }
  }

  // Watch for token changes and persist to localStorage
  watch(token, (newToken) => {
    if (newToken) {
      localStorage.setItem('user-token', newToken)
    } else {
      localStorage.removeItem('user-token')
    }
  })

  return {
    // State
    isAuthenticated,
    isReviewer,
    isEmailVerified,
    user,
    token,
    isLoading,
    error,

    // Actions
    initAuth,
    generateAnonymousToken,
    requestMagicLink,
    consumeMagicLink,
    checkVerificationStatus,
    signOut,
    refreshProfile,

    // Utilities
    clearError: authStore.clearError
  }
}
