<script setup lang="ts">
import { ref } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

// Allow users to dismiss the banner for this session
const isDismissed = ref(false);

const dismissBanner = () => {
  isDismissed.value = true;
  // Store dismissal in sessionStorage so it stays dismissed for this session only
  sessionStorage.setItem('dev-banner-dismissed', 'true');
};

// Check if banner was already dismissed this session
const checkDismissed = () => {
  if (sessionStorage.getItem('dev-banner-dismissed') === 'true') {
    isDismissed.value = true;
  }
};

checkDismissed();
</script>

<template>
  <div
    v-if="!isDismissed"
    class="dev-banner relative bg-yellow-400 text-black py-3 px-4 sm:px-6"
    role="alert"
    aria-live="polite"
  >
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex-1 text-center sm:text-left">
        <p class="text-sm font-medium">
          ⚠️ <strong>Under Development:</strong>
          This website is still in development. Data is cleared regularly while we work on it. Don't
          submit new data as it will be erased. This webpage will be moved to a new domain shortly.
          <span class="ml-2">
            Questions? Contact us at
            <a
              href="mailto:support@publicartregistry.com"
              class="underline hover:no-underline font-semibold"
            >
              support@publicartregistry.com
            </a>
          </span>
        </p>
      </div>
      <button
        @click="dismissBanner"
        class="ml-4 flex-shrink-0 p-1 hover:bg-yellow-500 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-400"
        aria-label="Dismiss development warning"
      >
        <XMarkIcon class="h-5 w-5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Ensure the banner appears above other content (above the navigation rail z-40) */
.dev-banner {
  z-index: 50;
  position: relative; /* keep positioning behavior consistent */
}
</style>
