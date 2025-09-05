<script setup lang="ts">
// Props interface
interface Props {
  compact?: boolean;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  count: 1,
});

// Generate array for v-for
const skeletons = Array.from({ length: props.count }, (_, i) => i);
</script>

<template>
  <div v-for="index in skeletons" :key="`skeleton-${index}`">
    <!-- Compact Skeleton -->
    <div
      v-if="compact"
      class="bg-white rounded-lg shadow-sm border border-gray-200 h-32 animate-pulse"
      role="status"
      aria-label="Loading artwork..."
    >
      <div class="flex h-full">
        <!-- Photo Placeholder -->
        <div class="flex-shrink-0 w-32 h-full bg-gray-200 rounded-l-lg"></div>

        <!-- Content Placeholder -->
        <div class="flex-1 p-3 space-y-2">
          <!-- Title -->
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <!-- Type -->
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          <!-- Details -->
          <div class="flex justify-between">
            <div class="h-3 bg-gray-200 rounded w-1/4"></div>
            <div class="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Full Skeleton -->
    <div
      v-else
      class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading artwork..."
    >
      <!-- Photo Placeholder -->
      <div class="w-full h-48 bg-gray-200"></div>

      <!-- Content Placeholder -->
      <div class="p-4 space-y-3">
        <!-- Title -->
        <div class="space-y-2">
          <div class="h-5 bg-gray-200 rounded w-4/5"></div>
          <div class="h-5 bg-gray-200 rounded w-3/5"></div>
        </div>

        <!-- Type and Distance -->
        <div class="flex items-center justify-between">
          <div class="h-6 bg-gray-200 rounded-full w-20"></div>
          <div class="h-4 bg-gray-200 rounded w-16"></div>
        </div>

        <!-- Additional Details -->
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <div class="h-3 bg-gray-200 rounded w-12"></div>
            <div class="h-3 bg-gray-200 rounded w-24"></div>
          </div>
          <div class="flex items-center space-x-2">
            <div class="h-3 bg-gray-200 rounded w-16"></div>
            <div class="h-3 bg-gray-200 rounded w-20"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Screen reader text -->
    <span class="sr-only">Loading artwork information...</span>
  </div>
</template>

<style scoped>
/* Ensure smooth animation performance */
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
