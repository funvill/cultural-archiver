/**
 * Feedback Store
 * Handles user feedback submissions to moderators
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CreateFeedbackRequest, CreateFeedbackResponse } from '../../../shared/types';
import { useAuthStore } from './auth';

export const useFeedbackStore = defineStore('feedback', () => {
  // State
  const submitting = ref(false);
  const lastError = ref<string | null>(null);

  // Actions
  async function submitFeedback(request: CreateFeedbackRequest): Promise<CreateFeedbackResponse> {
    submitting.value = true;
    lastError.value = null;

    try {
      const authStore = useAuthStore();
      
      // Ensure user has a token (generates anonymous token if needed)
      const userToken = await authStore.ensureUserToken();
      
      // Add user token to request
      const body: CreateFeedbackRequest = {
        ...request,
        user_token: userToken,
      };

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send feedback' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CreateFeedbackResponse = await response.json();
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send feedback';
      lastError.value = errorMessage;
      throw error;
    } finally {
      submitting.value = false;
    }
  }

  return {
    // State
    submitting,
    lastError,
    
    // Actions
    submitFeedback,
  };
});
