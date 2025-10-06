<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const requestedPath = computed(() => {
  return route.path || window.location.pathname;
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
    <div class="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
      <!-- Error Code -->
      <div class="text-center mb-6">
        <h1 class="text-6xl font-bold text-red-500 mb-2">404</h1>
        <h2 class="text-3xl font-semibold text-gray-800 mb-4">Page Not Found</h2>
      </div>

      <!-- Error Message -->
      <div class="prose max-w-none mb-8">
        <p class="text-gray-600 text-center mb-6">
          We couldn't find the page you're looking for. The artwork, artist, or page may have been
          moved, removed, or never existed.
        </p>

        <!-- Current Path Display -->
        <div class="bg-gray-100 rounded p-4 mb-6 text-sm text-gray-700 break-all">
          <strong>Requested path:</strong> {{ requestedPath }}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-gray-800 mb-3">What You Can Do:</h3>

        <router-link
          to="/"
          class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"
            />
          </svg>
          Explore the Map
        </router-link>

        <router-link
          to="/search"
          class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
          Search for Artworks
        </router-link>

        <router-link
          to="/artists"
          class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"
            />
          </svg>
          Browse All Artists
        </router-link>

        <router-link
          to="/add"
          class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clip-rule="evenodd"
            />
          </svg>
          Submit New Artwork
        </router-link>
      </div>

      <!-- Help Section -->
      <div class="mt-8 pt-8 border-t border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-3">Common Issues</h3>
        <ul class="text-sm text-gray-600 space-y-2 list-disc list-inside">
          <li>The artwork may have been merged with another entry</li>
          <li>The URL structure may have changed during an update</li>
          <li>The page may require authentication that you don't have</li>
        </ul>

        <div class="mt-6 text-center text-sm text-gray-500">
          <p>
            If you believe this page should exist, please contact us at
            <a
              href="mailto:support@publicartregistry.com"
              class="text-blue-600 hover:text-blue-800 underline"
            >
              support@publicartregistry.com
            </a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
