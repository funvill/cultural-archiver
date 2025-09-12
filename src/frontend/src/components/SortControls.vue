<script setup lang="ts">
// Props interface
interface Props {
  currentSort: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  loading?: boolean;
}

// Emits interface
interface Emits {
  (e: 'sortChange', sort: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<Emits>();

// Methods
function changeSort(newSort: string): void {
  if (newSort !== props.currentSort && !props.loading) {
    emit('sortChange', newSort);
  }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <label for="sort-select" class="text-sm font-medium text-gray-700">
      Sort by:
    </label>
    
    <!-- Desktop: Button Group -->
    <div class="hidden sm:flex items-center gap-1">
      <button
        v-for="option in options"
        :key="option.value"
        :disabled="loading || false"
        :class="{
          'bg-blue-500 text-white border-blue-500': option.value === currentSort,
          'bg-white text-gray-700 border-gray-300 hover:bg-gray-50': option.value !== currentSort,
        }"
        class="px-3 py-2 text-sm font-medium border rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        @click="changeSort(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- Mobile: Select Dropdown -->
    <select
      id="sort-select"
      :value="currentSort"
      :disabled="loading || false"
      class="sm:hidden border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
      @change="changeSort(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>