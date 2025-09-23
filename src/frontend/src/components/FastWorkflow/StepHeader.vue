<!--
  Step Header Component for Fast Photo-First Workflow
  Collapsible section header with completion status
-->

<script setup lang="ts">
import { CheckIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';

interface Props {
  title: string;
  completed: boolean;
  active: boolean;
}

defineProps<Props>();
defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <div
    class="step-header flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    :class="{ 'border-green-500': completed, 'border-blue-500': active }"
    @click="$emit('toggle')"
  >
    <div class="flex items-center space-x-3">
      <div
        class="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
        :class="
          completed
            ? 'bg-green-500 text-white'
            : active
              ? 'bg-blue-500 text-white'
              : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
        "
      >
        <CheckIcon v-if="completed" class="w-4 h-4" />
        <span v-else-if="active" class="w-2 h-2 bg-white rounded-full"></span>
        <span v-else class="w-2 h-2 bg-current rounded-full opacity-50"></span>
      </div>

      <h3
        class="text-lg font-medium"
        :class="
          completed
            ? 'text-green-700 dark:text-green-300'
            : active
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-900 dark:text-white'
        "
      >
        {{ title }}
      </h3>

      <div v-if="completed" class="flex items-center text-sm text-green-600 dark:text-green-400">
        <CheckIcon class="w-4 h-4 mr-1" />
        <span>Complete</span>
      </div>
    </div>

    <ChevronDownIcon
      class="w-5 h-5 text-gray-400 transition-transform duration-200"
      :class="{ 'rotate-180': active }"
    />
  </div>
</template>
