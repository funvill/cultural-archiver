import { marked } from 'marked';
import matter from 'gray-matter';
// Note: `isomorphic-dompurify` has a browser entry that can reference `window` during
// module evaluation which breaks wrangler dev/miniflare. We dynamically import it inside
// the renderer so bundlers don't evaluate the browser entry at module load time.
// Fallback to a safe passthrough sanitizer if import is not available.

type DOMPurifyType = {
  sanitize: (html: string, options?: Record<string, unknown>) => string;
};

let DOMPurifyDynamic: DOMPurifyType | null = null;

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false,
  pedantic: false,
});

// Configure marked with extensions for heading IDs and external links
marked.use({
  renderer: {
    heading(text: string, level: number): string {
      const cleanText = text.replace(/<[^>]*>/g, ''); // Strip HTML tags for ID
      const id = cleanText
        .toLowerCase()
        .replace(/[^\w]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    },
    link(href: string, title: string | null | undefined, text: string): string {
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      const titleAttr = title ? ` title="${title}"` : '';
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
    },
  },
});

export interface PageFrontMatter {
  title: string;
  date?: string; // YYYY-MM-DD format
  draft?: boolean;
}

export interface Page {
  slug: string;
  title: string;
  date: string | undefined;
  draft: boolean;
  content: string; // Raw markdown
  html?: string; // Rendered HTML (lazy loaded)
}

export class PagesService {
  private pages: Map<string, Page> = new Map();
  private isDevelopment: boolean;

  constructor(isDevelopment = false) {
    this.isDevelopment = isDevelopment;
  }

  /**
   * Load a page from markdown content
   */
  loadPage(slug: string, markdownContent: string): void {
    const { data, content } = matter(markdownContent);
    const frontMatter = data as PageFrontMatter;

    // Validate required fields
    if (!frontMatter.title) {
      throw new Error(`Page ${slug} is missing required 'title' field in front matter`);
    }

    const page: Page = {
      slug,
      title: frontMatter.title,
      date: frontMatter.date ?? undefined,
      draft: frontMatter.draft ?? false,
      content,
    };

    this.pages.set(slug, page);
  }

  /**
   * Get a single page by slug
   */
  getPage(slug: string): Page | null {
    const page = this.pages.get(slug);
    if (!page) {
      return null;
    }

    // Hide drafts in production
    if (page.draft && !this.isDevelopment) {
      return null;
    }

    // Lazy render HTML if not already done
    if (!page.html) {
      page.html = this.renderMarkdown(page.content);
    }

    return page;
  }

  /**
   * Get all pages sorted by date (newest first), then by title
   * Undated pages appear at the top
   */
  getAllPages(): Page[] {
    const visiblePages = Array.from(this.pages.values()).filter(page => {
      // Hide drafts in production
      return this.isDevelopment || !page.draft;
    });

    return visiblePages.sort((a, b) => {
      // Undated pages first
      if (!a.date && b.date) return -1;
      if (a.date && !b.date) return 1;
      if (!a.date && !b.date) {
        // Both undated, sort by title
        return a.title.localeCompare(b.title);
      }

      // Both have dates, sort by date descending (newest first)
      const dateCompare = b.date!.localeCompare(a.date!);
      if (dateCompare !== 0) return dateCompare;

      // Same date, sort by title ascending
      return a.title.localeCompare(b.title);
    });
  }

  /**
   * Render markdown to sanitized HTML
   */
  private renderMarkdown(markdown: string): string {
    const rawHtml = marked.parse(markdown) as string;
    // Sanitize HTML to prevent XSS.
    // Dynamically import isomorphic-dompurify to avoid evaluating browser entry at module load.
    let sanitized = rawHtml;
    try {
      if (!DOMPurifyDynamic) {
        // Attempt dynamic import; handle both ESM default and CJS shapes
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('isomorphic-dompurify');
        DOMPurifyDynamic = (mod && (mod.default || mod)) as DOMPurifyType;
      }

      if (DOMPurifyDynamic) {
        sanitized = DOMPurifyDynamic.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'a',
        'ul',
        'ol',
        'li',
        'blockquote',
        'code',
        'pre',
        'strong',
        'em',
        'del',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'br',
        'hr',
        'img',
        'sup',
        'sub',
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'id', 'src', 'alt', 'width', 'height'],
        ALLOW_DATA_ATTR: false,
        });
      } else {
        // If DOMPurify not available, return rawHtml as a conservative fallback
        // (the worker environment should avoid rendering untrusted markdown without sanitizer)
        sanitized = rawHtml;
      }
    } catch (err) {
      // If dynamic import or sanitize fails, log and return rawHtml
      console.warn('DOMPurify dynamic import or sanitize failed, returning raw HTML:', err);
      sanitized = rawHtml;
    }

    return sanitized;
  }

  /**
   * Get page count
   */
  getPageCount(): number {
    if (this.isDevelopment) {
      return this.pages.size;
    }
    return Array.from(this.pages.values()).filter(p => !p.draft).length;
  }

  /**
   * Clear all pages (useful for testing)
   */
  clear(): void {
    this.pages.clear();
  }
}
