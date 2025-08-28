<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div id="app">
    <header class="bg-blue-600 text-white p-4">
      <h1 class="text-2xl font-bold">Cultural Archiver</h1>
      <p class="text-blue-100">Digital archiving system for cultural events and artifacts</p>
    </header>

    <main class="container mx-auto p-4">
      <RouterView />
    </main>

    <footer class="bg-gray-100 text-gray-600 p-4 mt-8">
      <div class="container mx-auto text-center">
        <p>&copy; 2024 Cultural Archiver. Built with Vue 3, TypeScript, and Cloudflare.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
}
</style>
