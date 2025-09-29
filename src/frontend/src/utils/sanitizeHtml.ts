import DOMPurify from 'dompurify';

// Use DOMPurify to sanitize HTML produced by markdown renderer (marked).
// Keep allowed tags minimal and strip event handlers and javascript: URIs.
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  // DOMPurify defaults are safe for most cases; configure to be explicit.
  // Use DOMPurify.sanitize directly - DOMPurify will use the global window in browser env
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'a', 'b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'span', 'blockquote', 'code', 'pre', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ],
    ALLOWED_ATTR: ['href', 'title', 'rel'],
    FORCE_BODY: true,
  });
}
