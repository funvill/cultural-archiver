// Minimal HTML sanitizer used to strip scripts and dangerous attributes from user-supplied
// (or imported) markdown/html. It's intentionally conservative. For stronger protection
// consider adding DOMPurify to the project.

export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return input
    // Remove script tags and their content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove style tags (avoid CSS-based attacks)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove on* event handlers like onclick="..."
    .replace(/ on[a-zA-Z]+=\"[^\"]*\"/g, '')
    .replace(/ on[a-zA-Z]+=\'[^\']*\'/g, '')
    // Remove javascript: URIs
    .replace(/href\s*=\s*\"javascript:[^\"]*\"/gi, 'href="#"')
    .replace(/href\s*=\s*\'javascript:[^\']*\'/gi, "href='#'");
}
