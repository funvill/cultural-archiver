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
  <div class="help-view">
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
              Submit Artwork
            </button>
            <button
              @click="$router.push('/')"
              class="px-6 sm:px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 focus:bg-white focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
            >
              Explore Map
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

      <!-- FAQ Section -->
      <div class="mb-16">
        <h2 class="text-3xl font-bold text-gray-900 mb-8 text-center">
          Frequently Asked Questions
        </h2>
        <div class="space-y-6">
          <!-- Why Location Access Needed -->
          <div
            id="location-access-faq"
            class="bg-yellow-50 border border-yellow-200 rounded-lg p-6"
          >
            <h3 class="text-xl font-semibold text-gray-900 mb-3">
              Why do you need location access?
            </h3>
            <div class="text-gray-700 space-y-3">
              <p>Location access helps us provide you with the best possible experience:</p>
              <ul class="list-disc list-inside space-y-2 ml-4">
                <li>
                  <strong>Find nearby artworks:</strong> We show you public art in your immediate
                  area
                </li>
                <li>
                  <strong>Accurate submissions:</strong> When you submit new artwork, we can
                  automatically capture its precise location
                </li>
                <li>
                  <strong>Improve map experience:</strong> We can center the map on your location
                  for easier navigation
                </li>
                <li>
                  <strong>Better recommendations:</strong> We can suggest artworks to visit based on
                  your current location
                </li>
              </ul>
              <p class="text-sm text-yellow-800 bg-yellow-100 rounded p-3">
                <strong>Privacy note:</strong> Your location is only used locally in your browser to
                enhance your experience. We do not track or store your location data.
              </p>
            </div>
          </div>

          <!-- General FAQ Items -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-3">
              What types of artwork can I submit?
            </h3>
            <p class="text-gray-700">
              You can submit any publicly accessible artwork including murals, sculptures,
              monuments, street art, mosaics, installations, and other forms of public art. The
              artwork should be visible and accessible to the general public.
            </p>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-3">
              Do I need an account to use Cultural Archiver?
            </h3>
            <p class="text-gray-700">
              No! You can submit artwork and explore the map without creating an account. However,
              creating an account allows you to claim your anonymous submissions, sync your data
              across devices, and helps us prevent spam.
            </p>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-3">
              How do you ensure data quality?
            </h3>
            <p class="text-gray-700">
              All submissions go through a moderation process where trained reviewers verify the
              information and photos. We also use community reporting to maintain data accuracy and
              remove inappropriate content.
            </p>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-3">
              Can I edit artwork information?
            </h3>
            <p class="text-gray-700">
              Currently, artwork information is managed through our moderation system. If you notice
              incorrect information, you can submit a new entry with the correct details, and our
              moderators will review and update the record.
            </p>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-3">
              Is the data available for research or other projects?
            </h3>
            <p class="text-gray-700">
              Yes! We believe in open cultural data. Our database will be available for public
              download under a Creative Commons license, making it valuable for researchers, city
              planners, and other cultural initiatives.
            </p>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-3">
              How can I report inappropriate content?
            </h3>
            <p class="text-gray-700">
              If you encounter inappropriate content, please contact our moderation team. We take
              content quality seriously and will promptly review and address any reported issues.
            </p>
          </div>
        </div>
      </div>

      <!-- Features Grid -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        <div class="text-center">
          <div
            class="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              ></path>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">Interactive Map</h3>
          <p class="text-gray-600">
            Explore public artworks on an interactive map with clustering, filtering, and detailed
            location information.
          </p>
        </div>

        <div class="text-center">
          <div
            class="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
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
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">Easy Submissions</h3>
          <p class="text-gray-600">
            Submit new artworks with photos, location data, and detailed descriptions using our
            streamlined submission process.
          </p>
        </div>

        <div class="text-center">
          <div
            class="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">Community Driven</h3>
          <p class="text-gray-600">
            Built by the community, for the community. Every submission helps preserve our shared
            cultural heritage.
          </p>
        </div>

        <div class="text-center">
          <div
            class="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">Quality Assured</h3>
          <p class="text-gray-600">
            All submissions are reviewed by moderators to ensure accuracy and maintain high data
            quality standards.
          </p>
        </div>

        <div class="text-center">
          <div
            class="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
          >
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">Open Data</h3>
          <p class="text-gray-600">
            All artwork data will be made freely available under open licenses for research,
            education, and cultural initiatives.
          </p>
        </div>

        <div class="text-center">
          <div
            class="bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
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
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold mb-2">Mobile Friendly</h3>
          <p class="text-gray-600">
            Optimized for mobile devices with touch-friendly interfaces and offline capabilities for
            field documentation.
          </p>
        </div>
      </div>

      <!-- How It Works -->
      <div class="mb-16">
        <h2 class="text-3xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="text-center">
            <div
              class="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold"
            >
              1
            </div>
            <h3 class="text-xl font-semibold mb-2">Discover</h3>
            <p class="text-gray-600">
              Explore the interactive map to discover public artworks in your area or around the
              world.
            </p>
          </div>
          <div class="text-center">
            <div
              class="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold"
            >
              2
            </div>
            <h3 class="text-xl font-semibold mb-2">Document</h3>
            <p class="text-gray-600">
              Found new artwork? Submit photos, location, and details to add it to our growing
              database.
            </p>
          </div>
          <div class="text-center">
            <div
              class="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold"
            >
              3
            </div>
            <h3 class="text-xl font-semibold mb-2">Share</h3>
            <p class="text-gray-600">
              Help others discover cultural treasures by contributing to our community-driven
              archive.
            </p>
          </div>
        </div>
      </div>

      <!-- Contact & Support -->
      <div class="text-center bg-gray-50 rounded-lg p-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Need Help?</h2>
        <p class="text-gray-600 mb-6 max-w-2xl mx-auto">
          Have questions, feedback, or want to get involved? We'd love to hear from you!
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:support@art.abluestar.com"
            class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Contact Support
          </a>
          <a
            href="https://github.com/cultural-archiver"
            target="_blank"
            rel="noopener noreferrer"
            class="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-view {
  min-height: 100vh;
}

.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Enhanced focus styles for better accessibility */
button:focus,
a:focus {
  box-shadow: 0 0 0 2px currentColor;
}
</style>
