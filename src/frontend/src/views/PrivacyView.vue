<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { marked } from 'marked';
<<<<<<< HEAD
import { sanitizeHtml } from '../utils/sanitizeHtml';
=======
import { sanitizeHtml } from '../utils/sanitize';
>>>>>>> 79cbe81 (data-collectors, linting)

const privacyContent = ref<string>('');
const isLoading = ref<boolean>(true);
const error = ref<string>('');

onMounted(async () => {
  try {
    // Fetch the privacy policy markdown file
    const response = await fetch('/docs/privacy-policy.md');
    if (!response.ok) {
      throw new Error(`Failed to load privacy policy: ${response.status}`);
    }

    const markdownContent = await response.text();

    // Configure marked for security and proper rendering
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

<<<<<<< HEAD
  // Parse markdown to HTML and sanitize before binding
  privacyContent.value = sanitizeHtml(await marked(markdownContent));
=======
  // Parse markdown to HTML and sanitize before assigning
  const html = (marked.parse(markdownContent) as string);
  privacyContent.value = sanitizeHtml(html);
>>>>>>> 79cbe81 (data-collectors, linting)
  } catch (err) {
    console.error('Error loading privacy policy:', err);
    error.value = 'Failed to load privacy policy. Please try again later.';
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="bg-white rounded-lg shadow-md p-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-8">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        ></div>
        <p class="mt-2 text-gray-600">Loading privacy policy...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8">
        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-red-800 mb-2">Unable to Load Privacy Policy</h2>
          <p class="text-red-600">{{ error }}</p>
          <button
            @click="$router.go(0)"
            class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Content -->
      <!-- eslint-disable-next-line vue/no-v-html -- TODO: sanitize privacy markdown content before binding -->
      <div
        v-else
        class="prose prose-blue max-w-none prose-headings:text-gray-900 prose-a:text-blue-600 prose-a:hover:text-blue-800"
        v-html="privacyContent"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling for markdown content */
:deep(.prose) {
  @apply text-gray-700;
}

:deep(.prose h1) {
  @apply text-3xl font-bold mb-6;
}

:deep(.prose h2) {
  @apply text-2xl font-semibold mt-8 mb-4;
}

:deep(.prose h3) {
  @apply text-xl font-semibold mt-6 mb-3;
}

:deep(.prose p) {
  @apply mb-4 leading-relaxed;
}

:deep(.prose ul) {
  @apply mb-4;
}

:deep(.prose li) {
  @apply mb-1;
}

:deep(.prose a) {
  @apply underline transition-colors;
}

:deep(.prose strong) {
  @apply font-semibold text-gray-900;
}

:deep(.prose code) {
  @apply bg-gray-100 px-1 py-0.5 rounded text-sm font-mono;
}

:deep(.prose pre) {
  @apply bg-gray-100 p-4 rounded-lg overflow-x-auto;
}

:deep(.prose blockquote) {
  @apply border-l-4 border-blue-200 pl-4 italic text-gray-600;
}

:deep(.prose hr) {
  @apply my-8 border-gray-300;
}

:deep(.prose table) {
  @apply w-full border-collapse border border-gray-300;
}

:deep(.prose th) {
  @apply bg-gray-50 p-2 border border-gray-300 font-semibold text-left;
}

:deep(.prose td) {
  @apply p-2 border border-gray-300;
}
</style>
