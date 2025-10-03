<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onErrorCaptured, onMounted } from 'vue';
// Declare globals for environments where DOM lib typings may not be included during type analysis
declare const window: any;
declare const navigator: any;
import { useRouter } from 'vue-router';

interface ErrorInfo {
  componentName?: string;
  propsData?: any;
  trace?: string;
}

const props = defineProps<{
  fallback?: () => void;
}>();

const router = useRouter();

// State
const hasError = ref(false);
const error = ref<Error | null>(null);
const errorInfo = ref<ErrorInfo | null>(null);
// Reference ID to include in support requests (timestamp + random string)
const referenceId = ref<string | null>(null);

// Environment check
const isProduction = computed(() => import.meta.env.PROD);

// Error capture
onErrorCaptured((err: Error, instance: any, info: string) => {
  console.error('ErrorBoundary caught error:', err);
  console.error('Component info:', info);

  hasError.value = true;
  referenceId.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  error.value = err;
  errorInfo.value = {
    componentName: instance?.$options.name || 'Unknown',
    propsData: instance?.$props,
    trace: info,
  };

  // Call fallback if provided
  if (props.fallback) {
    props.fallback();
  }

  // Prevent the error from propagating further
  return false;
});

// Global error handler
onMounted(() => {
  if (typeof window !== 'undefined') {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: any) => {
      console.error('Unhandled promise rejection:', event.reason);
      hasError.value = true;
      referenceId.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      let errObj: Error;
      if (event.reason instanceof Error) {
        errObj = event.reason;
      } else if (
        typeof event.reason === 'object' &&
        event.reason !== null &&
        'message' in event.reason
      ) {
        errObj = new Error(String(event.reason.message));
        if ('stack' in event.reason) (errObj as any).stack = event.reason.stack;
      } else {
        errObj = new Error(
          typeof event.reason === 'string' ? event.reason : JSON.stringify(event.reason)
        );
      }
      error.value = errObj;
      errorInfo.value = {
        componentName: 'Global',
        trace: errObj.stack || 'No stack trace available',
      };
    });

    // Catch global JS errors
    window.addEventListener('error', (event: any) => {
      console.error('Global JavaScript error:', event.error);
      hasError.value = true;
      referenceId.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      error.value = event.error || new Error(event.message);
      errorInfo.value = {
        componentName: 'Global',
        trace: event.error?.stack || 'No stack trace available',
      };
    });
  }
});

// Actions
const reload = () => {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

const goHome = () => {
  hasError.value = false;
  error.value = null;
  errorInfo.value = null;
  router.push('/');
};

const buildErrorReportObject = () => {
  // Extract artwork id if URL matches /artwork/<id>
  let artworkId: string | null = null;
  if (typeof window !== 'undefined' && window.location?.pathname) {
    const match = window.location.pathname.match(/\/artwork\/([^/]+)/);
    if (match) artworkId = decodeURIComponent(match[1]);
  }
  return {
    referenceId: referenceId.value,
    message: error.value?.message || 'Unknown error',
    stack: error.value?.stack || 'No stack trace',
    component: errorInfo.value?.componentName || 'Unknown',
    trace: errorInfo.value?.trace || 'No trace',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    artworkId,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString(),
    appVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
  };
};

const reportError = () => {
  const errorReport = buildErrorReportObject();
  const subject = encodeURIComponent(
    `Cultural Archiver Error Report (${errorReport.referenceId || 'no-ref'})`
  );
  const body = encodeURIComponent(
    `Error Report\n\nReference ID: ${errorReport.referenceId}\nMessage: ${errorReport.message}\nComponent: ${errorReport.component}\nURL: ${errorReport.url}\nTime: ${errorReport.timestamp}\nApp Version: ${errorReport.appVersion}\n\nStack:\n${errorReport.stack}\n\nTrace:\n${errorReport.trace}\n\nBrowser: ${errorReport.userAgent}\n\nDescribe what you were doing when this error occurred:\n[Your description here]`
  );
  if (typeof window !== 'undefined') {
    window.open(`mailto:support@art.abluestar.com?subject=${subject}&body=${body}`);
  }
};

function copyErrorDetails() {
  try {
    const report = buildErrorReportObject();
    const json = JSON.stringify(report, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(json);
    }
  } catch (err) {
    console.warn('Failed to copy error details', err);
  }
}

// Reset error state (can be called from parent)
const reset = () => {
  hasError.value = false;
  error.value = null;
  errorInfo.value = null;
};

// Expose reset function
defineExpose({
  reset,
});
</script>

<template>
  <div v-if="hasError" class="error-boundary">
    <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div class="w-full max-w-4xl mx-auto p-2">
        <div class="bg-white rounded-xl shadow-2xl p-10 text-center border border-gray-200">
          <!-- Error Icon -->
          <div
            class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6"
          >
            <svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <!-- Error Message -->
          <h1 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Something went wrong</h1>
          <p v-if="referenceId" class="text-xs text-gray-500 mb-1">
            Reference ID: {{ referenceId }}
          </p>
          <p v-if="buildErrorReportObject().artworkId" class="text-xs text-gray-500 mb-4">
            Artwork: {{ buildErrorReportObject().artworkId }}
          </p>

          <p class="text-gray-600 mb-6">
            <span v-if="isProduction">
              An unexpected error occurred. You can reload the page or send the report below to
              support.
            </span>
            <span v-else>{{ error?.message || 'An unknown error occurred' }}</span>
          </p>

          <!-- Always show a concise error summary in production -->
          <div
            v-if="isProduction && error"
            class="mb-6 p-4 bg-red-50 border border-red-200 rounded text-left"
          >
            <p class="text-sm text-red-700"><strong>Error:</strong> {{ error.message }}</p>
            <p v-if="errorInfo?.componentName" class="text-xs text-red-600 mt-2">
              Component: {{ errorInfo.componentName }}
            </p>
          </div>

          <!-- Error Details (Development Only) -->
          <div v-if="!isProduction && error" class="mb-6 p-4 bg-gray-100 rounded-lg text-left">
            <details>
              <summary class="font-medium text-gray-700 cursor-pointer mb-2">Error Details</summary>
              <div class="text-sm text-gray-600 font-mono">
                <p class="mb-2"><strong>Message:</strong> {{ error.message }}</p>
                <p class="mb-2">
                  <strong>Component:</strong> {{ errorInfo?.componentName || 'Unknown' }}
                </p>
                <div v-if="error.stack" class="whitespace-pre-wrap">
                  <strong>Stack Trace:</strong>
                  {{ error.stack }}
                </div>
              </div>
            </details>
          </div>

          <!-- Collapsible full technical report (shown in all modes for advanced diagnostics) -->
          <div v-if="error" class="mb-8 p-5 bg-gray-50 rounded-lg text-left border border-gray-200">
            <details>
              <summary class="font-medium text-gray-700 cursor-pointer mb-2">
                Technical Report (JSON)
              </summary>
              <pre
                class="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-96"
                >{{ JSON.stringify(buildErrorReportObject(), null, 2) }}</pre
              >
              <button
                type="button"
                @click="copyErrorDetails"
                class="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-gray-800 text-white hover:bg-gray-700"
              >
                Copy Details
              </button>
            </details>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              @click="reload"
              class="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-semibold"
            >
              Reload Page
            </button>

            <button
              @click="goHome"
              class="px-8 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm font-semibold"
            >
              Go to Home
            </button>
          </div>

          <!-- Report Issue Link -->
          <div class="mt-10 pt-6 border-t border-gray-200">
            <p class="text-sm text-gray-500 mb-2">
              If this error persists, please report it to help us improve the app.
            </p>
            <button
              @click="reportError"
              class="text-blue-600 hover:text-blue-700 text-sm font-medium underline decoration-dotted"
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
