import { defineComponent, ref, computed, onMounted, mergeProps, nextTick, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { _ as _export_sfc } from '../ssr-entry-server.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PageDetailView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    useRouter();
    const page = ref(null);
    const contentEl = ref(null);
    const pageWrapper = ref(null);
    const loading = ref(true);
    const error = ref(null);
    const slug = computed(() => route.params.slug);
    marked.setOptions({
      gfm: true,
      breaks: false
    });
    const formatDate = (dateStr) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });
      } catch {
        return dateStr;
      }
    };
    const stripFrontMatter = (contentRaw) => {
      const content = contentRaw.replace(/\r\n/g, "\n");
      const m = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
      if (!m) return content;
      return content.slice(m[0].length);
    };
    const renderMarkdown = (markdown) => {
      const rawHtml = marked.parse(markdown);
      return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",
          "a",
          "ul",
          "ol",
          "li",
          "blockquote",
          "code",
          "pre",
          "strong",
          "em",
          "del",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "br",
          "hr",
          "img",
          "sup",
          "sub"
        ],
        ALLOWED_ATTR: ["href", "title", "target", "rel", "id", "src", "alt", "width", "height"]
      });
    };
    const loadPage = async () => {
      try {
        loading.value = true;
        error.value = null;
        const response = await fetch(`/pages/${slug.value}.md`);
        if (response.status === 404) {
          error.value = "Page not found";
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to load page: ${response.statusText}`);
        }
        const markdownContent = await response.text();
        let title = void 0;
        let date = void 0;
        try {
          const manifestResp = await fetch("/pages-manifest.json");
          if (manifestResp.ok) {
            const manifest = await manifestResp.json();
            const entry = manifest.find((p) => p.slug === slug.value);
            if (entry) {
              title = entry.title;
              date = entry.date ?? void 0;
            }
          }
        } catch (err) {
          console.warn("Failed to fetch pages manifest for metadata fallbacks:", err);
        }
        const stripped = stripFrontMatter(markdownContent);
        page.value = {
          slug: slug.value,
          title: title || slug.value,
          date: date ?? void 0,
          html: renderMarkdown(stripped)
        };
        await nextTick();
        addHeadingAnchors();
        if (page.value && page.value.title) {
          document.title = `${page.value.title} - Public Art Registry`;
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to load page:", err);
      } finally {
        loading.value = false;
      }
    };
    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    };
    const addHeadingAnchors = () => {
      const container = pageWrapper.value ?? contentEl.value;
      if (!container) return;
      const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      headings.forEach((h) => {
        if (h.dataset.anchorAttached) return;
        const id = h.id || (h.textContent || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        h.id = id;
        const btn = document.createElement("button");
        btn.className = "heading-anchor";
        btn.setAttribute("aria-label", "Copy link to heading");
        btn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.775 3.275a.75.75 0 011.06 1.06L6.56 6.61a2 2 0 102.829 2.828l1.312-1.312a.75.75 0 111.06 1.06L10.45 10.5a3.5 3.5 0 11-4.95-4.95l2.276-2.276z"/></svg>`;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const url = `${location.origin}${location.pathname}#${id}`;
          copyToClipboard(url);
          btn.classList.add("copied");
          setTimeout(() => btn.classList.remove("copied"), 1200);
        });
        h.appendChild(btn);
        h.dataset.anchorAttached = "1";
      });
    };
    onMounted(() => {
      loadPage();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 dark:bg-gray-900" }, _attrs))} data-v-797a5a3a>`);
      if (loading.value) {
        _push(`<div class="max-w-4xl mx-auto px-4 py-8" data-v-797a5a3a><div class="animate-pulse space-y-4" data-v-797a5a3a><div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" data-v-797a5a3a></div><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" data-v-797a5a3a></div><div class="space-y-2 mt-8" data-v-797a5a3a><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" data-v-797a5a3a></div><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" data-v-797a5a3a></div><div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" data-v-797a5a3a></div></div></div></div>`);
      } else if (error.value) {
        _push(`<div class="max-w-4xl mx-auto px-4 py-8" data-v-797a5a3a><div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6" data-v-797a5a3a><h2 class="text-xl font-semibold text-red-800 dark:text-red-200 mb-2" data-v-797a5a3a>${ssrInterpolate(error.value)}</h2><button type="button" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors" data-v-797a5a3a> Back to Pages </button></div></div>`);
      } else if (page.value) {
        _push(`<div class="max-w-6xl px-4 py-8 pl-8" data-v-797a5a3a><div class="mb-8" data-v-797a5a3a><button type="button" class="text-blue-600 dark:text-blue-400 hover:underline mb-4" data-v-797a5a3a> ← Back to Pages </button><h1 class="text-4xl font-bold text-gray-900 dark:text-white" data-v-797a5a3a>${ssrInterpolate(page.value.title)}</h1>`);
        if (page.value.date) {
          _push(`<p class="mt-2 text-gray-500 dark:text-gray-400" data-v-797a5a3a>${ssrInterpolate(formatDate(page.value.date))}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-md page-content" data-v-797a5a3a>${page.value.html ?? ""}</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/PageDetailView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const PageDetailView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-797a5a3a"]]);

export { PageDetailView as default };
//# sourceMappingURL=PageDetailView-G4A8Ecst.js.map
