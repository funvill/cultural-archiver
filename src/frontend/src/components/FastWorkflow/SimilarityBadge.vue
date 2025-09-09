<!--
  Similarity Badge Component
  Shows similarity threshold with appropriate colors
-->

<template>
  <span
    class="similarity-badge inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
    :class="badgeClasses"
  >
    <component :is="iconComponent" class="w-3 h-3 mr-1" />
    {{ badgeText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ExclamationTriangleIcon, ShieldExclamationIcon } from '@heroicons/vue/24/outline';

interface Props {
  threshold: 'warning' | 'high';
}

const props = defineProps<Props>();

const badgeClasses = computed(() => {
  switch (props.threshold) {
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
});

const badgeText = computed(() => {
  switch (props.threshold) {
    case 'high':
      return 'High Similarity';
    case 'warning':
      return 'Similar';
    default:
      return 'Similar';
  }
});

const iconComponent = computed(() => {
  switch (props.threshold) {
    case 'high':
      return ShieldExclamationIcon;
    case 'warning':
      return ExclamationTriangleIcon;
    default:
      return ExclamationTriangleIcon;
  }
});
</script>