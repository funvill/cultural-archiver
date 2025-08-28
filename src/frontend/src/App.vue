<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { useAuth } from './composables/useAuth'

const { initAuth } = useAuth()

// Initialize authentication on app startup
onMounted(async () => {
  try {
    await initAuth()
  } catch (error) {
    console.error('Failed to initialize authentication:', error)
  }
})
</script>

<template>
  <div id="app">
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  </div>
</template>

<style>
#app {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Ensure full height */
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

/* Override any default margins */
* {
  box-sizing: border-box;
}
</style>
