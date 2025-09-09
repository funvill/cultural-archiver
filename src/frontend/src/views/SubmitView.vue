<script setup lang="ts">
import { onMounted } from 'vue';
import AddArtworkFastForm from '../components/AddArtworkFastForm.vue';
import { useAuthStore } from '../stores/auth';

// Store
const authStore = useAuthStore();

// Lifecycle
onMounted(async () => {
  // Ensure user token is available for fast workflow
  await authStore.ensureUserToken();
});
</script>

<template>
  <div class="submit-view">
    <!-- Page Header -->
    <div class="bg-white border-b border-gray-200 py-4 sm:py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Submit Artwork</h1>
          <p class="mt-2 text-base sm:text-lg text-gray-600">
            Fast photo-first workflow with intelligent duplicate detection
          </p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <AddArtworkFastForm />
    </div>
  </div>
</template>

<style scoped>
.submit-view {
  min-height: 100vh;
  background-color: #f9fafb;
}

/* Mobile responsive adjustments */
@media (max-width: 640px) {
  .submit-view {
    @apply px-2;
  }
}
</style>
