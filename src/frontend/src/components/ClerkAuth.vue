<script lang="ts">
import { defineComponent, ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';

export default defineComponent({
  name: 'ClerkAuth',
  props: {
    isOpen: {
      type: Boolean,
      required: true,
    },
    mode: {
      type: String as () => 'login' | 'signup',
      default: 'login',
    },
  },
  emits: ['close', 'success'],
  setup(props, { emit }) {
    // State
    const currentMode = ref<'login' | 'signup'>(props.mode);
    const email = ref('');
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const authStore = useAuthStore();

    // Computed
    const modalTitle = computed(() => {
      return currentMode.value === 'signup' ? 'Create Account' : 'Sign In';
    });

    // Methods
    function handleClose(): void {
      emit('close');
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        handleClose();
      }
    }

    function switchMode(): void {
      currentMode.value = currentMode.value === 'login' ? 'signup' : 'login';
    }

    // Use the original magic link authentication system
    async function redirectToClerkAuth(): Promise<void> {
      if (!email.value) {
        error.value = 'Please enter your email address';
        return;
      }

      try {
        isLoading.value = true;
        error.value = null;
        
        const result = await authStore.requestMagicLink(email.value);
        if (result.success) {
          console.log('Magic link sent successfully');
          emit('success');
          handleClose();
        } else {
          error.value = result.message;
        }
      } catch (err) {
        console.error('Failed to request magic link:', err);
        error.value = 'Failed to send authentication email. Please try again.';
      } finally {
        isLoading.value = false;
      }
    }

    return {
      currentMode,
      modalTitle,
      email,
      isLoading,
      error,
      handleClose,
      handleKeydown,
      switchMode,
      redirectToClerkAuth,
    };
  },
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="auth-modal-title"
      role="dialog"
      aria-modal="true"
      @keydown="handleKeydown"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        @click="handleClose"
      ></div>

      <!-- Modal -->
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div
          class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6"
        >
          <!-- Close button -->
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              @click="handleClose"
            >
              <span class="sr-only">Close</span>
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal content -->
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <!-- Title -->
              <h3 id="auth-modal-title" class="text-xl font-semibold leading-6 text-gray-900 mb-6">
                {{ modalTitle }}
              </h3>

              <!-- Clerk Sign In/Up Component -->
              <div class="space-y-6">
                <!-- Description -->
                <p class="text-sm text-gray-600">
                  {{ currentMode === 'signup' 
                    ? 'Create an account to submit artwork and sync across devices.' 
                    : 'Sign in to access your submissions and sync across devices.' 
                  }}
                </p>

                <!-- Magic Link Authentication -->
                <div class="auth-container">
                  <div class="mb-6">
                    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-4">
                      <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p class="text-sm text-gray-600 mb-4">
                      Enter your email address and we'll send you a secure login link.
                    </p>
                    
                    <!-- Error Message -->
                    <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p class="text-sm text-red-800">{{ error }}</p>
                    </div>
                    
                    <!-- Email Input -->
                    <div class="mb-4">
                      <label for="email" class="sr-only">Email address</label>
                      <input
                        id="email"
                        v-model="email"
                        type="email"
                        placeholder="Enter your email address"
                        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        :disabled="isLoading"
                        @keydown.enter="redirectToClerkAuth"
                      />
                    </div>
                    
                    <button
                      type="button"
                      class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="isLoading || !email"
                      @click="redirectToClerkAuth"
                    >
                      <span v-if="isLoading">Sending...</span>
                      <span v-else>{{ currentMode === 'login' ? 'Send Login Link' : 'Send Sign Up Link' }}</span>
                    </button>
                  </div>
                </div>                <!-- Mode switcher -->
                <div class="text-center">
                  <button
                    type="button"
                    class="text-sm text-blue-600 hover:text-blue-800 underline"
                    @click="switchMode"
                  >
                    {{ currentMode === 'login' 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in" 
                    }}
                  </button>
                </div>

                <!-- Anonymous note -->
                <div class="bg-blue-50 rounded-md p-3">
                  <p class="text-xs text-blue-800">
                    <strong>Anonymous usage:</strong> You can submit artwork without an account.
                    Creating an account lets you claim your anonymous submissions and sync across
                    devices.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Override Clerk's default styles to match our design */
:deep(.cl-rootBox) {
  width: 100%;
}

:deep(.cl-card) {
  box-shadow: none;
  border: none;
  background: transparent;
}

:deep(.cl-headerTitle),
:deep(.cl-headerSubtitle) {
  display: none;
}

:deep(.cl-socialButtonsBlockButton) {
  width: 100%;
}

:deep(.cl-formButtonPrimary) {
  width: 100%;
  background-color: #2563eb;
}

:deep(.cl-formButtonPrimary:hover) {
  background-color: #1d4ed8;
}

:deep(.cl-footerActionLink) {
  color: #2563eb;
}

:deep(.cl-footerActionLink:hover) {
  color: #1e40af;
}

/* Modal animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>