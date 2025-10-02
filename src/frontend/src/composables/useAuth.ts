/**
 * Authentication composable for managing user state and auth flows
 * Updated to work with the new UUID-based authentication system
 */


import { computed, watch } from 'vue';
import type { ComputedRef, WritableComputedRef } from 'vue';
import { useAuthStore } from '../stores/auth';
import type { User } from '../types';

export interface UseAuthReturn {

  isAuthenticated: ComputedRef<boolean> | WritableComputedRef<boolean>;
  isAnonymous: ComputedRef<boolean> | WritableComputedRef<boolean>;
  isModerator: ComputedRef<boolean> | WritableComputedRef<boolean>;
  canReview: ComputedRef<boolean> | WritableComputedRef<boolean>;
  isEmailVerified: ComputedRef<boolean> | WritableComputedRef<boolean>;
  user: ComputedRef<User | null> | WritableComputedRef<User | null>;
  token: ComputedRef<string | null> | WritableComputedRef<string | null>;
  isLoading: ComputedRef<boolean> | WritableComputedRef<boolean>;
  error: ComputedRef<string | null> | WritableComputedRef<string | null>;
  canPerformAuthenticatedActions: ComputedRef<boolean> | WritableComputedRef<boolean>;
  userDisplayName: ComputedRef<string> | WritableComputedRef<string>;
  initAuth: () => Promise<void>;
  requestMagicLink: (email: string) => Promise<{ success: boolean; message: string; isSignup?: boolean }>;
  verifyMagicLink: (magicToken: string) => Promise<{ success: boolean; message: string; isNewAccount?: boolean }>;
  signOut: () => Promise<void>;
  getUserToken: () => string;
  ensureUserToken: () => Promise<string>;
  refreshAuthStatus: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const authStore = useAuthStore();

  // Reactive auth state
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const isAnonymous = computed(() => authStore.isAnonymous);
  const isModerator = computed(() => authStore.isModerator);
  const canReview = computed(() => authStore.canReview);
  const isEmailVerified = computed(() => authStore.isEmailVerified);
  const user = computed(() => authStore.user);
  const token = computed(() => authStore.token);
  const isLoading = computed(() => authStore.isLoading);
  const error = computed(() => authStore.error);

  /**
   * Initialize authentication on app startup
   */
  const initAuth = async (): Promise<void> => {
    await authStore.initializeAuth();
  };

  /**
   * Request magic link for account creation or login
   */
  const requestMagicLink = async (
    email: string
  ): Promise<{ success: boolean; message: string; isSignup?: boolean }> => {
    return authStore.requestMagicLink(email);
  };

  /**
   * Verify and consume magic link token
   */
  const verifyMagicLink = async (
    magicToken: string
  ): Promise<{ success: boolean; message: string; isNewAccount?: boolean }> => {
    return authStore.verifyMagicLink(magicToken);
  };

  /**
   * Sign out and get new anonymous token
   */
  const signOut = async (): Promise<void> => {
    await authStore.logout();
  };

  /**
   * Get current user token for API requests
   */
  const getUserToken = (): string => {
    return authStore.getUserToken();
  };

  /**
   * Ensure user has a token (generates one if needed)
   */
  const ensureUserToken = async (): Promise<string> => {
    return authStore.ensureUserToken();
  };

  /**
   * Refresh authentication status from backend
   */
  const refreshAuthStatus = async (): Promise<void> => {
    await authStore.refreshAuthStatus();
  };

  /**
   * Check if user can perform authenticated actions
   */
  const canPerformAuthenticatedActions = computed(() => {
    return isAuthenticated.value || isAnonymous.value;
  });

  /**
   * Get user display name
   */
  const userDisplayName = computed(() => {
    if (!user.value) return 'Anonymous';
    if (user.value.emailVerified && user.value.email) {
      return user.value.email;
    }
    return `Anonymous (${user.value.id.slice(0, 8)}...)`;
  });

  // Watch for token changes and persist to localStorage
  watch(token, newToken => {
    if (newToken) {
      localStorage.setItem('user-token', newToken);
    } else {
      localStorage.removeItem('user-token');
    }
  });

  return {
    // State
    isAuthenticated,
    isAnonymous,
    isModerator,
    canReview,
    isEmailVerified,
    user,
    token,
    isLoading,
    error,

    // Computed
    canPerformAuthenticatedActions,
    userDisplayName,

    // Actions
    initAuth,
    requestMagicLink,
    verifyMagicLink,
    signOut,
    getUserToken,
    ensureUserToken,
    refreshAuthStatus,

    // Utilities
    clearError: authStore.clearError,
  };
}
