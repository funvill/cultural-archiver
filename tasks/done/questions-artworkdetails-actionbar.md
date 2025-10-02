# Feature: Artwork Details Action Bar - Q&A Summary

This document summarizes the clarifying questions and answers regarding the implementation of the Artwork Details Action Bar feature.

## Functional Requirements

**1. What should happen when a user clicks the "Add to list" (bookmark) button?**
- **Answer (A):** Open a modal displaying all of the user's lists, allowing them to check/uncheck which lists the artwork belongs to. This provides full control in one place.

**2. How should the "Share" functionality behave on a desktop browser?**
- **Answer (A):** Prioritize the modern Web Share API if available. If not, fall back to a small popover with a "Copy Link" button and social media shortcuts (e.g., X, Facebook, Reddit).

**3. What is the desired behavior for the "Add Log" button?**
- **Answer (B - Inferred from "See existing behavior"):** Navigate to a full-page form for adding a log (e.g., `/logbook/:id`).

**4. If an unauthenticated user is prompted to log in after clicking an action, what happens after a successful login?**
- **Answer (Custom):** Redirect the user back to the artwork details page, but require them to click the button again.

**5. How should the action bar handle API errors (e.g., the server fails to add an artwork to a list)?**
- **Answer (A):** If using an optimistic UI, revert the icon to its previous state and show a temporary, non-blocking toast message like "Couldn't update list. Please try again."

## Design and UI Considerations

**6. How should the action bar chips be styled on hover or focus?**
- **Answer (C - Clarified):** The icon inside the chip should "twitch" with an animation similar to the existing artwork cards.

**7. On mobile devices, how should the action bar adapt if it has too many actions?**
- **Answer (A):** The chips should wrap onto a second line.

**8. What should the visual feedback be immediately after a user successfully clicks an action?**
- **Answer (A):** A subtle animation on the icon itself, like a "popping" effect or a ripple, in addition to the state change.

**9. Should the text labels for the actions ever be visible by default?**
- **Answer (Custom):** Yes, on wider screens (e.g., tablets and desktops), show the icon and the text label side-by-side, with the text appearing under the icon.

**10. What is the preferred icon style for the "Add Log" and "Edit" actions?**
- **Answer (A):** For "Add Log," use a "note-plus" or "document-add" icon. For "Edit," use a classic "pencil" icon.

## Non-Goals / Out of Scope

**11. Should this action bar include functionality for users to *comment* on the artwork?**
- **Answer (A):** No, commenting is a separate feature.

**12. Is it a requirement to allow users to customize the order of the action buttons?**
- **Answer (A):** No, the order should be fixed.

**13. Should the action bar display public counts for any of the actions (e.g., "1.2k Loves")?**
- **Answer (C - Clarified):** Yes, show counts for all actions, but the implementation needs to be considered carefully to avoid overwhelming the system.

**14. Will the "Add to list" functionality support creating a *new* list directly from its modal?**
- **Answer (Yes - Inferred from "see existing system"):** Yes, include a "+ Create new list" button within the "Add to list" modal.

**21. What happens if a user is offline and clicks an action button?**
- **Answer:** Out of Scope.

**24. How should the action bar appear on a printed version of the page?**
- **Answer:** Out of Scope.

**25-27. Success Metrics & Analytics**
- **Answer:** Out of Scope.

## Technical & State Management

**15. How should the state of the action bar be managed?**
- **Answer (D):** Refetch the state from the API after every action.

**16. What is the preferred API strategy for fetching the initial state?**
- **Answer (B):** Make a dedicated, secondary API call specifically for the user's list membership for that artwork.

**17. How should the component behave while the initial user list status is being fetched?**
- **Answer (B):** Show all icons in their default (un-set) state and allow clicks, which will be queued or re-evaluated once the initial state arrives.

## Permissions & Roles

**18. Who should be able to see the "Edit" button?**
- **Answer (C - Inferred from "How existing system works"):** Any logged-in user.

**19. Are there any scenarios where the entire action bar should be hidden?**
- **Answer (A):** No, the action bar should always be visible.

**20. If a new user role is introduced in the future, how should the action bar accommodate it?**
- **Answer (A):** The component should be agnostic to roles. Any special buttons should be controlled by a generic `permissions` prop.

## Edge Cases & User Experience

**22. If the "Add to list" modal displays a very long list of user-created lists, how should it be displayed?**
- **Answer (D):** The modal's content area should become scrollable, and a search/filter bar should be added at the top.

**23. Should there be a confirmation step before removing an artwork from a list?**
- **Answer (A):** No, a second click on the icon should instantly remove it.

**28. If an artwork is part of a temporary event, should the action bar display any special indicator?**
- **Answer (A):** No, this is outside the scope of the action bar.

**29. What should the ARIA labels for the stateful buttons say when they are in the "active" state?**
- **Answer (A):** "Remove from [List Name]" (e.g., "Remove from Loved list").

**30. Should the action bar be visually distinct?**
- **Answer (C):** Yes, add a horizontal dividing line above and below the action bar.
