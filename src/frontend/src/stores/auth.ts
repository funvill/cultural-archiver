import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User, MagicLinkRequest, MagicLinkConsumeRequest } from '../types'
import { apiService, getErrorMessage, isUnauthorized } from '../services/api'

/**
 * Authentication store for managing user state and tokens
 */
export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed getters
  const isAuthenticated = computed(() => !!token.value)
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

  // Initialize auth from localStorage on store creation
  function initializeAuth(): void {
    const storedToken = localStorage.getItem('user-token')
    if (storedToken) {
      token.value = storedToken
      // Load user verification status
      loadUserProfile()
    }
  }

  // Load user profile and verification status
  async function loadUserProfile(): Promise<void> {
    try {
      const response = await apiService.getVerificationStatus()
      if (response.data) {
        // Create user object from verification status
        const userData: User = {
          id: token.value || 'anonymous',
          email: response.data.email || '',
          emailVerified: response.data.email_verified,
          isReviewer: false, // TODO: Get from user profile endpoint
          createdAt: new Date().toISOString()
        }
        
        setUser(userData)
      }
    } catch (err) {
      if (isUnauthorized(err)) {
        clearAuth()
      }
    }
  }

  // Login flow
  async function login(email: string): Promise<void> {
    setLoading(true)
    clearError()
    
    try {
      const request: MagicLinkRequest = { email }
      await apiService.requestMagicLink(request)
      
      // Magic link sent successfully
      // User will receive email and click link to complete login
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Verify email and complete login
  async function verifyEmail(verificationToken: string): Promise<void> {
    setLoading(true)
    clearError()

    try {
      const request: MagicLinkConsumeRequest = { token: verificationToken }
      const response = await apiService.consumeMagicLink(request)
      
      if (response.success) {
        // Token is automatically updated by the API service
        // Load user profile
        await loadUserProfile()
      }
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Logout
  function logout(): void {
    clearAuth()
  }

  // Resend verification email
  async function resendVerificationEmail(email: string): Promise<void> {
    setLoading(true)
    clearError()

    try {
      const request: MagicLinkRequest = { email }
      await apiService.resendVerificationEmail(request)
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Remove email verification
  async function removeEmailVerification(): Promise<void> {
    setLoading(true)
    clearError()

    try {
      await apiService.removeEmailVerification()
      // Update user state
      if (user.value) {
        const userData: User = {
          ...user.value,
          email: '',
          emailVerified: false
        }
        setUser(userData)
      }
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Generate or get user token (for anonymous submissions)
  function ensureUserToken(): string {
    if (token.value) {
      return token.value
    }

    // Generate new anonymous token
    const newToken = crypto.randomUUID()
    setToken(newToken)
    return newToken
  }

  // Initialize store
  initializeAuth()

  return {
    // State
    user,
    token,
    isLoading,
    error,
    
    // Computed
    isAuthenticated,
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
    loadUserProfile,
    login,
    verifyEmail,
    logout,
    resendVerificationEmail,
    removeEmailVerification,
    ensureUserToken
  }
})