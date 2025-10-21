<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { SignIn, SignUp } from '@clerk/vue';

interface Props {
  isOpen: boolean;
  mode?: 'login' | 'signup';
}

const props = defineProps<Props>();

const emit = defineEmits(['close', 'success']);

// State
const currentMode = ref<'sign-in' | 'sign-up'>('sign-in');

// Computed
const modalTitle = computed(() => {
  return currentMode.value === 'sign-in' ? 'Sign In' : 'Sign Up';
});

// Watch for prop changes
watch(
  () => props.mode,
  (newMode: string | undefined) => {
    currentMode.value = newMode === 'signup' ? 'sign-up' : 'sign-in';
  },
  { immediate: true }
);

watch(
  () => props.isOpen,
  (isOpen: boolean) => {
    if (isOpen) {
      currentMode.value = props.mode === 'signup' ? 'sign-up' : 'sign-in';
    }
  }
);

// Methods
function handleClose(): void {
  emit('close');
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    handleClose();
  }
}

// Handle successful authentication (these will be used when we add Clerk event handlers)
// function handleSignInSuccess(): void {
//   emit('success', { isNewAccount: false });
//   handleClose();
// }

// function handleSignUpSuccess(): void {
//   emit('success', { isNewAccount: true });
//   handleClose();
// }
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
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          ref="modalDialog"
          class="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all"
        >
          <!-- Close button -->
          <div class="absolute right-0 top-0 pr-4 pt-4 z-10">
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
          <div class="relative p-6">
            <!-- Title (hidden since Clerk has its own) -->
            <h3 id="auth-modal-title" class="sr-only">
              {{ modalTitle }}
            </h3>

            <!-- Clerk Authentication Component -->
            <div class="clerk-auth-container">
              <SignIn
                v-if="currentMode === 'sign-in'"
                :appearance="{
                  elements: {
                    formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-sm',
                    card: 'shadow-none border-none',
                    headerTitle: 'hidden',
                    headerSubtitle: 'text-sm text-gray-600 mb-4',
                    socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50',
                    formFieldLabel: 'text-sm font-medium text-gray-700',
                    formFieldInput: 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    footerActionLink: 'text-blue-600 hover:text-blue-800'
                  }
                }"
              />
              
              <SignUp
                v-else
                :appearance="{
                  elements: {
                    formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-sm',
                    card: 'shadow-none border-none',
                    headerTitle: 'hidden',
                    headerSubtitle: 'text-sm text-gray-600 mb-4',
                    socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50',
                    formFieldLabel: 'text-sm font-medium text-gray-700',
                    formFieldInput: 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    footerActionLink: 'text-blue-600 hover:text-blue-800'
                  }
                }"
              />
            </div>

            <!-- Anonymous note -->
            <div class="bg-blue-50 rounded-md p-3 mt-4">
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
  </Teleport>
</template>

<style scoped>
/* Additional styles for modal animations */
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