# Artwork details page — PRD (handoff-ready)

Purpose
-------
This document describes the redesigned Artwork Details page and the minimal implementation plan required to bring the frontend in line with product decisions. It's written for engineers picking up the work — it removes the interview-style questions and consolidates decisions, priorities, and acceptance criteria.

High-level summary
------------------
- Layout: single centered column on mobile; three-column responsive layout on desktop (main photo/content area + sidebar). The carousel sits at the top of the main column and stretches full-width of the content column.
- Photos: full-width carousel with swipe, arrows, and dots; images center-cropped for visual consistency.
- Location: mini-map in the sidebar with a human-readable address below and a "Directions" button that opens Google Maps with coordinates.
- Actions: primary actions (Edit, Add Log) visible near the title; secondary actions consolidated into an overflow.

## Purpose

This document describes the redesigned Artwork Details page and the minimal implementation plan required to bring the frontend in line with product decisions. It's written for engineers picking up the work — it removes the interview-style questions and consolidates decisions, priorities, and acceptance criteria.

## High-level summary

- Layout: single centered column on mobile; three-column responsive layout on desktop (main photo/content area + sidebar). The carousel sits at the top of the main column and stretches full-width of the content column.
- Photos: full-width carousel with swipe, arrows, and dots; images center-cropped for visual consistency.
- Location: mini-map in the sidebar with a human-readable address below and a "Directions" button that opens Google Maps with coordinates.
- Actions: primary actions (Edit, Add Log) visible near the title; secondary actions consolidated into an overflow.

## Design sketch

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

## Decisions (condensed)

- Carousel: full-width within content column; center-cropped images; dots, arrows, swipe enabled.
- Header actions: show Edit and Add Log inline for logged-in users; secondary actions in overflow.
- Location format: District, City, State, Country (see `tasks/prd-human-readable-location.md` and `src/lib/location`).
- Directions: open Google Maps web directions in a new tab with coordinates.
- Tags: clickable chips; add a small search icon next to each tag that routes to the search page; tag text remains selectable.
- License: show icon + short label linking to full license details; include machine-readable license code in metadata.
- Description: show full-length description (rendered from markdown with sanitizer).
- Edit flow: keep submit-for-review model (edits posted to API, moderator review). UI: allow logged-in users to enter edit mode; server-side checks remain authoritative.
- Analytics: collect anonymized view counts; display view count (badge) near the title.
- Scope: defer heavy work (full accessibility sweep, photo editing, offline caching, related recommendations) to future sprints.

## Implementation plan — minimal, prioritized

Goal: implement low-risk UI changes that map the current code to product decisions. Defer large features.

### Priority 1 — MVP UI changes (low-risk)

- Show Edit to any logged-in user (UI change only). Keep server-side permission checks.
- Add a "Directions" button under MiniMap that opens Google Maps with the artwork's lat/lon.
- Add a small search icon beside tag chips that navigates to the search page for that tag; preserve existing tag click behavior and text selection.

### Files likely to change (first PR)

- `src/frontend/src/views/ArtworkDetailView.vue` — adjust `canEdit` computed, add Directions button, action bar adjustments, display view count badge.
- `src/frontend/src/components/TagBadge.vue` (or wherever tag chips are rendered) — add search icon and emit navigation event.
- `src/frontend/src/stores/artworks` — optional: provide view count or expose existing field.

## Acceptance criteria (MVP PR)

- Frontend builds without errors (run `npm run build:frontend` locally).
- Logged-in users see the Edit and Add Log actions as specified; server-side checks still prevent unauthorized edits.
- Clicking Directions opens a new tab to Google Maps with the correct coordinates.
- Tag search icon navigates to `/search/<term>`; tag text selection and existing clicks behave as before.



## Contacts

- Product owner: (add name/email)
- Design: (add name/email)

## Change log

- 2025-09-24: Cleaned up interactive draft into handoff-ready PRD and added a minimal implementation plan.

## Appendix: Full Q&A answers (preserved)

This appendix contains the original question-and-answer selections made during the interactive design session. Keep this section as a reference for product decisions.

Q1: 1A — Full-width carousel, centered-crop, dots/arrows/swipe.

Q2: Show both Edit and Add Log inline.

Q3: 3A — Small interactive mini-map with Directions button opening maps in new tab.

Q4: Three columns for Information & Details.

Q5: 5A — Overlay caption bottom-left; dots/arrows overlay bottom.

Q6: 6A — Lazy-load neighboring slides and prefetch next.

Q7: Edit and Add Log visible to logged-in users.

Q8: District, City, State, Country (see `tasks/prd-human-readable-location.md`).

Q9: 9A — Open Google Maps web directions with coordinates.

Q10: 10A — Left: Tags & Materials; Center: Artist/Title/Year/Description; Right: License/Status/Dates/Attribution.

Q11: Clickable tag chips that navigate to search.

Q12: 12A — License icon + short label with link + machine-readable code.

Q13: 13A — Mobile stack: carousel, title/actions, map, details.

Q14: Accessibility deferred (basic alt text only).

Q15: Full-length description.

Q16: 16C — Omit credits from UI, keep in metadata.

Q17: 17C — No download UI, but don't block programmatic downloads.

Q18: 18A — Copy link, native share sheet, quick social links.

Q19: 19B — Hide versioning/edit history from public (admin-only).

Q20: 20B — Do not show moderation status publicly.

Q21: 21B — No related-artworks recommendations on page.

Q22: 22C — Inline editable fields on page.

Q23: 23A — Collect anonymized view counts and display simple count.

Q24: 24B — Minimal offline support; generic offline banner.

Q25: 25A — Show Edit to any logged-in user; server-side checks remain.

Q26: 26A — Keep submit-for-review flow for edits.

Q27: 27 — Defer heavy features (accessibility sweep, photo editing, related recommendations, offline-first caching).

Q28: Add search icon next to tag; allow tag text selectable.

Q29: 29A — Directions open Google Maps.

Q30: No download UI.

Q31: 31A — Consolidate actions into action bar with overflow.

Q32: 32B — Show view counts as a prominent badge near title.

Q33: 33C — Use a separate dedicated edit page with full form and more fields.
