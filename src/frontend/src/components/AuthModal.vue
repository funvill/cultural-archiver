<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useModal } from '../composables/useModal'

interface Props {
  isOpen: boolean
  mode?: 'login' | 'signup'
}

interface Emits {
  (e: 'close'): void
  (e: 'success', payload: { isNewAccount: boolean; email: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'login'
})

const emit = defineEmits<Emits>()

// Composables
const { requestMagicLink, isLoading, error, clearError } = useAuth()
const { trapFocus } = useModal()

// State
const email = ref('')
const currentStep = ref<'email' | 'sent' | 'verifying'>('email')
const emailError = ref<string | null>(null)
const isSignup = ref(false)

// Computed
const modalTitle = computed(() => {
  switch (currentStep.value) {
    case 'email':
      return isSignup.value ? 'Create Account' : 'Sign In'
    case 'sent':
      return 'Check Your Email'
    case 'verifying':
      return 'Verifying...'
    default:
      return 'Authentication'
  }
})

const buttonText = computed(() => {
  if (isLoading.value) return 'Sending...'
  return isSignup.value ? 'Create Account' : 'Send Magic Link'
})

// Watch for prop changes
watch(() => props.mode, (newMode) => {
  isSignup.value = newMode === 'signup'
})

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    currentStep.value = 'email'
    email.value = ''
    emailError.value = null
    clearError()
    isSignup.value = props.mode === 'signup'
  }
})

// Methods
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

async function handleSubmit(): Promise<void> {
  clearError()
  emailError.value = null

  // Validate email
  if (!email.value.trim()) {
    emailError.value = 'Email address is required'
    return
  }

  if (!validateEmail(email.value.trim())) {
    emailError.value = 'Please enter a valid email address'
    return
  }

  try {
    const result = await requestMagicLink(email.value.trim())
    
    if (result.success) {
      currentStep.value = 'sent'
      isSignup.value = result.isSignup || false
    } else {
      emailError.value = result.message
    }
  } catch (err) {
    emailError.value = 'Failed to send magic link. Please try again.'
  }
}

function handleClose(): void {
  emit('close')
}

function switchMode(): void {
  isSignup.value = !isSignup.value
  clearError()
  emailError.value = null
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    handleClose()
  }
}
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
          ref="trapFocus"
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
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
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

              <!-- Email step -->
              <div v-if="currentStep === 'email'" class="space-y-6">
                <!-- Description -->
                <p class="text-sm text-gray-600">
                  <template v-if="isSignup">
                    Create an account to claim your anonymous submissions and sync across devices.
                  </template>
                  <template v-else>
                    Sign in to access your account and submissions across devices.
                  </template>
                </p>

                <!-- Form -->
                <form @submit.prevent="handleSubmit" class="space-y-4">
                  <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                      Email address
                    </label>
                    <input
                      id="email"
                      v-model="email"
                      type="email"
                      autocomplete="email"
                      required
                      class="block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500': emailError }"
                      placeholder="Enter your email address"
                      :disabled="isLoading"
                    />
                    <p v-if="emailError" class="mt-1 text-sm text-red-600">
                      {{ emailError }}
                    </p>
                    <p v-if="error" class="mt-1 text-sm text-red-600">
                      {{ error }}
                    </p>
                  </div>

                  <button
                    type="submit"
                    class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isLoading"
                  >
                    {{ buttonText }}
                  </button>
                </form>

                <!-- Mode switch -->
                <div class="text-center">
                  <button
                    type="button"
                    class="text-sm text-blue-600 hover:text-blue-800 underline"
                    @click="switchMode"
                  >
                    <template v-if="isSignup">
                      Already have an account? Sign in
                    </template>
                    <template v-else>
                      Don't have an account? Create one
                    </template>
                  </button>
                </div>

                <!-- Anonymous note -->
                <div class="bg-blue-50 rounded-md p-3">
                  <p class="text-xs text-blue-800">
                    <strong>Anonymous usage:</strong> You can submit artwork without an account. 
                    Creating an account lets you claim your anonymous submissions and sync across devices.
                  </p>
                </div>
              </div>

              <!-- Email sent step -->
              <div v-else-if="currentStep === 'sent'" class="text-center space-y-4">
                <!-- Success icon -->
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>

                <div>
                  <h4 class="text-lg font-medium text-gray-900 mb-2">
                    Magic link sent!
                  </h4>
                  <p class="text-sm text-gray-600 mb-4">
                    We've sent a {{ isSignup ? 'verification' : 'login' }} link to:
                  </p>
                  <p class="text-sm font-medium text-gray-900 mb-4">
                    {{ email }}
                  </p>
                  <p class="text-xs text-gray-500">
                    Click the link in your email to {{ isSignup ? 'create your account' : 'sign in' }}. 
                    The link will expire in 1 hour.
                  </p>
                </div>

                <!-- Resend option -->
                <div class="pt-4">
                  <button
                    type="button"
                    class="text-sm text-blue-600 hover:text-blue-800 underline"
                    @click="currentStep = 'email'"
                  >
                    Didn't receive the email? Try again
                  </button>
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