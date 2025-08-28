<template>
  <div class="artwork-detail-view">
    <h1>Artwork Details - Coming Soon</h1>
    <p>Artwork ID: {{ id }}</p>
    <p>Detailed artwork information will be shown here.</p>
  </div>
</template>

<script setup lang="ts">
// Props
interface Props {
  id: string
}

defineProps<Props>()
</script>

<style scoped>
.artwork-detail-view {
  padding: 2rem;
  text-align: center;
}
</style>