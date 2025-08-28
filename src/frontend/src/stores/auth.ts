import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '../types'

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
  function setUser(userData: User) {
    user.value = userData
    error.value = null
  }

  function setToken(tokenValue: string) {
    token.value = tokenValue
    // Store token in localStorage for persistence
    localStorage.setItem('user-token', tokenValue)
  }

  function clearAuth() {
    user.value = null
    token.value = null
    localStorage.removeItem('user-token')
    error.value = null
  }

  function setError(message: string) {
    error.value = message
  }

  function clearError() {
    error.value = null
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  // Initialize auth from localStorage on store creation
  function initializeAuth() {
    const storedToken = localStorage.getItem('user-token')
    if (storedToken) {
      token.value = storedToken
      // TODO: Validate token with backend and load user data
    }
  }

  // Login flow
  async function login(email: string): Promise<void> {
    isLoading.value = true
    error.value = null
    
    try {
      // TODO: Implement actual API call to request magic link
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send magic link')
      }

      // Magic link sent successfully
      // User will receive email and click link to complete login
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Verify email and complete login
  async function verifyEmail(verificationToken: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // TODO: Implement actual API call to verify token
      const response = await fetch('/api/auth/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Email verification failed')
      }

      const { user: userData, token: userToken } = await response.json()
      
      setUser(userData)
      setToken(userToken)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email verification failed'
      setError(message)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Logout
  function logout(): void {
    clearAuth()
  }

  // Generate or get user token (for anonymous submissions)
  function ensureUserToken(): string {
    if (token.value) {
      return token.value
    }

    // Generate anonymous user token
    const anonymousToken = generateAnonymousToken()
    setToken(anonymousToken)
    return anonymousToken
  }

  // Generate anonymous user token (UUID v4)
  function generateAnonymousToken(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c == 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  // Load user data from token
  async function loadUserData(): Promise<void> {
    if (!token.value) return

    isLoading.value = true
    error.value = null

    try {
      // TODO: Implement actual API call to get user data
      const response = await fetch('/api/me', {
        headers: {
          'X-User-Token': token.value,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, clear auth
          clearAuth()
          return
        }
        throw new Error('Failed to load user data')
      }

      const userData = await response.json()
      setUser(userData)
    } catch (err) {
      console.error('Error loading user data:', err)
      // Don't clear auth on network errors, only on 401
    } finally {
      isLoading.value = false
    }
  }

  // Initialize auth when store is created
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
    login,
    verifyEmail,
    logout,
    ensureUserToken,
    loadUserData,
  }
})