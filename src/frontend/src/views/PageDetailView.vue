<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRouteMeta } from '@/lib/meta';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface PageDetail {
  slug: string;
  title: string;
  date: string | undefined;
  html: string;
}

const route = useRoute();
const router = useRouter();

const page = ref<PageDetail | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const pageWrapper = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const slug = computed(() => route.params.slug as string);

// Configure marked for GFM and heading IDs
marked.setOptions({
  gfm: true,
  breaks: false,
});

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
 * Remove YAML front-matter block from the top of the markdown and return the remaining content.
 * We intentionally avoid gray-matter at runtime; the manifest provides metadata.
 */
const stripFrontMatter = (contentRaw: string): string => {
  // Normalize CRLF
  const content = contentRaw.replace(/\r\n/g, '\n');
  const m = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return content;
  return content.slice(m[0].length);
};

const renderMarkdown = (markdown: string): string => {
  const rawHtml = marked.parse(markdown) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'ul', 'ol', 'li',
      'blockquote', 'code', 'pre',
      'strong', 'em', 'del',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'br', 'hr', 'img', 'sup', 'sub',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'id', 'src', 'alt', 'width', 'height'],
  });
};

const loadPage = async (): Promise<void> => {
  try {
    loading.value = true;
    error.value = null;

    // Load markdown file from public/pages directory
    const response = await fetch(`/pages/${slug.value}.md`);

    if (response.status === 404) {
      error.value = 'Page not found';
      return;
    }

    if (!response.ok) {
      throw new Error(`Failed to load page: ${response.statusText}`);
    }

    const markdownContent = await response.text();

    // Get metadata from manifest (generated at build time)
    let title: string | undefined = undefined;
    let date: string | undefined = undefined;
    try {
      const manifestResp = await fetch('/pages-manifest.json');
      if (manifestResp.ok) {
        const manifest = await manifestResp.json();
        const entry = (manifest as Array<any>).find((p: any) => p.slug === slug.value);
        if (entry) {
          title = entry.title;
          date = entry.date ?? undefined;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch pages manifest for metadata fallbacks:', err);
    }

    const stripped = stripFrontMatter(markdownContent);

    page.value = {
      slug: slug.value,
      title: title || slug.value,
      date: date ?? undefined,
      html: renderMarkdown(stripped),
    };

    // After DOM update, add heading anchors (including the page title)
    await nextTick();
    addHeadingAnchors();

    // Set page title for SEO
    if (page.value && page.value.title) {
      const metadata = {
        title: `${page.value.title} - Public Art Registry`,
        description: (page.value.html || '').replace(/<[^>]+>/g, '').slice(0, 160),
        canonical: `https://publicartregistry.com/pages/${page.value.slug}`,
      } as any;
      useRouteMeta(metadata);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to load page:', err);
  } finally {
    loading.value = false;
  }
};

const goBack = (): void => {
  router.push('/pages');
};

// Add anchor buttons to headings inside the rendered markdown, copy link to clipboard
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
};

const addHeadingAnchors = (): void => {
  const container = (pageWrapper.value ?? contentEl.value) as Element | null;
  if (!container) return;
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6') as NodeListOf<HTMLHeadingElement>;
  headings.forEach((h: HTMLHeadingElement) => {
    if (h.dataset.anchorAttached) return;
    const id = h.id || ((h.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    h.id = id;
    const btn = document.createElement('button');
    btn.className = 'heading-anchor';
    btn.setAttribute('aria-label', 'Copy link to heading');
    btn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.775 3.275a.75.75 0 011.06 1.06L6.56 6.61a2 2 0 102.829 2.828l1.312-1.312a.75.75 0 111.06 1.06L10.45 10.5a3.5 3.5 0 11-4.95-4.95l2.276-2.276z"/></svg>`;
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const url = `${location.origin}${location.pathname}#${id}`;
      copyToClipboard(url);
      // small visual feedback
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1200);
    });
    h.appendChild(btn);
    h.dataset.anchorAttached = '1';
  });
};

onMounted(() => {
  loadPage();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="max-w-4xl mx-auto px-4 py-8">
      <div class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        <div class="space-y-2 mt-8">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="max-w-4xl mx-auto px-4 py-8">
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
          {{ error }}
        </h2>
        <button type="button" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          @click="goBack">
          Back to Pages
        </button>
      </div>
    </div>

    <!-- Page Content -->
    <div v-else-if="page" ref="pageWrapper" class="max-w-6xl px-4 py-8 pl-8">
      <!-- Header -->
      <div class="mb-8">
        <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline mb-4" @click="goBack">
          ← Back to Pages
        </button>

        <h1 class="text-4xl font-bold text-gray-900 dark:text-white">
          {{ page.title }}
        </h1>

        <p v-if="page.date" class="mt-2 text-gray-500 dark:text-gray-400">
          {{ formatDate(page.date) }}
        </p>
      </div>

      <!-- Markdown Content -->
      <div ref="contentEl"
        class="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-md page-content"
        v-html="page.html"></div>
    </div>
  </div>
</template>

<style scoped>
/* Additional prose styling for better readability */
:deep(.prose) {
  color: rgb(31, 41, 55);
}

:deep(.dark .prose) {
  color: rgb(229, 231, 235);
}

:deep(.prose h1) {
  @apply text-gray-900 dark:text-white;
}

:deep(.prose h2) {
  @apply text-gray-900 dark:text-white;
}

:deep(.prose h3) {
  @apply text-gray-900 dark:text-white;
}

:deep(.prose h4) {
  @apply text-gray-900 dark:text-white;
}

:deep(.prose h5) {
  @apply text-gray-900 dark:text-white;
}

:deep(.prose h6) {
  @apply text-gray-900 dark:text-white;
}

:deep(.prose strong) {
  @apply text-gray-900 dark:text-white;
}

:deep(.prose code) {
  @apply bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded;
}

:deep(.prose pre) {
  @apply bg-gray-100 dark:bg-gray-800;
}

:deep(.prose blockquote) {
  @apply border-l-4 border-gray-300 dark:border-gray-700;
}

:deep(.prose table) {
  @apply border-collapse w-full;
}

:deep(.prose th) {
  @apply bg-gray-100 dark:bg-gray-800;
}

:deep(.prose td),
:deep(.prose th) {
  @apply border border-gray-300 dark:border-gray-700 px-4 py-2;
}

/* heading anchor button */
:deep(.page-content) .heading-anchor {
  margin-left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.375rem;
  /* visible red circular badge with black icon/text */
  color: #000000;
  /* black text/icon */
  background: #dc2626;
  /* red-600 */
  border-radius: 9999px;
  /* circular */
  border: none;
  cursor: pointer;
  transition: background 150ms, transform 120ms, opacity 120ms, box-shadow 120ms;
  opacity: 1;
  /* visible by default so it's obvious during testing */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  position: absolute;
  right: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.page-content) .heading-anchor:hover {
  background: rgba(15, 23, 42, 0.04);
  transform: translateY(-1px);
}

:deep(.page-content) .heading-anchor.copied {
  /* show a green background briefly when copied */
  background: #10b981;
  /* green-500 */
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

/* readability improvements */
:deep(.page-content) {
  max-width: 80ch;
  /* ideal line length for readability */
  /* left-align the page content within the centered page container */
  margin-left: 0;
  margin-right: auto;
  font-size: 1.075rem;
  /* slightly larger body text */
  line-height: 1.75;
}

/* Ensure links look like links: always underlined and colored appropriately */
:deep(.page-content) a {
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
  color: #2563eb; /* blue-600 */
}

:deep(.dark .page-content) a {
  color: #60a5fa; /* blue-400 for dark mode */
}

:deep(.page-content) a:hover {
  text-decoration-thickness: 2px;
}

:deep(.page-content) a:visited {
  color: #4c51bf; /* a muted visited color */
}

:deep(.page-content) pre {
  background: rgba(17, 24, 39, 0.04);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow: auto;
}

:deep(.page-content) code {
  background: rgba(243, 244, 246, 1);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}

/* add white space after each paragraph for better readability */
:deep(.page-content) p {
  margin-bottom: 1rem;
}

/* tooltip-like small animation for copied state */
:deep(.page-content) .heading-anchor.copied::after {
  content: 'Copied';
  position: absolute;
  top: -1.75rem;
  left: 50%;
  transform: translateX(-50%);
  background: #111827;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  opacity: 0.95;
}

/* show anchor icon when the heading (or its container) is hovered */
:deep(.page-content) h1:hover .heading-anchor,
:deep(.page-content) h2:hover .heading-anchor,
:deep(.page-content) h3:hover .heading-anchor,
:deep(.page-content) h4:hover .heading-anchor,
:deep(.page-content) h5:hover .heading-anchor,
:deep(.page-content) h6:hover .heading-anchor,
:deep(.page-content) .heading-anchor:hover {
  opacity: 1;
}

/* fallback: reveal anchors when hovering anywhere over the article content */
:deep(.page-content:hover) h1 .heading-anchor,
:deep(.page-content:hover) h2 .heading-anchor,
:deep(.page-content:hover) h3 .heading-anchor,
:deep(.page-content:hover) h4 .heading-anchor,
:deep(.page-content:hover) h5 .heading-anchor,
:deep(.page-content:hover) h6 .heading-anchor {
  opacity: 1;
}

/* make headings a positioned container so absolutely positioned anchors align reliably */
:deep(.page-content) h1,
:deep(.page-content) h2,
:deep(.page-content) h3,
:deep(.page-content) h4,
:deep(.page-content) h5,
:deep(.page-content) h6 {
  position: relative;
  padding-right: 2rem;
  /* space for the anchor */
}

/* show anchor icon when the heading (or its container) is hovered */
:deep(.page-content) h1:hover .heading-anchor,
:deep(.page-content) h2:hover .heading-anchor,
:deep(.page-content) h3:hover .heading-anchor,
:deep(.page-content) h4:hover .heading-anchor,
:deep(.page-content) h5:hover .heading-anchor,
:deep(.page-content) h6:hover .heading-anchor,
:deep(.page-content) .heading-anchor:hover {
  opacity: 1;
}

/* heading typography */
:deep(.page-content) h1 {
  font-size: 2.25rem;
  margin-top: 1.2rem;
  margin-bottom: 0.6rem;
}

:deep(.page-content) h2 {
  font-size: 1.75rem;
  margin-top: 1.1rem;
  margin-bottom: 0.55rem;
}

:deep(.page-content) h3 {
  font-size: 1.375rem;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

:deep(.page-content) h4 {
  font-size: 1.125rem;
  margin-top: 0.9rem;
  margin-bottom: 0.45rem;
}

/* decorative double-line under each heading */
:deep(.page-content) h1::after,
:deep(.page-content) h2::after,
:deep(.page-content) h3::after,
:deep(.page-content) h4::after,
:deep(.page-content) h5::after,
:deep(.page-content) h6::after {
  content: '';
  display: block;
  height: 0.0px;
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  position: relative;
}

:deep(.page-content) h1::after,
:deep(.page-content) h2::after,
:deep(.page-content) h3::after,
:deep(.page-content) h4::after,
:deep(.page-content) h5::after,
:deep(.page-content) h6::after {
  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0.12) 50%, transparent 50%, transparent 100%);
  background-size: 100% 2px;
  background-repeat: no-repeat;
}

/* dark mode variant */
:deep(.dark .page-content) h1::after,
:deep(.dark .page-content) h2::after,
:deep(.dark .page-content) h3::after,
:deep(.dark .page-content) h4::after,
:deep(.dark .page-content) h5::after,
:deep(.dark .page-content) h6::after {
  background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.06) 50%, transparent 50%, transparent 100%);
}

/* lists */
:deep(.page-content) ul {
  margin-left: 1.25rem;
  margin-bottom: 1rem;
  list-style: disc;
  list-style-position: outside;
}

:deep(.page-content) ol {
  margin-left: 1.25rem;
  margin-bottom: 1rem;
  list-style: decimal;
  list-style-position: outside;
}

:deep(.page-content) ul li,
:deep(.page-content) ol li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}
</style>
