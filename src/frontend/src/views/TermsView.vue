<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { marked } from 'marked';
<<<<<<< HEAD
import { sanitizeHtml } from '../utils/sanitizeHtml';
=======
import { sanitizeHtml } from '../utils/sanitize';
>>>>>>> 79cbe81 (data-collectors, linting)

const termsContent = ref<string>('');
const isLoading = ref<boolean>(true);
const error = ref<string>('');

onMounted(async () => {
  try {
    // Fetch the terms of service markdown file
    const response = await fetch('/docs/terms-of-service.md');
    if (!response.ok) {
      throw new Error(`Failed to load terms of service: ${response.status}`);
    }

    const markdownContent = await response.text();

    // Configure marked for security and proper rendering
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

<<<<<<< HEAD
  // Parse markdown to HTML and sanitize before binding
  termsContent.value = sanitizeHtml(await marked(markdownContent));
=======
  // Parse markdown to HTML and sanitize before assigning
  const html = (marked.parse(markdownContent) as string);
  termsContent.value = sanitizeHtml(html);
>>>>>>> 79cbe81 (data-collectors, linting)
  } catch (err) {
    console.error('Error loading terms of service:', err);
    error.value = 'Failed to load terms of service. Please try again later.';
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
          class="inline-block animate-spin rounded-full h-8 w-8 border-b-2"
          style="border-color: rgb(var(--md-primary));"
        ></div>
        <p class="mt-2 theme-muted">Loading terms of service...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8">
        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 class="text-xl font-semibold theme-on-error mb-2">Unable to Load Terms of Service</h2>
          <p class="theme-on-error">{{ error }}</p>
          <button
            @click="$router.go(0)"
            class="mt-4 px-4 py-2 theme-error rounded hover:opacity-95 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Content -->
      <div
        v-else
        class="prose prose-blue max-w-none theme-on-surface"
        v-html="termsContent"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling for markdown content using theme variables */
:deep(.prose) {
  color: var(--md-on-surface, #374151);
}

:deep(.prose h1) {
  font-size: 1.875rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  color: var(--md-on-background, #111827);
}

:deep(.prose h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: var(--md-on-background, #111827);
}

:deep(.prose h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: var(--md-on-background, #111827);
}

:deep(.prose p) {
  margin-bottom: 1rem;
  line-height: 1.625;
}

:deep(.prose ul) {
  margin-bottom: 1rem;
}

:deep(.prose li) {
  margin-bottom: 0.25rem;
}

:deep(.prose a) {
  text-decoration: underline;
  transition: color 0.15s ease-in-out;
  color: var(--md-primary, #2563eb);
}

:deep(.prose a:hover) {
  color: var(--md-primary, #1d4ed8);
}

:deep(.prose strong) {
  font-weight: 600;
  color: var(--md-on-background, #111827);
}

:deep(.prose code) {
  background-color: var(--md-surface-variant, #f3f4f6);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-family: ui-monospace, monospace;
}

:deep(.prose pre) {
  background-color: var(--md-surface-variant, #f3f4f6);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}

:deep(.prose blockquote) {
  border-left: 4px solid var(--md-primary-container, #dbeafe);
  padding-left: 1rem;
  font-style: italic;
  color: var(--md-on-surface-variant, #6b7280);
}

:deep(.prose hr) {
  margin: 2rem 0;
  border-color: var(--md-outline, #d1d5db);
}

:deep(.prose table) {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--md-outline, #d1d5db);
}

:deep(.prose th) {
  background-color: var(--md-surface-variant, #f9fafb);
  padding: 0.5rem;
  border: 1px solid var(--md-outline, #d1d5db);
  font-weight: 600;
  text-align: left;
}

:deep(.prose td) {
  padding: 0.5rem;
  border: 1px solid var(--md-outline, #d1d5db);
}
</style>
