# PRD: Navigation Rail GUI Update

**Version:** 1.0  
**Date:** 2025-09-23  
**Author:** GitHub Copilot

## 1. Introduction

This document outlines the requirements for a significant user interface update for the Public Art Registry application. The current top-level app bar will be replaced with a more modern and responsive navigation rail on the left-hand side of the screen. This change aims to improve user experience, provide a more scalable navigation structure, and align with Material Design 3 principles.

The new navigation component will be responsive, transforming into a bottom navigation bar on mobile devices or screens with limited horizontal space, ensuring a seamless experience across all platforms.

## 2. Goals and Objectives

* **Modernize UI/UX:** Align the application's look and feel with contemporary design standards (Material 3).
* **Improve Navigability:** Consolidate primary navigation, search, and user actions into a single, persistent component.
* **Enhance Responsiveness:** Create a single navigation pattern that adapts gracefully from desktop to mobile viewports.
* **Increase Scalability:** Provide a flexible structure that can accommodate future features and navigation items.
* **Streamline User Workflow:** Make key actions like search, notifications, and profile access more prominent and accessible.

## 3. Functional Requirements

### 3.1. Navigation Rail (Desktop / Large Screens)

The navigation rail will be the primary navigation component on larger screens.

* **Position:** Fixed to the left side of the viewport.
* **Default State:** Expanded by default.
* **Collapsibility:**
  * An icon button (e.g., chevron_left) shall be present to collapse the rail.
  * When collapsed, the rail should shrink to show only the icons for the navigation links and bottom actions.
  * When collapsed, the collapse/expand button should toggle its icon (e.g., to chevron_right).
* **Content (Expanded View):**
  1. **Header:**
     * Application Logo.
     * Project Name: "Public Art Registry".
  2. **Introduction:**
     * A short blurb with the text "Welcome to the Public Art Registry!".
     * A "Read More" link that opens a modal containing more detailed information about the project.
  3. **Primary Navigation:**
     * A list of primary navigation links, including:
       * Map (Icon + Text)
       * Artwork Index (Icon + Text)
       * Artist Index (Icon + Text)
     * The currently active page must be clearly indicated using a visual highlight (active indicator), as per Material 3 guidelines. "Map" is the default active page.
  4. **Search:**
     * A prominent search bar. When a user performs a search, the application will navigate to a dedicated search results page (`/search?q=...`) that displays matching artwork, artists, and other relevant content.
  5. **Role-Based Indicators:**
     * An "Admin" icon/link, visible only to users with administrative privileges.
     * A "Moderator" icon/link, visible only to users with moderation privileges.
  6. **Bottom Actions:**
     * A group of controls aligned to the bottom of the rail:
       * **Notification Button:** (Icon + Text)
       * **Profile Button:** (Icon + Text)
       * **Logout Button:** (Icon + Text)

### 3.2. Bottom Navigation Bar (Mobile / Small Screens)

On smaller viewports where a side rail is not feasible, the navigation will transition into a bottom navigation bar.

* **Trigger:** This transition should occur based on a CSS breakpoint (e.g., when viewport width is less than 600px).
* **Position:** Fixed to the bottom of the viewport.
* **Layout:**
  * **Left Side:** A hamburger menu icon (`menu`). Tapping this icon will open the full navigation rail as a temporary, modal-like drawer from the left.
  * **Right Side:** A "Notification" icon.
  * **Center:** A Floating Action Button (FAB). The FAB's primary action is to "Submit New Artwork," which will navigate the user to the submission form.

### 3.3. Active State Indication

* The navigation component must always visually indicate the user's current location within the app.
* For the navigation rail, this will be a highlighted item in the list.
* For the bottom navigation bar, the hamburger menu itself does not need an active state, but the opened drawer should show the active item.

## 4. Non-Functional Requirements

* **Persistence:** The user's preference for an expanded or collapsed rail state will be saved in local storage to persist across sessions.
* **Performance:** The navigation component should be lightweight and not impact page load or rendering performance. Animations for expanding/collapsing should be smooth (60fps).
* **Accessibility:** The component must be fully accessible, supporting keyboard navigation, screen readers (with proper ARIA attributes), and sufficient color contrast.
* **Technology:** The implementation should use Vue 3 with the Composition API and TypeScript. Tailwind CSS should be used for styling.

## 5. Future Considerations

* Allowing user preference for the rail's default state (expanded or collapsed).
* Adding more items to the navigation as the application grows.
* Integrating a notification count badge on the "Notification" icon.

## Orginal tasks

Create a PRD for this GUI update

Follow the material design lanauge v3 https://m3.material.io/components/navigation-rail/guidelines

I want to move the App bar to the left hand side of the map and convert it into a "navigation rail" that is expanded by default. Then I want to move all the content from the current Navigation Menu to this new "navigation rail".

1) Logo and Project name (Public Art Registry)
2) Small blurb about this project with a read more link that takes the user to the help page.
3) A row of short links. Artwork index, Artist Index
4) Search bar
5) If Admin - Show admin icon
6) If Moderator - show moderator icon
7) At the bottom have a Notification, Profile and Logout button

Use active indicators to show what the current page is. Map by default.

Allow the users to minimise the "navigation rail"

If there is not enugh room on the page or if the page is mobile then the "navigation rail" should transition into a "navigation bar" at the bottom of the page. The lefthand side should have a hamburger menu icon to expand the "navigation rail" on the left hand side. The right side icon should be the "Notification" icon. The center should be the FAB.
