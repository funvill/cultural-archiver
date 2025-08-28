<script setup lang="ts">
import AppShell from './components/AppShell.vue'
</script>

<template>
  <div id="app">
    <AppShell />
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
