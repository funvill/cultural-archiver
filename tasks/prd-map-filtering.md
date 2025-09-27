
# PRD: Map Filtering - ✅ IMPLEMENTED

This document outlined the requirements for a map filtering feature that allows users to selectively control which artwork markers are displayed on the map, reducing clutter and helping them find specific points of interest.

## 🎯 Implementation Status: ✅ COMPLETE

**All features have been successfully implemented and are available in the application.**

- ✅ Filter button in map navigation 
- ✅ Full-screen overlay modal
- ✅ Toggle switches for all filter types
- ✅ Active filter banner
- ✅ State persistence
- ✅ Authentication flow
- ✅ API integration

See PR implementation details for technical documentation.

---

## 1. Problem Statement & Goal

**Problem:** The main map can become cluttered with a large number of artwork markers, making it difficult for users to find artworks that are relevant to their immediate goals, such as visiting new places or focusing on a specific curated list.

**Goal:** Give users a simple and intuitive way to filter the artworks shown on the map. This will reduce visual noise and allow them to focus on a targeted set of locations based on their saved lists and viewing history.

## 2. User Stories

1. **Finding New Artworks:** As a user who has seen several artworks in an area, I want to filter the map to show only artworks I have *not* yet seen, so I can easily discover new places to visit.
2. **Planning an Outing:** As a user who has curated a "Want to See" list, I want to filter the map to show only markers from that list, so I can plan my route efficiently.
3. **Focused Exploration:** As a user with a specific list for an upcoming trip (e.g., "New York Art"), I want to filter the map to show only items from that list that I have also not yet seen, so I can maximize my time visiting new art.

## 3. Feature Requirements

### 3.1. Access & UI

- **Entry Point:** The filtering options will be accessed via an icon within the map's main navigation bar.
- **Screen Layout:** The "Map Options" screen will be presented as a full-screen overlay on all devices.
- **Filter Controls:** All filters will be enabled or disabled using standard toggle switches for a clear on/off state.
- **Default State:** When the filter screen is opened and no filters are active, it will display all available filters in their "off" state.
- **Resetting Filters:** A "Reset Filters" button will be available on the filter options screen. When pressed, it will turn off all active filters and return the map to its default state.

### 3.2. Filter Definitions

A new "Filters" section will be added to the map options. The following filters will be available:

- **Want to See:** When enabled, only shows artworks from the user's "Want to See" system list.
- **User Lists:** Displays a scrolling list of the user's custom-created lists. Each list has a toggle switch.
  - If a user has no custom lists, this section will display a message like: "You haven't created any lists yet."
  - The lists will be ordered by the most recently updated.
- **Not Seen by Me:** This is a **subtractive filter**. When enabled, it removes any artworks that are in the user's "Been Here" or "Logged" system lists from the final filtered result set.

### 3.3. Filter Logic

- **Combining Filters:** When multiple filters (e.g., "Want to See" and a custom "New York" list) are enabled, the logic is **additive (OR)**. The map will show markers that are in *either* of the selected lists.
- **"Not Seen by Me" Interaction:** This filter is always applied last. It removes items from the set created by any other active filters. For example, if "Want to See" is active, enabling "Not Seen by Me" will show items that are in "Want to See" AND are NOT in "Been Here" or "Logged".
- **State Persistence:** The user's last-used filter settings will be persisted between sessions.

### 3.4. Active Filter Display

- **Banner:** When one or more filters are active, a banner will appear at the top of the map.
- **Banner Content:** The banner will display a concise summary of the active filters (e.g., "Filters active: Want to See, Not Seen by Me"). For the initial release, this banner will not contain a reset button.

### 3.5. Map Marker & Icon Updates

To support the filtering system, map marker icons will be updated to convey status at a glance.

- **Icon Priority (Initial Release):** If an artwork falls into multiple categories, the icon will be determined by the following priority:
    1. **"Been Here" / "Logged"**: A flag icon inside a gray circle.
    2. **"Want to See"**: A gold star icon in a circle.
    3. **Default**: A question mark icon.
- **"Not Seen by Me" Effect on Icons:** If the "Not Seen by Me" filter is active, artworks in "Been Here" or "Logged" will be completely hidden from the map, not just shown with a different icon.

### 3.6. Scope & Future Enhancements

- **Application Area:** These filters will only apply to the main, full-screen map view.
- **Future - Photo Thumbnails:** In a future iteration, a fourth icon type will be introduced: a circular thumbnail of the artwork's primary photo. This will have a lower priority than the "Been Here" and "Want to See" icons.
- **Future - List Search:** For users with many lists, a search/filter bar for the lists themselves is a potential future enhancement.
- **Future - Banner Reset Button:** A "Reset" button may be added to the active filter banner in a future release for quicker access.
