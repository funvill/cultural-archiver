<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
// pages list is now generated at build-time into /pages-manifest.json

interface PageListItem {
  slug: string;
  title: string;
  date: string | undefined;
  category: string | undefined;
}

interface CategoryGroup {
  name: string;
  count: number;
  pages: PageListItem[];
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
 * Group pages by category
 */
const categorizedPages = computed<CategoryGroup[]>(() => {
  const groups = new Map<string, PageListItem[]>();
  
  // Group pages by category
  pages.value.forEach(page => {
    const categoryName = page.category || 'Uncategorized';
    if (!groups.has(categoryName)) {
      groups.set(categoryName, []);
    }
    groups.get(categoryName)!.push(page);
  });
  
  // Convert to array and sort by category name (Uncategorized first)
  const categoryGroups: CategoryGroup[] = Array.from(groups.entries()).map(([name, pageList]) => ({
    name,
    count: pageList.length,
    pages: pageList,
  }));
  
  // Sort: Uncategorized first, then alphabetically
  categoryGroups.sort((a, b) => {
    if (a.name === 'Uncategorized') return -1;
    if (b.name === 'Uncategorized') return 1;
    return a.name.localeCompare(b.name);
  });
  
  return categoryGroups;
});

/**
 * Parse front matter from markdown content
 */
// No runtime front-matter parsing required; manifest contains title/date/category

const loadPages = async (): Promise<void> => {
  try {
    loading.value = true;
    error.value = null;

    // Load the build-time generated manifest which contains slug/title/date/category
    const resp = await fetch('/pages-manifest.json');
    if (!resp.ok) throw new Error('Failed to load pages manifest');
    const rawPages = (await resp.json()) as Array<{slug:string;title:string;date:string|null;category:string|null}>;

    // Normalize to PageListItem types (null -> undefined)
    const loadedPages: PageListItem[] = rawPages.map(p => ({ 
      slug: p.slug, 
      title: p.title, 
      date: p.date ?? undefined,
      category: p.category ?? undefined,
    }));

    // Pages are already sorted by the manifest generator (category, then date, then title)
    pages.value = loadedPages;
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

    <!-- Pages List with Categories -->
    <div v-else class="max-w-4xl mx-auto px-4 py-8">
      <div v-if="pages.length === 0" class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400">No pages available.</p>
      </div>

      <div v-else class="space-y-8">
        <!-- Table of Contents -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Categories</h2>
          <nav class="space-y-2">
            <a
              v-for="category in categorizedPages"
              :key="category.name"
              :href="`#category-${category.name.toLowerCase().replace(/\s+/g, '-')}`"
              class="flex justify-between items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <span class="text-gray-900 dark:text-white">{{ category.name }}</span>
              <span class="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {{ category.count }}
              </span>
            </a>
          </nav>
        </div>

        <!-- Pages by Category -->
        <div
          v-for="category in categorizedPages"
          :key="category.name"
          class="space-y-4"
        >
          <h2
            :id="`category-${category.name.toLowerCase().replace(/\s+/g, '-')}`"
            class="text-2xl font-bold text-gray-900 dark:text-white pt-4"
          >
            {{ category.name }}
            <span class="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">
              ({{ category.count }})
            </span>
          </h2>
          
          <div class="space-y-3">
            <router-link
              v-for="page in category.pages"
              :key="page.slug"
              :to="`/pages/${page.slug}`"
              class="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all"
            >
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ page.title }}
              </h3>
              <p v-if="page.date" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ formatDate(page.date) }}
              </p>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

