
# Pages Feature — Developer Plan

## 0) Scope & Outcomes
Build a file-backed pages system that:
- Serves `/pages/` (root list) and `/pages/:slug` (detail)
- Reads Markdown files from `src/frontend/public/pages/{slug}.md`
- Renders Markdown → HTML (CommonMark + tables, autolinks, footnotes)
- Uses front matter **title** and **date** only; date drives sorting; undated items float to top
- Hides drafts in production
- Moves `privacy-policy.md` and `terms-of-service.md` from `/docs` to `/pages` and **updates links across the site**


---

## 1) Architecture Decisions (ADR)

1. **Content load timing (1B)**  
   - Load Markdown files from disk **at server start**, cache in memory.  
   - Enable **hot-reload** on file changes in dev (watcher invalidates cache + triggers live reload).  
   - Rationale: fast requests, great DX, no rebuilds needed during dev.

2. **Routing (2A)**  
   - Static route table: `/pages/` (list) and `/pages/:slug` (detail).  
   - Unknown slug → **404**.

3. **Slugs (3A)**  
   - Slug = filename (minus `.md`), canonicalized to lowercase + dashes.  
   - Authors must name files as desired final slug.

4. **Front matter schema (4B)**  
   - Allowed keys:  
     - `title: string` (required)  
     - `date: YYYY-MM-DD` (optional; UTC)  
   - **No `description`** field (see SEO handling below).

5. **Sorting semantics (5A, 6A)**  
   - Primary: `date` (UTC).  
   - Undated pages sort **before** any dated pages.  
   - Ties: sort by `title` ASC, then by `slug`.

6. **Drafts (7A)**  
   - `draft: true` respected if present (even though not in core schema; tolerated as optional):  
     - **Prod**: hide from list and direct view (404).  
     - **Dev**: visible in list and direct access.

7. **Markdown rendering (8A)**  
   - CommonMark + GFM tables, autolinks, footnotes.  
   - Output sanitized HTML (block scripts/iframes).  
   - Inline HTML allowed if safe.

8. **Security (9A)**  
   - Sanitize HTML, whitelist safe tags only.  
   - Block `<script>`, `<iframe>`, inline events.

9. **Headings & anchors (10A)**  
   - Auto-generate IDs for all headings (H1–H6).  
   - Optional toggle for local TOC.

10. **Code blocks (11D)**  
    - Render code as plain `<pre>`.  
    - No syntax highlighting (lightest approach).

11. **Images & assets (12A)**  
    - Relative paths supported from `/pages/`.  
    - Images optimized and lazy-loaded.

12. **Internal link handling (13A)**  
    - Rewrite relative links to valid `/pages/:slug`.  
    - Validate links at build, warn on 404s.

13. **External links (14A)**  
    - Open in new tab with `rel="noopener noreferrer"`.  
    - Outbound icon optional.

14. **List page pagination (15C)**  
    - No pagination; list shows **all pages**.  
    - For now assume low page count.

15. **Search & filters (16B)**  
    - No search for MVP.  
    - Filtering postponed.

16. **SEO & metadata (17A)**  
    - Use `title` and first paragraph for `<title>` + meta description.  
    - Canonical URLs + JSON-LD `Article` included.

17. **Sitemap & RSS (18D)**  
    - Neither sitemap nor RSS for MVP.  
    - Can revisit later.

---

## 2) Migration Tasks
- Move `src/frontend/public/docs/privacy-policy.md` → `/pages/privacy-policy.md`  
- Move `src/frontend/public/docs/terms-of-service.md` → `/pages/terms-of-service.md`  
- Update all references across app from `/docs/...` to `/pages/...`  
- Add redirect map `/docs/...` → `/pages/...` (301s)

---

## 3) Milestones & Acceptance

### Milestone 1: File Handling
- [ ] Create `/pages/` folder  
- [ ] Load files at server start  
- [ ] Watch folder in dev

**Acceptance:** Can add new `.md` file and see page on reload in dev.

### Milestone 2: Routing & Rendering
- [ ] `/pages/` → list view, sorted by rules  
- [ ] `/pages/:slug` → render HTML from Markdown  
- [ ] Missing → 404

**Acceptance:** Visiting `/pages/` shows correct list order. Visiting valid slug shows parsed content.

### Milestone 3: Schema & Drafts
- [ ] Parse front matter (`title`, `date`)  
- [ ] Draft handling by env

**Acceptance:** Draft pages visible in dev but hidden in prod.

### Milestone 4: Migration
- [ ] Move privacy-policy and terms-of-service  
- [ ] Update references  
- [ ] Add redirects

**Acceptance:** Old `/docs/...` URLs redirect to `/pages/...`.

### Milestone 5: Polish
- [ ] Security sanitization  
- [ ] Heading IDs + TOC  
- [ ] External links hardened  
- [ ] Images optimized

**Acceptance:** Clean HTML output; links/images behave as spec.

---

## 4) Out of Scope for MVP
- Full-text search  
- Pagination  
- RSS/Sitemap  
- MDX or embeds  
- Controlled tag vocabularies

---



## Orginal brife

There will be many pages associated with this project. These pages will be markdown files with front matter. https://frontmatter.codes/docs/markdown The front matter should not be shown to the users.

The url `/pages/{page_slug}`
The markdown files for these pages should be stored `src\frontend\public\pages\{slug}.md`

If a user goes to the root page `/pages/` then show a list of pages sorted by the frontmatter date `date: YYYY-MM-DD`. If a page does not have a date, then bring it to the top of the list.

These pages should render the markdown as HTML.

Move the `src\frontend\public\docs\privacy-policy.md` and the `src\frontend\public\docs\terms-of-service.md` to the pages folder. then update the links across the website.