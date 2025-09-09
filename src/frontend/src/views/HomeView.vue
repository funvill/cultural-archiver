<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiService, getErrorMessage } from '../services/api';
import { getApiBaseUrl } from '../utils/api-config';

const isLoading = ref(true);
const status = ref<string>('');
// Expose API base URL and build date for debug
const apiBaseUrl = getApiBaseUrl();
// Use the build timestamp injected at build time, fallback to current date if not set
const buildDate = import.meta.env.VITE_BUILD_DATE || new Date().toISOString();

const checkWorkerStatus = async (): Promise<void> => {
  try {
    const response = await apiService.getStatus();
    status.value = response.message || 'API connected successfully';
  } catch (error) {
    status.value = `API connection failed: ${getErrorMessage(error)}`;
    console.warn('API status check failed:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  checkWorkerStatus();
});
</script>

<template>
  <div class="about-view">
    <!-- Hero Section -->
    <div class="hero bg-gradient-to-r from-blue-500 to-purple-600 text-white">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div class="text-center">
          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">Cultural Archiver</h1>
          <p class="text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-2xl mx-auto">
            Discover, document, and celebrate public art in your community. Join our crowdsourced
            mapping initiative to preserve cultural heritage for future generations.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button
              @click="$router.push('/submit')"
              class="px-6 sm:px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
            >
              📸 Submit Artwork
            </button>
            <button
              @click="$router.push('/search?mode=photo')"
              class="px-6 sm:px-8 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 focus:bg-green-600 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-500 transition-colors"
            >
              🔍 Search by Photo
            </button>
            <button
              @click="$router.push('/')"
              class="px-6 sm:px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 focus:bg-white focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
            >
              🗺️ Explore Map
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Section -->
    <div class="bg-blue-50 border-b border-blue-200">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="bg-white rounded-lg p-6 shadow-sm">
          <h2 class="text-lg font-semibold mb-3 flex items-center">
            <svg class="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            System Status
          </h2>
          <p v-if="isLoading" class="text-gray-600 flex items-center">
            <svg
              class="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Checking API connection...
          </p>
          <p v-else class="text-gray-700">{{ status }}</p>
          <div class="mt-4 text-xs text-gray-500">
            <div><strong>API Base URL:</strong> {{ apiBaseUrl }}</div>
            <div><strong>Build Date:</strong> {{ buildDate }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Mission Section -->
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
        <p class="text-lg text-gray-700 max-w-2xl mx-auto">
          Cultural Archiver democratizes the documentation of public art and cultural heritage.
          Through community participation, we're building the world's most comprehensive map of
          public artworks, making culture accessible to everyone while preserving it for future
          generations.
        </p>
      </div>

      <!-- Features Grid -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        <!-- Community Powered -->
        <div class="text-center">
          <div
            class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Community Powered</h3>
          <p class="text-gray-600">
            Every submission from our community helps build a more complete picture of public art
            worldwide.
          </p>
        </div>

        <!-- High Quality -->
        <div class="text-center">
          <div
            class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Quality Assured</h3>
          <p class="text-gray-600">
            All submissions are reviewed by our moderation team to ensure accuracy and appropriate
            content.
          </p>
        </div>

        <!-- Open Access -->
        <div class="text-center">
          <div
            class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-8 h-8 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Open Access</h3>
          <p class="text-gray-600">
            Our public API makes cultural data accessible to researchers, artists, and developers.
          </p>
        </div>

        <!-- Mobile First -->
        <div class="text-center">
          <div
            class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Mobile First</h3>
          <p class="text-gray-600">
            Designed for on-the-go discovery and documentation with offline-capable mobile
            interfaces.
          </p>
        </div>

        <!-- Privacy Focused -->
        <div class="text-center">
          <div
            class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Privacy Focused</h3>
          <p class="text-gray-600">
            Anonymous submissions with optional email verification protect contributor privacy.
          </p>
        </div>

        <!-- Global Reach -->
        <div class="text-center">
          <div
            class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-8 h-8 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Global Reach</h3>
          <p class="text-gray-600">
            Supporting public art documentation from every corner of the world, in every community.
          </p>
        </div>
      </div>

      <!-- How It Works -->
      <div class="bg-gray-50 rounded-lg p-8 mb-16">
        <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="text-center">
            <div
              class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold"
            >
              1
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Discover</h3>
            <p class="text-gray-600">
              Find public art on our interactive map or discover new pieces while exploring your
              community.
            </p>
          </div>
          <div class="text-center">
            <div
              class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold"
            >
              2
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Document</h3>
            <p class="text-gray-600">
              Upload photos and details through our 60-second submission process, including location
              and context.
            </p>
          </div>
          <div class="text-center">
            <div
              class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold"
            >
              3
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Share</h3>
            <p class="text-gray-600">
              Your contributions become part of the permanent cultural record, accessible to
              everyone.
            </p>
          </div>
        </div>
      </div>

      <!-- Community Guidelines -->
      <div class="mb-16">
        <h2 class="text-2xl font-bold text-gray-900 mb-6">Community Guidelines</h2>
        <div class="grid md:grid-cols-2 gap-8">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">✅ Please Do</h3>
            <ul class="space-y-2 text-gray-700">
              <li>• Submit clear, well-composed photographs</li>
              <li>• Include accurate location information</li>
              <li>• Provide helpful context and descriptions</li>
              <li>• Respect artist rights and private property</li>
              <li>• Report inaccurate or inappropriate content</li>
            </ul>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">❌ Please Don't</h3>
            <ul class="space-y-2 text-gray-700">
              <li>• Submit copyrighted or private artwork without permission</li>
              <li>• Include people in photos without consent</li>
              <li>• Provide false or misleading information</li>
              <li>• Upload inappropriate or offensive content</li>
              <li>• Duplicate existing well-documented pieces</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Contact and Support -->
      <div class="bg-blue-50 rounded-lg p-8 text-center">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Get Involved</h2>
        <p class="text-gray-700 mb-6 max-w-2xl mx-auto">
          Whether you're an artist, curator, researcher, or simply someone who loves public art,
          there's a place for you in our community. Join us in building the world's most
          comprehensive cultural archive.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            @click="$router.push('/submit')"
            class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Contributing
          </button>
          <a
            href="mailto:hello@art.abluestar.com"
            class="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-view {
  min-height: 100vh;
  background-color: #ffffff;
}

/* Loading animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Feature card hover effects */
.grid > div {
  transition: transform 0.2s ease-in-out;
}

.grid > div:hover {
  transform: translateY(-2px);
}
</style>
