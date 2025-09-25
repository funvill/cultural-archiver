# Artwork Details Page - PRD (handoff-ready)

## Purpose
This document describes the redesigned Artwork Details page and the minimal implementation plan required to bring the frontend in line with current product decisions. It replaces the interview-style notes with consolidated decisions, priorities, and acceptance criteria for engineers picking up the work.

## High-level Summary
- Carousel first: deliver the full-width, center-cropped carousel with swipe, arrows, dots, caption overlay, and slide prefetching before any other UI work.
- Layout: single centered column on mobile, Carousel spans the width of the main content column.
- Photos: full-width carousel with swipe, arrows, and dots; images are center-cropped for consistency.
- Location: interactive mini-map in the sidebar, followed by a human-readable address and a Directions button that opens Google Maps with coordinates.
- Actions: primary actions (Edit, Add Log) stay visible near the title; secondary actions live in an overflow menu.
- Analytics: display an anonymized view-count badge near the title.

## Design Sketch
```text
*----------------------------------------*
| Artwork carousel                       |
*----------------------------------------*
# {Artwork Name}                   [Edit]
## By {Artist Name}             [Add Log]

## Description
{Description}

## Location
*----------------------------------------*
| Mini map (interactive)                 |
*----------------------------------------*
{District, City, State, Country}
[Directions]

## Information & Details (three columns on desktop)
Left: Tags & Materials | Center: Artist, Title, Year, Description | Right: License, Dates, Source

## License
```

## Key Decisions
- Carousel: full-width within content column; center-cropped images; dots, arrows, and swipe gestures enabled; caption and controls overlay the image bottom edge; lazy-load neighboring slides and prefetch the next.
- Header actions: show Edit and Add Log inline for logged-in users; keep secondary actions in overflow.
- Location format: display District, City, State, Country (see `tasks/prd-human-readable-location.md` and `src/lib/location`).
- Directions: open Google Maps web directions in a new tab using the artwork coordinates.
- Tags: clickable chips with an additional search icon that routes to the search page; tag text remains selectable.
- License: show icon plus short label linking to full license details; include machine-readable license code in metadata.
- Description: render the full markdown description with sanitization.
- Edit flow: retain submit-for-review model; server-side permissions stay authoritative even if UI surfaces edit actions.
- Analytics: collect and surface anonymized view counts through a badge.
- Scope guardrails: defer the heavier investments (accessibility sweep, photo editing, offline caching, related recommendations) to later sprints.

## Implementation Plan (minimal, prioritized)

### Scope
Deliver frontend changes in iterative slices. Complete the carousel revamp before proceeding to the supporting UI adjustments.

### Priority 0 - Carousel Revamp (blocking)
- Rebuild the artwork carousel so it fills the content column, center-crops imagery, and keeps captions/controls overlaid along the lower edge.
- Support swipe gestures on touch, keyboard navigation, arrow buttons, and pagination dots on desktop.
- Implement lazy-loading for neighboring slides and prefetch the next slide asset to reduce flicker.
- Ensure accessibility: announce active slide, expose controls with proper labels, and keep focus states visible.
- Confirm responsive behavior: stacked layout on mobile, three-column context on desktop with carousel height target agreed with design.

### Priority 1 - Supporting UI changes
- Show Edit to any logged-in user (UI-only change; backend permissions unchanged).
- Add a Directions button under the mini-map that opens Google Maps with the artwork latitude/longitude.
- Add a small search icon beside each tag chip that navigates to the search page for that tag while retaining existing tag behavior.
- Surface the anonymized view-count badge near the title.

### Files Likely to Change (first PRs)
- `src/frontend/src/views/ArtworkDetailView.vue`: integrate revamped carousel component, adjust layout, update action bar, add Directions button, render view-count badge.
- `src/frontend/src/components/ArtworkCarousel.vue` (or equivalent): implement new carousel behavior, overlays, and accessibility improvements.
- `src/frontend/src/components/TagBadge.vue` (or equivalent tag chip component): append search icon and emit navigation event.
- `src/frontend/src/stores/artworks`: ensure carousel data (images, captions) and view count fields are exposed from the store.

### Deferred
- Full accessibility review and remediation beyond carousel and new UI affordances.
- Image editing or reprocessing.
- Offline-first caching strategy.
- Related artwork recommendations.
- Exposing moderation status or version history to the public.

## Acceptance Criteria (MVP PR)
- Frontend builds without errors (`npm run build:frontend`).
- Carousel meets interaction specs: swipe on touch, keyboard left/right navigation, arrow buttons, dots updating active state, caption overlay visible, next slide prefetch verified in code review.
- Carousel images render center-cropped without layout shifts across breakpoints.
- Logged-in users can see Edit and Add Log actions in the header as specified; unauthorized edits remain blocked server-side.
- Clicking Directions opens Google Maps in a new tab with the correct coordinates.
- The tag search icon navigates to `/search/<term>` while preserving tag text selection and existing click behavior.
- View-count badge appears near the title and reflects the anonymized metric.

## To-do
- Provide final contact details for product and design stakeholders.
- Deliver carousel design assets: breakpoints, overlay specs, animation timings, loading skeleton if any.
- Confirm analytics instrumentation for carousel interactions (slide change, swipe) and the view-count badge.
- Document fallbacks when artwork lacks multiple photos, captions, or when images fail to load.
- Align with backend team on any data contract changes (image metadata, view counts, location formatting).
- Prepare QA checklist covering carousel interactions, responsive layout, map interactions, and accessibility smoke test.

## Contacts
- Product owner: (add name/email)
- Design: (add name/email)

## Change Log
- 2025-09-24: Cleaned up interactive draft into handoff-ready PRD and added a minimal implementation plan.
- 2025-09-25: Reprioritized carousel work as the first deliverable and expanded acceptance criteria.

## Appendix: Full Q&A answers (preserved)
This appendix contains the original question-and-answer selections from the interactive design session and should remain as a reference for product decisions.

Q1: 1A - Full-width carousel, centered-crop, dots/arrows/swipe.
Q2: Show both Edit and Add Log inline.
Q3: 3A - Small interactive mini-map with Directions button opening maps in new tab.
Q4: Three columns for Information & Details.
Q5: 5A - Overlay caption bottom-left; dots/arrows overlay bottom.
Q6: 6A - Lazy-load neighboring slides and prefetch next.
Q7: Edit and Add Log visible to logged-in users.
Q8: District, City, State, Country (see `tasks/prd-human-readable-location.md`).
Q9: 9A - Open Google Maps web directions with coordinates.
Q10: 10A - Left: Tags & Materials; Center: Artist/Title/Year/Description; Right: License/Status/Dates/Attribution.
Q11: Clickable tag chips that navigate to search.
Q12: 12A - License icon + short label with link + machine-readable code.
Q13: 13A - Mobile stack: carousel, title/actions, map, details.
Q14: Accessibility deferred (basic alt text only).
Q15: Full-length description.
Q16: 16C - Omit credits from UI, keep in metadata.
Q17: 17C - No download UI, but do not block programmatic downloads.
Q18: 18A - Copy link, native share sheet, quick social links.
Q19: 19B - Hide versioning/edit history from public (admin-only).
Q20: 20B - Do not show moderation status publicly.
Q21: 21B - No related-artworks recommendations on page.
Q22: 22C - Inline editable fields on page.
Q23: 23A - Collect anonymized view counts and display simple count.
Q24: 24B - Minimal offline support; generic offline banner.
Q25: 25A - Show Edit to any logged-in user; server-side checks remain.
Q26: 26A - Keep submit-for-review flow for edits.
Q27: 27 - Defer heavy features (accessibility sweep, photo editing, related recommendations, offline-first caching).
Q28: Add search icon next to tag; allow tag text selectable.
Q29: 29A - Directions open Google Maps.
Q30: No download UI.
Q31: 31A - Consolidate actions into action bar with overflow.
Q32: 32B - Show view counts as a prominent badge near title.
Q33: 33C - Use a separate dedicated edit page with full form and more fields.
