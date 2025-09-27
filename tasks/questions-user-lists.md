# Feature: User Lists - Clarifying Questions

This document tracks clarifying questions and answers related to the User Lists feature, as defined in `prd-user-lists.md`.

## Set 1: Functional Requirements & List Behavior

**1. List Naming Uniqueness:** What should happen if a user tries to create a new list with the same name as an existing list they already own?
- **Answer (A):** Prevent creation and show an error message, e.g., "You already have a list with this name." This avoids confusion and keeps list names unique per user.

**2. "Loved" List Behavior:** The PRD now includes a "Loved" list. How should this list behave differently from "Want to see" or "Have seen"?
- **Answer (A):** It should function identically to "Want to see" and "Have seen"—a user-managed, non-deletable list for personal curation. This maintains consistency.
- **User Note:** This will be shown on the artwork page as a heart that can be clicked.

**3. List Item Management:** When an artwork is added to a list, what should the user interface do?
- **Answer (A):** Show a confirmation toast/notification (e.g., "Added to 'NY Trip 2025'") and allow the user to immediately undo the action or move the item to another list from the notification.

**4. Empty List State:** What should be displayed on a list's page when it contains no artworks?
- **Answer (A):** Show a message like "This list is empty. Discover artworks to add!" with a prominent link or button that directs the user to the main search or map page.

**5. List Deletion Confirmation:** What is the required procedure for a user to delete one of their custom lists?
- **Answer (A):** When the user clicks "delete," show a confirmation dialog asking "Are you sure you want to delete the list '[List Name]'? This action cannot be undone." The user must confirm to proceed.

---

## Set 2: Sharing, UI, and Technical Details

**6. Sharing Mechanism:** How should users share a list?
- **Answer (A):** Provide a "Share" button on the list page that copies a permanent, public URL (e.g., `art.abluestar.com/lists/{listId}`) to the clipboard.

**7. Shared List Presentation:** When a non-owner views a shared list page, what should they see?
- **Answer (A):** The list name, the owner's username (e.g., "A list by @username"), and the artworks in the list. All owner controls (rename, delete, remove items) should be hidden.

**8. Privacy Evolution:** What is the initial plan for list privacy?
- **Answer (Custom):** All lists are unlisted by default. If a user has the direct link, they can view it.

**9. Search Engine Indexing:** Should public list pages be discoverable by search engines like Google?
- **Answer (Custom):** Not part of the Minimum Viable Product (MVP).

**10. Ownership Transfer:** Is it possible for a user to transfer ownership of a list to another user?
- **Answer (A):** No, this is not supported. The creator of the list is its permanent owner.

**11. List Display on Profile:** How should a user's lists be displayed on their public profile page?
- **Answer (A):** In a dedicated "Lists" tab. Show the three special lists ("Loved," "Want to see," "Have seen") first, followed by the user's custom-named lists, sorted alphabetically or by most recently updated.

**12. Artwork Card Interaction:** Within a list view, what happens when a user clicks on an artwork's card?
- **Answer (A):** It should navigate to the artwork's main detail page.

**13. "Add to List" Iconography:** What icon should be used for the "Add to List" / "Bookmark" feature?
- **Answer (A):** A single "bookmark" icon. If the artwork is in any list, the icon appears "filled." The "Loved" list uses a separate "heart" icon.

**14. List Sorting:** On a user's profile, how should their custom lists be sorted?
- **Answer (A):** By "last updated" date, with the most recently modified list appearing first.

**15. Map View Filter Display:** When the map is filtered to a specific list, how is this state communicated?
- **Answer (C):** Show a message in the corner of the map that cannot be dismissed.

**16. Artwork Deletion:** What happens to list items when an artwork is permanently deleted?
- **Answer (B):** The item remains in the list but appears as "Artwork no longer available" and links to a 404 page.

**17. API Pagination:** What should the default page size be for the list items endpoint?
- **Answer (A):** 50 items per page.

**18. Rate Limiting:** What rate limits should be applied?
- **Answer (B):** No rate limits are necessary for the initial release.

**19. Data Backfill:** How should special lists be created for existing users?
- **Answer (C):** Only create the lists when a user first tries to add an artwork to one of them.

**20. Performance on Map:** How can map performance be ensured for large lists?
- **Answer (A):** The backend should handle the filtering via a database query that accepts the `listId`.

---

## Set 3: MVP Scope Reduction & UI/UX Details

**21. List Creation UI (MVP):** For the first version, where should users be able to create a new list?
- **Answer (A):** Only from the artwork detail page, via the "Add to List" dialog. This keeps the workflow contextual and reduces the need for a separate UI on the profile page initially.

**22. List Renaming (MVP):** Should users be able to rename a list in the first version?
- **Answer (A):** No. Defer list renaming. Users can delete and recreate a list if they need a different name.

**23. "Move to another list" (MVP):** Should the "move" functionality be included in the MVP?
- **Answer (A):** No. The toast should only offer an "Undo" option. Moving an item can be added later.

**24. List Item Ordering (MVP):** How should items within a list be ordered?
- **Answer (A):** Chronologically, by the date they were added (newest first). No re-ordering or sorting options in the MVP.

**25. Bulk Operations (MVP):** Should the MVP include any way to add or remove multiple artworks from a list at once?
- **Answer (C):** Yes, allow users to select multiple items on a list page to remove them simultaneously.

**26. "Add to List" Dialog:** When a user clicks the "bookmark" icon on an artwork page, what should the dialog contain?
- **Answer (A):** A list of their existing custom lists with checkboxes, a text input field to "Create a new list," and a "Done" button. The special lists ("Loved," etc.) should not appear in this dialog.

**27. Removing an Item:** How does a list owner remove an artwork from a list?
- **Answer (A):** On the list page, each artwork card has an "X" or "trash" icon. Clicking it immediately removes the item and shows an "Undo" toast notification.

**28. "Filled" Bookmark Icon:** What is the exact condition for the bookmark icon to appear "filled"?
- **Answer (A):** The icon is filled if the artwork exists in *at least one* of the user's custom-named lists. The state of the special lists does not affect this icon.

**29. List Page Layout:** What should the layout of the artworks on the list page look like?
- **Answer (A):** A responsive grid of artwork thumbnails (similar to the main search results page).

**30. Creating a List with an Existing Name:** How is the error shown for a duplicate list name?
- **Answer (A):** Show a small inline error message like "This name is already in use" below the input field in the dialog.

**31. List Descriptions:** Should a list have a description field in addition to its name?
- **Answer (A):** No. For the MVP, a list consists only of a name and its items.

**32. Notifications:** Should a user be notified if an artwork in one of their lists is updated?
- **Answer (A):** No. This is outside the scope of the MVP.

**33. User Mentions in Lists:** Can users be @mentioned in list titles?
- **Answer (A):** No. Do not parse for or linkify @mentions.

**34. List Statistics:** Should the list page display any statistics?
- **Answer (A):** For the MVP, only show the total count of items in the list (e.g., "35 Artworks").

**35. "Validated" List Visibility:** Should the special "Validated" list be visible on their public profile?
- **Answer (B):** No, the "Validated" list should be private and only visible to the user themselves.

**36. List Not Found:** What should the user see if they navigate to a URL for a deleted list?
- **Answer (A):** A standard "404 Not Found" page with a message like "List not found. It may have been deleted by its owner."

**37. Adding to a Full List:** What should the UI show when a list is full?
- **Answer (A):** In the "Add to List" dialog, disable the checkbox for the full list and show a small "(full)" label next to its name.

**38. Offline Behavior:** What happens if a user tries to add an artwork to a list while they are offline?
- **Answer (Custom):** Not part of the MVP.

**39. API Failure:** If the list of lists fails to load in the "Add to List" dialog, what should be displayed?
- **Answer (Custom):** Go to existing error page with full detailed error.

**40. User Deletion:** What happens to a user's lists if their account is permanently deleted?
- **Answer (D):** The lists are automatically transferred to a system-wide "archive" account.
