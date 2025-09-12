# Feature Definition: Index pages for Artwork and Artists

This document outlines the requirements for the "Index pages for Artwork and Artists" feature based on the clarifying questions answered.

## Initial feature description

Create two index pages that list all artworks and all artists as card grids with pagination. These pages act like full result listings (not filtered search) and provide quick access to item detail pages.

## 1. Goals & High-Level Vision

*   **Primary Goal:** To provide a simple, comprehensive browsing experience for all public content.
*   **Primary Audience:** All public visitors, including casual browsers and researchers.
*   **Artist Page Long-Term Plan:** The current plan to link artist cards to a filtered search is a temporary solution. Dedicated artist detail pages should be built in a future sprint.
*   **Sorting Options:** The index pages should launch with sorting by "last updated" (default), "title/name (A-Z)", and "creation date".
*   **Access:** The new pages will be accessible via "Artworks" and "Artists" links in the main site navigation bar.

## 2. Functional Requirements

*   **Page Size Behavior:** When a user changes the page size, the view should attempt to stay on the current item by calculating the new page number.
*   **Search Bar:** The search bar will be removed from these index pages to simplify the UI.
*   **Sorting Controls:** Sorting options will be presented as a set of clickable links or buttons.
*   **Artwork Card Content:** Artwork cards will display a thumbnail image, the artwork title, and the primary artist's name.
*   **Placeholder Images:** If a thumbnail is missing, a colored block with the first letter of the item's title or name will be displayed.

## 3. User Stories & Scope

*   **Primary User Story:** The most important goal is to allow a casual browser to see all the artwork in a simple list to get a feel for the collection.
*   **Empty State:** If no content is available, the page will show a simple message: "No artwork found. Be the first to submit something!" with a link to the submission page.
*   **Content Inclusion:** All content with an `approved` status will be included on these pages.
*   **SEO (Out of Scope):** Advanced SEO is out of scope for the initial release. The pages will be client-rendered, and indexing will not be a priority for the MVP.
*   **Page Titles:** The browser tab title will update to reflect the current page number (e.g., "Artworks (Page 2) | Cultural Archiver").

## 4. Design & Technical Considerations

*   **Responsive Layout:** The grid layout will be flexible, with the number of columns adjusting to fill the available screen width.
*   **Pagination Controls:** Pagination controls will be located only at the bottom of the content grid.
*   **Artist Card Links:** Artist cards will link to a filtered search using the format `/search?artist=Artist%20Name`.
*   **Backend API:** Dedicated endpoints (`/api/artworks` and `/api/artists`) should be created for fetching index data, rather than reusing the existing search API.
*   **Invalid Page Handling:** If a user navigates to an invalid page number via the URL, the site will show a "Page not found" error.

## 5. API and Data Details

*   **Default Page Size:** The API will default to 30 items per page if no `limit` is specified.
*   **API Sorting:** Sorting will be handled via a `sort` query parameter (e.g., `sort=updated_desc`, `sort=title_asc`).
*   **Artist Card Data:** The API response for an artist must include their `id`, `name`, an `artwork_count`, and a `short_bio` (truncated to ~20 words).
*   **Pagination Metadata:** The API response will include `totalItems`, `currentPage`, and `totalPages` to facilitate frontend pagination.
*   **Sorting with Nulls:** When sorting, records with null values in the sort field will be placed at the end of the results.

## 6. Performance & Caching

*   **CDN Caching:** API responses for the index pages will be cached by the CDN for 1 hour.
*   **Page Pre-fetching:** The frontend will not pre-fetch subsequent pages; pages will be loaded on-demand.
*   **Image Lazy-Loading:** Off-screen images will be lazy-loaded using the native `loading="lazy"` attribute.
*   **API Response Time:** There is no strict performance requirement for API response time, but timeouts should be avoided.
*   **Database Optimization:** If artist queries become slow, the preferred solution is to denormalize an `artwork_count` into the `artists` table.
