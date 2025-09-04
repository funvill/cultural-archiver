<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

// State
const isVerifying = ref(true)
const verificationStatus = ref<'pending' | 'success' | 'error'>('pending')
const message = ref('')
const isNewAccount = ref(false)
const redirectCountdown = ref(5)

// Composables
const route = useRoute()
const router = useRouter()
const { verifyMagicLink, initAuth, error } = useAuth()

// Computed
const statusIcon = computed(() => {
  switch (verificationStatus.value) {
    case 'success':
      return {
        class: 'text-green-600 bg-green-100'
      }
    case 'error':
      return {
        class: 'text-red-600 bg-red-100'
      }
    default:
      return {
        class: 'text-blue-600 bg-blue-100'
      }
  }
})

const statusTitle = computed(() => {
  switch (verificationStatus.value) {
    case 'success':
      return isNewAccount.value ? 'Account Created!' : 'Welcome Back!'
    case 'error':
      return 'Verification Failed'
    default:
      return 'Verifying...'
  }
})

const statusMessage = computed(() => {
  if (message.value) return message.value
  
  switch (verificationStatus.value) {
    case 'success':
      return isNewAccount.value 
        ? 'Your account has been created successfully. You can now submit artwork and sync across devices.'
        : 'You have been signed in successfully. Your submissions are now synced across devices.'
    case 'error':
      return error.value || 'The magic link is invalid or has expired. Please request a new one.'
    default:
      return 'Please wait while we verify your magic link...'
  }
})

// Lifecycle
onMounted(() => {
  const token = route.query.token as string
  
  if (!token) {
    verificationStatus.value = 'error'
    message.value = 'No verification token provided'
    isVerifying.value = false
    return
  }

  performVerification(token)
})

// Methods
async function performVerification(token: string): Promise<void> {
  try {
    const result = await verifyMagicLink(token)
    
    if (result.success) {
      verificationStatus.value = 'success'
      message.value = result.message
      isNewAccount.value = result.isNewAccount || false
      
      // CRITICAL: Re-initialize auth state after successful verification
      // This ensures localStorage, user state, and backend session are all synchronized
      console.log('[MAGIC LINK VERIFY] Initializing auth state after successful verification')
      await initAuth()
      console.log('[MAGIC LINK VERIFY] Auth state re-initialized successfully')
      
      // Start countdown for redirect
      startRedirectCountdown()
    } else {
      verificationStatus.value = 'error'
      message.value = result.message
    }
  } catch (err) {
    verificationStatus.value = 'error'
    message.value = 'An unexpected error occurred during verification'
  } finally {
    isVerifying.value = false
  }
}

function startRedirectCountdown(): void {
  const interval = setInterval(() => {
    redirectCountdown.value--
    
    if (redirectCountdown.value <= 0) {
      clearInterval(interval)
      redirectToProfile()
    }
  }, 1000)
}

function redirectToProfile(): void {
  router.push('/profile')
}

function redirectToHome(): void {
  router.push('/')
}

function redirectToSubmit(): void {
  router.push('/submit')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Logo/Brand -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Cultural Archiver</h1>
        <p class="text-sm text-gray-600 mt-2">Magic Link Verification</p>
      </div>

      <!-- Verification Card -->
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div class="text-center">
          <!-- Status Icon -->
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-6" :class="statusIcon.class">
            <!-- Success Icon -->
            <svg 
              v-if="verificationStatus === 'success'" 
              class="h-8 w-8" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke-width="1.5" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            
            <!-- Error Icon -->
            <svg 
              v-else-if="verificationStatus === 'error'" 
              class="h-8 w-8" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke-width="1.5" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            
            <!-- Loading Icon -->
            <svg 
              v-else
              class="h-8 w-8 animate-spin" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke-width="1.5" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>

          <!-- Status Title -->
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ statusTitle }}
          </h2>

          <!-- Status Message -->
          <p class="text-sm text-gray-600 mb-6 leading-relaxed">
            {{ statusMessage }}
          </p>

          <!-- Success Actions -->
          <div v-if="verificationStatus === 'success'" class="space-y-4">
            <!-- Redirect countdown -->
            <div class="bg-green-50 rounded-md p-3">
              <p class="text-sm text-green-800">
                Redirecting to your profile in {{ redirectCountdown }} seconds...
              </p>
            </div>

            <!-- Action buttons -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                @click="redirectToProfile"
              >
                Go to Profile
              </button>
              <button
                type="button"
                class="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                @click="redirectToSubmit"
              >
                Submit Artwork
              </button>
            </div>

            <!-- New account benefits -->
            <div v-if="isNewAccount" class="bg-blue-50 rounded-md p-4 text-left">
              <h4 class="text-sm font-medium text-blue-900 mb-2">What's next?</h4>
              <ul class="text-xs text-blue-800 space-y-1">
                <li>• Your anonymous submissions are now linked to your account</li>
                <li>• You can access your profile across all devices</li>
                <li>• Track the status of your artwork submissions</li>
                <li>• Receive notifications about your submissions</li>
              </ul>
            </div>
          </div>

          <!-- Error Actions -->
          <div v-else-if="verificationStatus === 'error'" class="space-y-4">
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                @click="redirectToHome"
              >
                Go to Home
              </button>
              <button
                type="button"
                class="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                @click="router.back()"
              >
                Go Back
              </button>
            </div>

            <!-- Help text -->
            <div class="bg-yellow-50 rounded-md p-3">
              <p class="text-xs text-yellow-800">
                If you continue to have issues, please try requesting a new magic link 
                or contact support if the problem persists.
              </p>
            </div>
          </div>

          <!-- Loading state -->
          <div v-else class="space-y-4">
            <div class="bg-blue-50 rounded-md p-3">
              <p class="text-sm text-blue-800">
                This may take a few moments...
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-500">
          If you didn't request this verification, you can safely ignore this page.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>