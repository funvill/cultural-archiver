<template>
  <div 
    class="badge-card group cursor-help"
    :title="tooltipText"
    @click="showDetails = !showDetails"
  >
    <!-- Badge Display -->
    <div class="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow duration-200">
      <!-- Badge Icon and Level -->
      <div class="flex items-center justify-between mb-2">
        <div class="text-2xl">{{ badge.icon_emoji }}</div>
        <div v-if="badge.level > 1" class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          Level {{ badge.level }}
        </div>
      </div>

      <!-- Badge Title -->
      <h4 class="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
        {{ badge.title }}
      </h4>

      <!-- Badge Description -->
      <p class="text-xs text-gray-600 line-clamp-2 mb-2">
        {{ badge.description }}
      </p>

      <!-- Award Date -->
      <div class="text-xs text-gray-500">
        {{ formatDate(awardedAt) }}
      </div>
    </div>

    <!-- Detailed Modal/Popover (Optional Enhancement) -->
    <div 
      v-if="showDetails" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showDetails = false"
    >
      <div 
        class="bg-white rounded-lg p-6 max-w-sm mx-4"
        @click.stop
      >
        <div class="flex items-center mb-4">
          <div class="text-4xl mr-3">{{ badge.icon_emoji }}</div>
          <div>
            <h3 class="font-semibold text-lg text-gray-900">{{ badge.title }}</h3>
            <p class="text-sm text-gray-600">{{ badge.category }} badge</p>
          </div>
        </div>
        
        <p class="text-gray-700 mb-4">{{ badge.description }}</p>
        
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Earned:</span>
            <span class="font-medium">{{ formatDate(awardedAt) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Reason:</span>
            <span class="font-medium">{{ awardReason }}</span>
          </div>
          <div v-if="badge.level > 1" class="flex justify-between">
            <span class="text-gray-600">Level:</span>
            <span class="font-medium">{{ badge.level }}</span>
          </div>
        </div>

        <button 
          @click="showDetails = false"
          class="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { BadgeRecord } from '../types';

interface Props {
  badge: BadgeRecord;
  awardedAt: string;
  awardReason: string;
  metadata?: Record<string, unknown>;
}

const props = defineProps<Props>();
const showDetails = ref(false);

const tooltipText = computed(() => {
  return `${props.badge.title} - ${props.badge.description}. Earned: ${formatDate(props.awardedAt)}`;
});

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Unknown date';
  }
};
</script>

<style scoped>
.badge-card {
  @apply transition-transform duration-200;
}

.badge-card:hover {
  @apply transform scale-105;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>