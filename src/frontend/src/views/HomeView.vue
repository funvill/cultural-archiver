<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isLoading = ref(true);
const status = ref<string>('');

const checkWorkerStatus = async (): Promise<void> => {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    status.value = data.message || 'API connected successfully';
  } catch (error) {
    status.value = 'API connection failed - this is expected in development mode';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  checkWorkerStatus();
});
</script>

<template>
  <div class="home-view">
    <div class="hero bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-lg mb-8">
      <h1 class="text-4xl font-bold mb-4">Welcome to Cultural Archiver</h1>
      <p class="text-xl mb-6">
        A comprehensive digital archiving system for cultural events and artifacts. Preserve,
        organize, and share your cultural heritage with advanced tagging, search capabilities, and
        collaborative tools.
      </p>
      <div class="bg-white/10 backdrop-blur rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-2">🚀 Setup Status</h2>
        <p v-if="isLoading" class="text-blue-100">Checking API connection...</p>
        <p v-else class="text-blue-100">{{ status }}</p>
      </div>
    </div>

    <div class="features grid md:grid-cols-3 gap-6 mb-8">
      <div class="feature-card bg-white p-6 rounded-lg shadow-md">
        <div class="text-3xl mb-4">🎨</div>
        <h3 class="text-xl font-semibold mb-2">Artwork Management</h3>
        <p class="text-gray-600">
          Catalog and organize artworks with detailed metadata, high-resolution photos, and
          comprehensive tagging systems.
        </p>
      </div>

      <div class="feature-card bg-white p-6 rounded-lg shadow-md">
        <div class="text-3xl mb-4">📚</div>
        <h3 class="text-xl font-semibold mb-2">Digital Logbook</h3>
        <p class="text-gray-600">
          Maintain detailed records of events, maintenance, and changes with timestamped entries and
          photo documentation.
        </p>
      </div>

      <div class="feature-card bg-white p-6 rounded-lg shadow-md">
        <div class="text-3xl mb-4">🔍</div>
        <h3 class="text-xl font-semibold mb-2">Advanced Search</h3>
        <p class="text-gray-600">
          Powerful search and filtering capabilities with tag-based organization, date ranges, and
          full-text search.
        </p>
      </div>
    </div>

    <div class="getting-started bg-gray-50 p-6 rounded-lg">
      <h2 class="text-2xl font-semibold mb-4">🚀 Getting Started</h2>
      <div class="space-y-2 text-gray-700">
        <p><strong>Phase 0:</strong> Foundation setup completed ✅</p>
        <p><strong>Next:</strong> API implementation and frontend features</p>
        <p><strong>Tech Stack:</strong> Vue 3, TypeScript, Cloudflare Workers, D1 Database</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feature-card {
  transition: transform 0.2s ease-in-out;
}

.feature-card:hover {
  transform: translateY(-2px);
}
</style>
