# PRD: Artwork and Artist Index Pages

This document outlines the product requirements for creating browsable index pages for all approved artworks and artists.

## 1. Overview

### 1.1. Purpose

The primary goal is to provide a simple, comprehensive browsing experience for all public content. These pages will serve as dedicated entry points for users to explore the entire collection of artworks and artists through a paginated grid interface.

### 1.2. Target Audience

All public visitors, including casual browsers and researchers.

### 1.3. Scope

- **Frontend:** Two new client-rendered Vue pages at `/artworks` and `/artists`.
- **Backend:** Two new API endpoints, `/api/artworks` and `/api/artists`, to serve paginated and sorted data.
- **Functionality:** The pages will feature a responsive grid of cards, pagination, multiple sorting options, and a page-size selector.

---

## 2. Functional Requirements

### 2.1. Core Features

- **Artwork Index Page:** A page at `/artworks` displaying a paginated grid of all approved artworks.
- **Artist Index Page:** A page at `/artists` displaying a paginated grid of all approved artists.
- **Pagination:** Controls will be present at the bottom of the grid to navigate between pages. The browser URL will update to reflect the current page (e.g., `?page=2`).
- **Page Size Selector:** A UI control allowing users to select 10, 30, or 50 items per page. The default is 30. The selection is reflected in the URL (e.g., `?limit=30`).
- **Sorting:** A UI control to sort the content. Options include:
    - Last Updated (default, descending)
    - Title/Name (ascending)
    - Creation Date (descending)

### 2.2. Out of Scope

- **Search Bar:** There will be no search functionality on these pages.
- **Advanced SEO:** Server-side rendering or pre-rendering for SEO is not part of the initial release.
- **Page Pre-fetching:** The frontend will not pre-fetch data for subsequent pages.

---

## 3. UX and UI Details

### 3.1. Layout and Design

- **Layout:** A responsive, flexible grid of cards. The number of columns will adapt to the screen width.
- **Artwork Cards:** Will display:
    1.  Thumbnail image.
    2.  Artwork title.
    3.  Primary artist's name.
- **Artist Cards:** Will display:
    1.  Thumbnail image (avatar).
    2.  Artist's full name.
    3.  A count of their artworks.
    4.  A short bio (truncated to ~20 words).
- **Placeholder Images:** If a thumbnail is missing, a colored block with the first letter of the item's title or name will be displayed.
- **Empty State:** If no items are found, a message "No artwork found. Be the first to submit something!" will be displayed with a link to the submission page.

### 3.2. User Interaction

- **Card Click Behavior:**
    - **Artwork Card:** Navigates to the artwork's detail page (`/artwork/:id`).
    - **Artist Card:** Navigates to a filtered search results page (`/search?artist=Artist%20Name`). This is a temporary measure until dedicated artist detail pages are built.
- **Page Size Change:** When the page size is changed, the view will attempt to keep the current top item in view by calculating the new page number.
- **Page Title:** The browser tab title will update to reflect the current page number (e.g., "Artworks (Page 2) | Cultural Archiver").

---

## 4. Technical Requirements

### 4.1. Backend API

- **Endpoints:** Create two new dedicated endpoints:
    - `GET /api/artworks`
    - `GET /api/artists`
- **Query Parameters:**
    - `page` (integer, default: 1)
    - `limit` (integer, default: 30)
    - `sort` (string, e.g., `updated_desc`, `title_asc`, `created_desc`)
- **API Response:** The JSON response for both endpoints will have the following structure:
    ```json
    {
      "totalItems": 123,
      "currentPage": 1,
      "totalPages": 5,
      "items": [ /* array of artwork or artist objects */ ]
    }
    ```
- **Sorting Behavior:** When sorting, records with `null` values in the sort field will be placed at the end of the results.
- **Error Handling:** Navigating to an invalid page number (e.g., `?page=999`) should result in a "Page not found" error.

### 4.2. Performance and Caching

- **CDN Caching:** API responses will be cached at the CDN for **1 hour**.
- **Image Loading:** Off-screen images will be lazy-loaded using the native `loading="lazy"` attribute on `<img>` tags.
- **Database Optimization:** If performance issues arise from calculating artist artwork counts, the preferred strategy is to add a denormalized `artwork_count` column to the `artists` table.

---

## 5. Implementation Plan

### 5.1. Development Tasks

1.  **Backend:**
    -   Create new routes and handlers for `/api/artworks` and `/api/artists`.
    -   Implement pagination, sorting, and data shaping logic.
    -   Ensure `approved` status is enforced.
2.  **Frontend:**
    -   Create `ArtworkIndexView.vue` and `ArtistIndexView.vue`.
    -   Develop or reuse a `PaginatedGrid` component to handle the layout and controls.
    -   Wire up the UI to the new API endpoints.
    -   Implement the card components for both artwork and artists.
3.  **Navigation:**
    -   Add "Artworks" and "Artists" links to the main site navigation bar.

### 5.2. Testing

- **Unit Tests (Vitest):**
    -   Verify that the index pages render correctly.
    -   Test pagination logic, page-size selector, and sorting controls.
    -   Confirm that card clicks navigate to the correct URLs.
- **Integration Tests:**
    -   Test the full flow from page load to API call and rendering.
    -   Verify the empty state and invalid page handling.

---

## 6. Acceptance Criteria

-   **AC-1:** Visiting `/artworks` and `/artists` displays a paginated grid of approved items, defaulting to 30 items per page, sorted by "last updated."
-   **AC-2:** The page size can be changed to 10, 30, or 50, and the grid updates accordingly.
-   **AC-3:** The content can be sorted by "last updated," "title/name," and "creation date."
-   **AC-4:** Pagination controls are present at the bottom of the grid and correctly navigate between pages.
-   **AC-5:** Artwork cards link to their detail page; artist cards link to a filtered search page.
-   **AC-6:** Placeholder images are shown for items without a thumbnail.
-   **AC-7:** The browser tab title includes the current page number.
-   **AC-8:** Navigating to a URL with an out-of-bounds page number shows a "Page not found" error.
