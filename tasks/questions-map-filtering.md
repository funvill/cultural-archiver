# Feature: Map Filtering - Clarifying Questions

This document tracks the questions and answers to help define the "Map Filtering" feature based on `prd-map-filtering_v2.md`.

## Theme: Goals & High-Level Vision

**1. What is the primary goal for implementing map filtering?**

- **Answer (A):** To allow users to quickly find relevant artworks by personalizing the map view based on their interests and visit history.

**2. Which user story represents the most critical "Minimum Viable Product" (MVP) for this feature?**

- **Answer (B):** "Hunter" - Users can see which artworks they have already visited and filter them out.

**3. How should the "Unknown" status artwork be handled in the initial release?**

- **Answer (B):** Display them with a unique marker style (e.g., a question mark icon) by default to encourage user feedback.

**4. What is the main driver for the performance requirement of handling 1000+ markers?**

- **Answer (A):** To support dense urban areas where many artworks are clustered (e.g., Vancouver), ensuring a smooth user experience without lag.

**5. What is the most important outcome of the proposed caching strategy?**

- **Answer (A):** To make the map feel instantaneous on subsequent visits and when applying filters, even with a poor connection.

**6. For the "Hunter" user story, what is the more common desired behavior to support first?**

- **Answer (A):** Differentiating "Visited" artworks with a distinct style (gray flag) but keeping them on the map.

## Theme: Functional Requirements

**7. How should the filter UI be presented to the user? A. (Recommended) A single, comprehensive "Filter" button on the map that opens a modal or side panel with all filtering options (status, lists, types).**


**7. For the "Status" filter, what is the primary purpose of allowing users to see "Unknown" artworks?**

- **Answer (A):** - A single, comprehensive "Filter" button on the map that opens a modal or side panel with all filtering options (status, lists, types). Each filtering option should be a toggle. The filtering options should be added to the map options dialog. The map options dialog should be scrollable and fill most of the screen.

**8. When a user filters by a list (e.g., "Want to See"), how should artworks not on that list be handled?**

- A. Completely hide all non-matching artworks from the map. Use the word "Stared"

**9. What is the expected behavior for marker clustering when filters are active?**

- A. Clustering should operate only on the visible (filtered) markers. The cluster count should reflect the number of visible items within it.

**10. How should the state of the filters be persisted?**

- A. Persist the user's last-used filter settings in localStorage and automatically re-apply them the next time they visit the map. 

**11. Regarding the "Unknown" status, what should the default filter setting be?**

- B. Hide "Unknown" artworks by default, with a toggle to show them. 

**12. If a user is viewing a custom list, what should the map show when they navigate to it?**

- A. Automatically filter the map to show only the artworks from that specific list. 

**13. How should the user be informed that filters are currently active?**

- Show a banner at the top of the map that indicates what filters are currenly active. If no filters are active then hide the banner.

**14. What should happen when a user applies a filter that results in zero visible artworks?**

- The banner should show the error "No artworks match your current filters," with a button to "Clear All Filters."

**15. How should the "Unknown" status marker be visually differentiated from "Normal" markers?**

- C. Use the "Normal" circle marker but with a dashed or dotted border.

**16. When the map options dialog is open, how should it interact with the map itself?**

- D. The dialog should take up the full screen, completely hiding the map until it is closed. With an apply settings button that when pressed closed the Map options dialog.

**17. Should there be a quick way for the user to reset all active filters?**

- A. Yes, include a prominent "Clear All" or "Reset Filters" button at the top of the filter dialog.

**18. How should the filter options be organized within the scrollable dialog?**

- A. Group them into logical sections with clear headings: "Status" (Unknown), "My Lists" (Visited, Stared), and "Artwork Types."

**19. How should the test page (/test-map) be implemented?**

- Create a new, simple Vue component for the route that imports and uses the existing MapComponent. It should generate mock artwork data locally to avoid API dependencies.

**20. What is the preferred strategy for caching the user's system lists (Visited, Stared, Loved)?**

- A time-to-live (TTL) cache in localStorage with a HEAD request to check a last-modified header or ETag. If the data is fresh, use the cache; otherwise, fetch the full list.

**21. When filtering, where should the filtering logic primarily reside?**

- In the frontend. Fetch a broad set of nearby artworks and apply the user's filters (status, lists, type) to the data in the browser.

**22. How should the "Apply Settings" button in the full-screen dialog manage state changes?**

- The filter toggles should update a temporary state object. When "Apply Settings" is clicked, commit this temporary state to the main application state (e.g., Pinia store), which then triggers the map to re-render.

**23. Given the requirement to force clustering at zoom levels 1-12, how should this be implemented?**

- Use the map's zoom level events. When the zoom level is <= 12, ensure the clustering layer is enabled. When it's > 12, respect the user's toggle for clustering.

**24. How should the banner indicating active filters be implemented?**

- As a new, reusable Vue component that takes the list of active filters as a prop and computes the display text. It can be placed in the MapView layout and conditionally rendered.
