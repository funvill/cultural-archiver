<script setup lang="ts">
import { ref, onMounted } from 'vue';
// pages list is now generated at build-time into /pages-manifest.json

interface PageListItem {
  slug: string;
  title: string;
  date: string | undefined;
}

const pages = ref<PageListItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Parse front matter from markdown content
 */
// No runtime front-matter parsing required; manifest contains title/date

const loadPages = async (): Promise<void> => {
  try {
    loading.value = true;
    error.value = null;

    // Load the build-time generated manifest which contains slug/title/date
    const resp = await fetch('/pages-manifest.json');
    if (!resp.ok) throw new Error('Failed to load pages manifest');
  const rawPages = (await resp.json()) as Array<{slug:string;title:string;date:string|null}>;

  // Normalize to PageListItem types (null -> undefined)
  const loadedPages: PageListItem[] = rawPages.map(p => ({ slug: p.slug, title: p.title, date: p.date ?? undefined }));

  // Sort pages: undated first, then by date descending (newest first), then by title
  pages.value = loadedPages.sort((a, b) => {
      // Undated pages first
      if (!a.date && b.date) return -1;
      if (a.date && !b.date) return 1;
      if (!a.date && !b.date) {
        return a.title.localeCompare(b.title);
      }

      // Both have dates, sort by date descending (newest first)
      const dateCompare = b.date!.localeCompare(a.date!);
      if (dateCompare !== 0) return dateCompare;

      // Same date, sort by title ascending
      return a.title.localeCompare(b.title);
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to load pages:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadPages();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Pages</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Documentation, policies, and information
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="max-w-4xl mx-auto px-4 py-8">
      <div class="animate-pulse space-y-4">
        <div class="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="max-w-4xl mx-auto px-4 py-8"
    >
      <div
        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
      >
        <p class="text-red-800 dark:text-red-200">
          Failed to load pages: {{ error }}
        </p>
      </div>
    </div>

    <!-- Pages List -->
    <div v-else class="max-w-4xl mx-auto px-4 py-8">
      <div v-if="pages.length === 0" class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400">No pages available.</p>
      </div>

      <div v-else class="space-y-4">
        <router-link
          v-for="page in pages"
          :key="page.slug"
          :to="`/pages/${page.slug}`"
          class="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ page.title }}
          </h2>
          <p v-if="page.date" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ formatDate(page.date) }}
          </p>
        </router-link>
      </div>
    </div>
  </div>
</template>

