<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';

// Props interface
interface Props {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  loading?: boolean;
}

// Emits interface
interface Emits {
  (e: 'pageChange', page: number): void;
  (e: 'pageSizeChange', size: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<Emits>();

// Available page sizes
const pageSizes = [10, 30, 50];

// Computed
const hasPrevious = computed(() => props.currentPage > 1);
const hasNext = computed(() => props.currentPage < props.totalPages);

const startItem = computed(() => {
  if (props.totalItems === 0) return 0;
  return (props.currentPage - 1) * props.pageSize + 1;
});

const endItem = computed(() => {
  return Math.min(props.currentPage * props.pageSize, props.totalItems);
});

const pageNumbers = computed(() => {
  const pages: number[] = [];
  const maxVisible = 7; // Show up to 7 page numbers

  if (props.totalPages <= maxVisible) {
    // Show all pages if we have few enough
    for (let i = 1; i <= props.totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Show pages around current page
    const start = Math.max(1, props.currentPage - 3);
    const end = Math.min(props.totalPages, props.currentPage + 3);

    // Always show first page
    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push(-1); // Ellipsis marker
      }
    }

    // Show pages around current
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Always show last page
    if (end < props.totalPages) {
      if (end < props.totalPages - 1) {
        pages.push(-1); // Ellipsis marker
      }
      pages.push(props.totalPages);
    }
  }

  return pages;
});

// Methods
function goToPage(page: number): void {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage && !props.loading) {
    emit('pageChange', page);
  }
}

function goToPrevious(): void {
  if (hasPrevious.value) {
    goToPage(props.currentPage - 1);
  }
}

function goToNext(): void {
  if (hasNext.value) {
    goToPage(props.currentPage + 1);
  }
}

function changePageSize(newSize: number): void {
  if (newSize !== props.pageSize && !props.loading) {
    emit('pageSizeChange', newSize);
  }
}
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
    <!-- Results Info -->
    <div class="text-sm text-gray-700">
      <span v-if="totalItems > 0">
        Showing {{ startItem }} to {{ endItem }} of {{ totalItems }} results
      </span>
      <span v-else> No results found </span>
    </div>

    <!-- Page Size Selector -->
    <div class="flex items-center gap-2">
      <label for="page-size" class="text-sm text-gray-700">Show:</label>
      <select
        id="page-size"
        :value="pageSize"
        :disabled="loading || false"
        class="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        @change="changePageSize(parseInt(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="size in pageSizes" :key="size" :value="size">
          {{ size }}
        </option>
      </select>
      <span class="text-sm text-gray-700">per page</span>
    </div>

    <!-- Pagination Controls -->
    <nav v-if="totalPages > 1" class="flex items-center gap-1">
      <!-- Previous Button -->
      <button
        :disabled="!hasPrevious || loading || false"
        class="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @click="goToPrevious"
      >
        <ChevronLeftIcon class="w-4 h-4 mr-1" />
        Previous
      </button>

      <!-- Page Numbers -->
      <template v-for="(page, index) in pageNumbers" :key="index">
        <!-- Ellipsis -->
        <span v-if="page === -1" class="px-3 py-2 text-sm font-medium text-gray-500"> ... </span>

        <!-- Page Number -->
        <button
          v-else
          :disabled="loading || false"
          :class="{
            'bg-blue-500 border-blue-500 text-white': page === currentPage,
            'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700':
              page !== currentPage,
          }"
          class="px-3 py-2 text-sm font-medium border disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
      </template>

      <!-- Next Button -->
      <button
        :disabled="!hasNext || loading || false"
        class="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @click="goToNext"
      >
        Next
        <ChevronRightIcon class="w-4 h-4 ml-1" />
      </button>
    </nav>
  </div>
</template>
