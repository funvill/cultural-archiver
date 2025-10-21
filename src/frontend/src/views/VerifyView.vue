<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// Redirect to home since Clerk handles authentication verification
onMounted(() => {
  router.push('/');
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Cultural Archiver</h1>
        <p class="text-sm text-gray-600 mt-2">Redirecting...</p>
      </div>
      
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div class="text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-6">
            <svg
              class="h-8 w-8 animate-spin text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            Authentication Complete
          </h2>
          
          <p class="text-sm text-gray-600 mb-6 leading-relaxed">
            Authentication is now handled by Clerk. Redirecting to home page...
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
