<script setup lang="ts">
import { ref, computed, onErrorCaptured, onMounted } from 'vue'
import { useRouter } from 'vue-router'

interface ErrorInfo {
  componentName?: string
  propsData?: any
  trace?: string
}

const props = defineProps<{
  fallback?: () => void
}>()

const router = useRouter()

// State
const hasError = ref(false)
const error = ref<Error | null>(null)
const errorInfo = ref<ErrorInfo | null>(null)

// Environment check
const isProduction = computed(() => import.meta.env.PROD)

// Error capture
onErrorCaptured((err: Error, instance, info: string) => {
  console.error('ErrorBoundary caught error:', err)
  console.error('Component info:', info)
  
  hasError.value = true
  error.value = err
  errorInfo.value = {
    componentName: instance?.$options.name || 'Unknown',
    propsData: instance?.$props,
    trace: info
  }

  // Call fallback if provided
  if (props.fallback) {
    props.fallback()
  }

  // Prevent the error from propagating further
  return false
})

// Global error handler
onMounted(() => {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    hasError.value = true
    let errObj: Error
    if (event.reason instanceof Error) {
      errObj = event.reason
    } else if (typeof event.reason === 'object' && event.reason !== null && 'message' in event.reason) {
      errObj = new Error(String(event.reason.message))
      // Optionally attach stack if present
      if ('stack' in event.reason) (errObj as any).stack = event.reason.stack
    } else {
      errObj = new Error(typeof event.reason === 'string' ? event.reason : JSON.stringify(event.reason))
    }
    error.value = errObj
    errorInfo.value = {
      componentName: 'Global',
      trace: (errObj.stack || 'No stack trace available')
    }
  })

  // Catch JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global JavaScript error:', event.error)
    
    hasError.value = true
    error.value = event.error || new Error(event.message)
    errorInfo.value = {
      componentName: 'Global',
      trace: event.error?.stack || 'No stack trace available'
    }
  })
})

// Actions
const reload = () => {
  window.location.reload()
}

const goHome = () => {
  hasError.value = false
  error.value = null
  errorInfo.value = null
  router.push('/')
}

const reportError = () => {
  const errorReport = {
    message: error.value?.message || 'Unknown error',
    stack: error.value?.stack || 'No stack trace',
    component: errorInfo.value?.componentName || 'Unknown',
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  }

  // Create mailto link with error details
  const subject = encodeURIComponent('Cultural Archiver Error Report')
  const body = encodeURIComponent(`
Error Report:

Message: ${errorReport.message}
Component: ${errorReport.component}
URL: ${errorReport.url}
Time: ${errorReport.timestamp}

Technical Details:
${errorReport.stack}

Browser: ${errorReport.userAgent}

Please describe what you were doing when this error occurred:
[Your description here]
  `.trim())

  window.open(`mailto:support@abluestar.com?subject=${subject}&body=${body}`)
}

// Reset error state (can be called from parent)
const reset = () => {
  hasError.value = false
  error.value = null
  errorInfo.value = null
}

// Expose reset function
defineExpose({
  reset
})
</script>

<template>
  <div v-if="hasError" class="error-boundary">
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="max-w-md w-full mx-auto p-6">
        <div class="bg-white rounded-lg shadow-lg p-8 text-center">
          <!-- Error Icon -->
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <!-- Error Message -->
          <h1 class="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
          
          <p class="text-gray-600 mb-6">
            {{ isProduction ? 
              'An unexpected error occurred. Please try again or contact support if the problem persists.' :
              error?.message || 'An unknown error occurred'
            }}
          </p>

          <!-- Error Details (Development Only) -->
          <div v-if="!isProduction && error" class="mb-6 p-4 bg-gray-100 rounded-lg text-left">
            <details>
              <summary class="font-medium text-gray-700 cursor-pointer mb-2">
                Error Details
              </summary>
              <div class="text-sm text-gray-600 font-mono">
                <p class="mb-2"><strong>Message:</strong> {{ error.message }}</p>
                <p class="mb-2"><strong>Component:</strong> {{ errorInfo?.componentName || 'Unknown' }}</p>
                <div v-if="error.stack" class="whitespace-pre-wrap">
                  <strong>Stack Trace:</strong>
                  {{ error.stack }}
                </div>
              </div>
            </details>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              @click="reload"
              class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Reload Page
            </button>
            
            <button
              @click="goHome"
              class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Go to Home
            </button>
          </div>

          <!-- Report Issue Link -->
          <div class="mt-6 pt-6 border-t border-gray-200">
            <p class="text-sm text-gray-500 mb-2">
              If this error persists, please report it to help us improve the app.
            </p>
            <button
              @click="reportError"
              class="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Report this issue
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div v-else>
    <slot />
  </div>
</template>

<style scoped>
.error-boundary {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

details summary {
  outline: none;
}

details[open] summary {
  margin-bottom: 0.5rem;
}
</style>