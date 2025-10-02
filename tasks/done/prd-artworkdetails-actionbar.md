# Product Requirements Document: Artwork Details — Action Bar

## Summary

Add a compact action bar below the main artwork photo on the Artwork Details page. The action bar groups common user actions (lists, logs, edit, share) into a single, mobile-first, accessible control using "chips" style buttons. The goal is to make social actions discoverable and reduce UI clutter by consolidating related actions.

## Goals

- Surface high-value actions (love, been here, want to see, add to list, add log, edit, share) near the photo where users expect them.

- Make list state obvious at-a-glance (filled vs outline icons and color accents).

- Ensure actions respect authentication: prompt login for unauthenticated actions and clearly document post-login behavior.

- Provide a small, reusable component and clear API so frontend and backend integration is simple and testable.

## User stories

- As a logged-in user, I want to tap "Loved" so that the artwork is added to my Loved list and the heart fills red.

- As a logged-in user, I want to tap "Been here" to record that I've seen the artwork (added to Have Seen list) and get a visual confirmation.

- As a logged-in user, I want to tap "Want to see" so I can save the artwork to my Want to See list.

- As an unauthenticated user, when I tap any of these actions I should be prompted to sign in. After a successful login the app redirects back to the artwork details page but the user must click the action again to perform it (login will not auto-run the original action).

- As a user, I want a single "Add to list" control to manage placing the artwork into any custom list I own; the control opens a modal listing my lists with checkboxes and a "+ Create new list" button.

- As an editor or admin user, I want an "Edit" action to open the artwork edit flow.

- As a user, I want a "Share" action that opens the native/share sheet when available and falls back to a copy-link + social shortcuts popover on desktop.

## UX & visual design

- Placement: horizontally centered under the primary photo and above metadata/details. On narrow viewports, chips may wrap to a second row.

- Components: use Material 3 Chips visual language (compact, icon + optional label). All chips should be touch-friendly (min target 44x44 CSS pixels).

- Primary action order (left to right, visually grouped): Loved (heart), Been here (flag), Want to see (star), Add to list (bookmark), Add log (note-plus/document-add), Share (share icon), Edit (pencil). Edit may be hidden for non-editors.

- Labels: show icons only by default; labels appear on hover or via an accessible label for screen readers. On wider screens (tablet/desktop) show the icon plus a small text label by default.

- Hover/focus motion: the icon inside the chip should perform a small "twitch" animation on hover/focus, matching existing artwork card interactions.

- Immediate feedback: successful state changes should show a subtle pop/ripple animation on the icon in addition to the visual state change.

## States & iconography

- Loved: outlined heart when not in list; filled red heart when in list.

- Been here: outlined flag vs filled flag (accent color when in list).

- Want to see: outlined star vs filled star (accent color when in list).

- Add to list: bookmark icon with filled state when the artwork exists in any list owned by the current user. Clicking opens the Add-to-List modal (see below).

- Add log: neutral chip; navigates to the full-page log form (e.g., `/logbook/:id`). Use a `note-plus` or `document-add` icon.

- Share: neutral chip; invokes native Web Share API when available; desktop fallback is a popover with "Copy Link" and social share shortcuts (X, Facebook, Reddit).

- Edit: visible only when `permissions.canEdit` is true. Use a pencil icon.

## Add-to-List modal

- Behavior: opens when the bookmark chip is clicked. Displays the user's lists with checkboxes to add/remove the artwork. Changes are saved via API and the bookmark chip reflects whether the artwork is in any list.

- Long lists: make modal content scrollable and include a search/filter bar at the top to help users find lists quickly.

- Create new list: include a "+ Create new list" button inside the modal to let users create a list without leaving the flow.

## Accessibility

- Each chip must have a descriptive aria-label including action and state. Example labels: "Add to Loved list — not in list" and "Remove from Loved list — in list". For list-specific active states use "Remove from [List Name]" when appropriate.

- Keyboard support: Tab navigates to each chip; Enter/Space activates. Focus ring must be visible and meet contrast requirements.

- Motion & animations: ensure reduced-motion preferences are respected.

- Screen readers: ensure chips expose role and state correctly and the Add-to-List modal is announced when opened.

## Data & API contract (frontend ↔ backend)

### API & fetch strategy

- Initial fetch: on mount, if `userId` is present and `initialListStates` isn't supplied by SSR, make a dedicated secondary API call to fetch membership booleans (`loved`, `beenHere`, `wantToSee`, `inAnyList`).

- Post-action refetch: after any successful mutation the component should refetch membership state from the API to ensure canonical server truth — optimistic UI is permitted but must be reconciled.

- Add-to-list modal: fetch the user's lists (paginated/searchable) and support creating a new list via an API endpoint.

- Counts: public counts (e.g., loves) should be fetched separately or lazily to avoid overloading the membership API.

### Error handling

- If an optimistic update fails, revert the UI and show a temporary, non-blocking toast: "Couldn't update list. Please try again.".

- Network failures on initial fetch: show chips in default (un-set) state and allow interactions; retries or a manual refresh can re-check state.

## Behavior & edge cases

- Initial loading: while membership state is being fetched show icons in their default (outline) state but allow clicks; actions performed before state arrival should be queued or retried against the eventual canonical state.

- Auth gating: clicking a list action while unauthenticated opens a login modal/prompt. After successful login the user is redirected back to the artwork details page but must re-click the action to execute it.

- Optimistic UI & revert: apply optimistic visual changes immediately; if the backend returns an error, revert the change and surface the non-blocking toast.

- Debounce & coalescing: ignore duplicate rapid taps for the same action until the first request resolves to avoid double toggles.

- Add-to-list modal behavior: for very long lists the modal scrolls and includes a search field; saving updates the bookmark chip and triggers a membership refetch.

- Mobile layout: chips wrap to a second row when space is constrained.

- Visual separation: add a thin horizontal dividing line above and below the action bar so it reads as a distinct region.

## Metrics & counts

- Show public counts for actions (e.g., loves) but implement counts via a separate, lightweight endpoint or lazy-load to keep membership endpoints efficient.

## Acceptance criteria

- UI: chips render under artwork photo, match design tokens (sizes, spacing, colors), animate on hover/focus and show subtle pop/ripple on success.

- State: chips accurately reflect list membership after load and after toggles; component refetches membership state after mutations.

- Auth: unauthenticated users are prompted to log in; after login users return to the artwork page and must re-click to perform the action.

- Add-to-list: bookmark chip opens a searchable modal, supports "+ Create new list", and updates bookmark state after save.

- Share: opens native share sheet when available; desktop fallback provides copy-link and social shortcuts.

- Accessibility: aria-labels include action and state; keyboard activation and focus-visible support are present; reduced-motion respected.

- Counts: public counts display without overloading membership APIs (separate/lazy endpoint).

- Tests: unit tests cover rendering, toggle behavior, optimistic updates and revert; integration tests cover login gating and add-to-list flows.

## Implementation notes

- Component: create `ArtworkActionBar.vue` (Vue 3, use a `script setup lang="ts"` block) using a small internal Pinia/store-free composition hook for local state management.

- Reusable chip: implement `MChip.vue` for consistency (icon, optional label, state props, accessible API).

- Icons & tokens: reuse project icon set and Tailwind tokens. Use `note-plus`/`document-add` for Add Log and a pencil icon for Edit.

- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.

- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

## QA checklist

- Verify chips appear under the photo on desktop and mobile and wrap gracefully.

- Verify icon state is correct after initial load for logged-in users.

- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).

- Verify optimistic update + revert on backend failure with the non-blocking toast message.

- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.

- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

## Open questions / assumptions

- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.

- Assumption: icons and design tokens are available and standardized.

- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

## Appendix: sample event sequence

- Page load (user authenticated): frontend GET membership -> sets chip states.

- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.

- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.



# Product Requirements Document: Artwork Details — Action Bar
## Summary

# Product Requirements Document: Artwork Details — Action Bar

## Summary

Add a compact action bar below the main artwork photo on the Artwork Details page. The action bar groups common user actions (lists, logs, edit, share) into a single, mobile-first, accessible control using "chips" style buttons. The goal is to make social actions discoverable and reduce UI clutter by consolidating related actions.

## Goals

- Surface high-value actions (love, been here, want to see, add to list, add log, edit, share) near the photo where users expect them.

- Make list state obvious at-a-glance (filled vs outline icons and color accents).

- Ensure actions respect authentication: prompt login for unauthenticated actions and clearly document post-login behavior.

- Provide a small, reusable component and clear API so frontend and backend integration is simple and testable.

## User stories

- As a logged-in user, I want to tap "Loved" so that the artwork is added to my Loved list and the heart fills red.

- As a logged-in user, I want to tap "Been here" to record that I've seen the artwork (added to Have Seen list) and get a visual confirmation.

- As a logged-in user, I want to tap "Want to see" so I can save the artwork to my Want to See list.

- As an unauthenticated user, when I tap any of these actions I should be prompted to sign in. After a successful login the app redirects back to the artwork details page but the user must click the action again to perform it (login will not auto-run the original action).

- As a user, I want a single "Add to list" control to manage placing the artwork into any custom list I own; the control opens a modal listing my lists with checkboxes and a "+ Create new list" button.

- As an editor or admin user, I want an "Edit" action to open the artwork edit flow.

- As a user, I want a "Share" action that opens the native/share sheet when available and falls back to a copy-link + social shortcuts popover on desktop.

## UX & visual design

- Placement: horizontally centered under the primary photo and above metadata/details. On narrow viewports, chips may wrap to a second row.

- Components: use Material 3 Chips visual language (compact, icon + optional label). All chips should be touch-friendly (min target 44x44 CSS pixels).

- Primary action order (left to right, visually grouped): Loved (heart), Been here (flag), Want to see (star), Add to list (bookmark), Add log (note-plus/document-add), Share (share icon), Edit (pencil). Edit may be hidden for non-editors.

- Labels: show icons only by default; labels appear on hover or via an accessible label for screen readers. On wider screens (tablet/desktop) show the icon plus a small text label by default.

- Hover/focus motion: the icon inside the chip should perform a small "twitch" animation on hover/focus, matching existing artwork card interactions.

- Immediate feedback: successful state changes should show a subtle pop/ripple animation on the icon in addition to the visual state change.

## States & iconography

- Loved: outlined heart when not in list; filled red heart when in list.

- Been here: outlined flag vs filled flag (accent color when in list).

- Want to see: outlined star vs filled star (accent color when in list).

- Add to list: bookmark icon with filled state when the artwork exists in any list owned by the current user. Clicking opens the Add-to-List modal (see below).

- Add log: neutral chip; navigates to the full-page log form (e.g., `/logbook/:id`). Use a `note-plus` or `document-add` icon.

- Share: neutral chip; invokes native Web Share API when available; desktop fallback is a popover with "Copy Link" and social share shortcuts (X, Facebook, Reddit).

- Edit: visible only when `permissions.canEdit` is true. Use a pencil icon.

## Add-to-List modal

- Behavior: opens when the bookmark chip is clicked. Displays the user's lists with checkboxes to add/remove the artwork. Changes are saved via API and the bookmark chip reflects whether the artwork is in any list.

- Long lists: make modal content scrollable and include a search/filter bar at the top to help users find lists quickly.

- Create new list: include a "+ Create new list" button inside the modal to let users create a list without leaving the flow.

## Accessibility

- Each chip must have a descriptive aria-label including action and state. Example labels: "Add to Loved list — not in list" and "Remove from Loved list — in list". For list-specific active states use "Remove from [List Name]" when appropriate.

- Keyboard support: Tab navigates to each chip; Enter/Space activates. Focus ring must be visible and meet contrast requirements.

- Motion & animations: ensure reduced-motion preferences are respected.

- Screen readers: ensure chips expose role and state correctly and the Add-to-List modal is announced when opened.

## Data & API contract (frontend ↔ backend)

### Contract (frontend expectations)

- Input props to component:

  - `artworkId`: string (required)

  - `userId?`: string | null (null if unauthenticated)

  - `permissions?`: { canEdit: boolean }

  - `initialListStates?`: { loved?: boolean; beenHere?: boolean; wantToSee?: boolean; inAnyList?: boolean } (optional prefetch)

### API & fetch strategy

- Initial fetch: on mount, if `userId` is present and `initialListStates` isn't supplied by SSR, make a dedicated secondary API call to fetch membership booleans (`loved`, `beenHere`, `wantToSee`, `inAnyList`).

- Post-action refetch: after any successful mutation the component should refetch membership state from the API to ensure canonical server truth — optimistic UI is permitted but must be reconciled.

- Add-to-list modal: fetch the user's lists (paginated/searchable) and support creating a new list via an API endpoint.

- Counts: public counts (e.g., loves) should be fetched separately or lazily to avoid overloading the membership API.

### Error handling

- If an optimistic update fails, revert the UI and show a temporary, non-blocking toast: "Couldn't update list. Please try again.".

- Network failures on initial fetch: show chips in default (un-set) state and allow interactions; retries or a manual refresh can re-check state.

## Behavior & edge cases

- Initial loading: while membership state is being fetched show icons in their default (outline) state but allow clicks; actions performed before state arrival should be queued or retried against the eventual canonical state.

- Auth gating: clicking a list action while unauthenticated opens a login modal/prompt. After successful login the user is redirected back to the artwork details page but must re-click the action to execute it.

- Optimistic UI & revert: apply optimistic visual changes immediately; if the backend returns an error, revert the change and surface the non-blocking toast.

- Debounce & coalescing: ignore duplicate rapid taps for the same action until the first request resolves to avoid double toggles.

- Add-to-list modal behavior: for very long lists the modal scrolls and includes a search field; saving updates the bookmark chip and triggers a membership refetch.

- Mobile layout: chips wrap to a second row when space is constrained.

- Visual separation: add a thin horizontal dividing line above and below the action bar so it reads as a distinct region.

## Metrics & counts

- Show public counts for actions (e.g., loves) but implement counts via a separate, lightweight endpoint or lazy-load to keep membership endpoints efficient.

## Acceptance criteria

- UI: chips render under artwork photo, match design tokens (sizes, spacing, colors), animate on hover/focus and show subtle pop/ripple on success.

- State: chips accurately reflect list membership after load and after toggles; component refetches membership state after mutations.

- Auth: unauthenticated users are prompted to log in; after login users return to the artwork page and must re-click to perform the action.

- Add-to-list: bookmark chip opens a searchable modal, supports "+ Create new list", and updates bookmark state after save.

- Share: opens native share sheet when available; desktop fallback provides copy-link and social shortcuts.

- Accessibility: aria-labels include action and state; keyboard activation and focus-visible support are present; reduced-motion respected.

- Counts: public counts display without overloading membership APIs (separate/lazy endpoint).

- Tests: unit tests cover rendering, toggle behavior, optimistic updates and revert; integration tests cover login gating and add-to-list flows.

## Implementation notes

- Component: create `ArtworkActionBar.vue` (Vue 3, use a `script setup lang="ts"` block) using a small internal Pinia/store-free composition hook for local state management.

- Reusable chip: implement `MChip.vue` for consistency (icon, optional label, state props, accessible API).

- Icons & tokens: reuse project icon set and Tailwind tokens. Use `note-plus`/`document-add` for Add Log and a pencil icon for Edit.

- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.

- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

## QA checklist

- Verify chips appear under the photo on desktop and mobile and wrap gracefully.

- Verify icon state is correct after initial load for logged-in users.

- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).

- Verify optimistic update + revert on backend failure with the non-blocking toast message.

- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.

- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

## Open questions / assumptions

- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.

- Assumption: icons and design tokens are available and standardized.

- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

## Appendix: sample event sequence

- Page load (user authenticated): frontend GET membership -> sets chip states.

- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.

- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.

- Components: use Material 3 Chips visual language (compact, icon + optional label). All chips should be touch-friendly (min target 44x44 CSS pixels).

- Primary action order (left to right, visually grouped): Loved (heart), Been here (flag), Want to see (star), Add to list (bookmark), Add log (note-plus/document-add), Share (share icon), Edit (pencil). Edit may be hidden for non-editors.

- Labels: show icons only by default; labels appear on hover or via an accessible label for screen readers. On wider screens (tablet/desktop) show the icon plus a small text label by default.

- Hover/focus motion: the icon inside the chip should perform a small "twitch" animation on hover/focus, matching existing artwork card interactions.

- Immediate feedback: successful state changes should show a subtle pop/ripple animation on the icon in addition to the visual state change.

## States & iconography

- Loved: outlined heart when not in list; filled red heart when in list.

- Been here: outlined flag vs filled flag (accent color when in list).

- Want to see: outlined star vs filled star (accent color when in list).

- Add to list: bookmark icon with filled state when the artwork exists in any list owned by the current user. Clicking opens the Add-to-List modal (see below).

- Add log: neutral chip; navigates to the full-page log form (e.g., `/logbook/:id`). Use a `note-plus` or `document-add` icon.

- Share: neutral chip; invokes native Web Share API when available; desktop fallback is a popover with "Copy Link" and social share shortcuts (X, Facebook, Reddit).

- Edit: visible only when `permissions.canEdit` is true. Use a pencil icon.

## Add-to-List modal

- Behavior: opens when the bookmark chip is clicked. Displays the user's lists with checkboxes to add/remove the artwork. Changes are saved via API and the bookmark chip reflects whether the artwork is in any list.

- Long lists: make modal content scrollable and include a search/filter bar at the top to help users find lists quickly.

- Create new list: include a "+ Create new list" button inside the modal to let users create a list without leaving the flow.

## Accessibility

- Each chip must have a descriptive aria-label including action and state. Example labels: "Add to Loved list — not in list" and "Remove from Loved list — in list". For list-specific active states use "Remove from [List Name]" when appropriate.

- Keyboard support: Tab navigates to each chip; Enter/Space activates. Focus ring must be visible and meet contrast requirements.

- Motion & animations: ensure reduced-motion preferences are respected.

- Screen readers: ensure chips expose role and state correctly and the Add-to-List modal is announced when opened.

## Data & API contract (frontend ↔ backend)

### Contract (frontend expectations)

- Input props to component:

  - `artworkId`: string (required)

  - `userId?`: string | null (null if unauthenticated)

  - `permissions?`: { canEdit: boolean }

  - `initialListStates?`: { loved?: boolean; beenHere?: boolean; wantToSee?: boolean; inAnyList?: boolean } (optional prefetch)

### API & fetch strategy

- Initial fetch: on mount, if `userId` is present and `initialListStates` isn't supplied by SSR, make a dedicated secondary API call to fetch membership booleans (`loved`, `beenHere`, `wantToSee`, `inAnyList`).

- Post-action refetch: after any successful mutation the component should refetch membership state from the API to ensure canonical server truth — optimistic UI is permitted but must be reconciled.

- Add-to-list modal: fetch the user's lists (paginated/searchable) and support creating a new list via an API endpoint.

- Counts: public counts (e.g., loves) should be fetched separately or lazily to avoid overloading the membership API.

### Error handling

- If an optimistic update fails, revert the UI and show a temporary, non-blocking toast: "Couldn't update list. Please try again.".

- Network failures on initial fetch: show chips in default (un-set) state and allow interactions; retries or a manual refresh can re-check state.

## Behavior & edge cases

- Initial loading: while membership state is being fetched show icons in their default (outline) state but allow clicks; actions performed before state arrival should be queued or retried against the eventual canonical state.

- Auth gating: clicking a list action while unauthenticated opens a login modal/prompt. After successful login the user is redirected back to the artwork details page but must re-click the action to execute it.

- Optimistic UI & revert: apply optimistic visual changes immediately; if the backend returns an error, revert the change and surface the non-blocking toast.

- Debounce & coalescing: ignore duplicate rapid taps for the same action until the first request resolves to avoid double toggles.

- Add-to-list modal behavior: for very long lists the modal scrolls and includes a search field; saving updates the bookmark chip and triggers a membership refetch.

- Mobile layout: chips wrap to a second row when space is constrained.

- Visual separation: add a thin horizontal dividing line above and below the action bar so it reads as a distinct region.

## Metrics & counts

- Show public counts for actions (e.g., loves) but implement counts via a separate, lightweight endpoint or lazy-load to keep membership endpoints efficient.

## Acceptance criteria

- UI: chips render under artwork photo, match design tokens (sizes, spacing, colors), animate on hover/focus and show subtle pop/ripple on success.

- State: chips accurately reflect list membership after load and after toggles; component refetches membership state after mutations.

- Auth: unauthenticated users are prompted to log in; after login users return to the artwork page and must re-click to perform the action.

- Add-to-list: bookmark chip opens a searchable modal, supports "+ Create new list", and updates bookmark state after save.

- Share: opens native share sheet when available; desktop fallback provides copy-link and social shortcuts.

- Accessibility: aria-labels include action and state; keyboard activation and focus-visible support are present; reduced-motion respected.

- Counts: public counts display without overloading membership APIs (separate/lazy endpoint).

- Tests: unit tests cover rendering, toggle behavior, optimistic updates and revert; integration tests cover login gating and add-to-list flows.

## Implementation notes

- Component: create `ArtworkActionBar.vue` (Vue 3, use a `script setup lang="ts"` block) using a small internal Pinia/store-free composition hook for local state management.

- Reusable chip: implement `MChip.vue` for consistency (icon, optional label, state props, accessible API).

- Icons & tokens: reuse project icon set and Tailwind tokens. Use `note-plus`/`document-add` for Add Log and a pencil icon for Edit.

- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.

- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

## QA checklist

- Verify chips appear under the photo on desktop and mobile and wrap gracefully.

- Verify icon state is correct after initial load for logged-in users.

- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).

- Verify optimistic update + revert on backend failure with the non-blocking toast message.

- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.

- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

## Open questions / assumptions

- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.

- Assumption: icons and design tokens are available and standardized.

- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

## Appendix: sample event sequence

- Page load (user authenticated): frontend GET membership -> sets chip states.

- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.

- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.




- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.

- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

## QA checklist

- Verify chips appear under the photo on desktop and mobile and wrap gracefully.

- Verify icon state is correct after initial load for logged-in users.

- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).

- Verify optimistic update + revert on backend failure with the non-blocking toast message.

- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.

- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

## Open questions / assumptions

- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.

- Assumption: icons and design tokens are available and standardized.

- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

## Appendix: sample event sequence

- Page load (user authenticated): frontend GET membership -> sets chip states.

- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.

- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.
# Product Requirements Document: Artwork Details — Action Bar

## Summary

Add a compact action bar below the main artwork photo on the Artwork Details page. The action bar groups common user actions (lists, logs, edit, share) into a single, mobile-first, accessible control using "chips" style buttons. The goal is to make social actions discoverable and reduce UI clutter by consolidating related actions.

## Goals

- Surface high-value actions (love, been here, want to see, add to list, add log, edit, share) near the photo where users expect them.
- Make list state obvious at-a-glance (filled vs outline icons and color accents).
- Ensure actions respect authentication: prompt login for unauthenticated actions and clearly document post-login behavior.
- Provide a small, reusable component and clear API so frontend and backend integration is simple and testable.

## User stories

- As a logged-in user, I want to tap "Loved" so that the artwork is added to my Loved list and the heart fills red.
- As a logged-in user, I want to tap "Been here" to record that I've seen the artwork (added to Have Seen list) and get a visual confirmation.
- As a logged-in user, I want to tap "Want to see" so I can save the artwork to my Want to See list.
- As an unauthenticated user, when I tap any of these actions I should be prompted to sign in. After a successful login the app redirects back to the artwork details page but the user must click the action again to perform it (login will not auto-run the original action).
- As a user, I want a single "Add to list" control to manage placing the artwork into any custom list I own; the control opens a modal listing my lists with checkboxes and a "+ Create new list" button.
- As an editor or admin user, I want an "Edit" action to open the artwork edit flow.
- As a user, I want a "Share" action that opens the native/share sheet when available and falls back to a copy-link + social shortcuts popover on desktop.

## UX & visual design

- Placement: horizontally centered under the primary photo and above metadata/details. On narrow viewports, chips may wrap to a second row.
- Components: use Material 3 Chips visual language (compact, icon + optional label). All chips should be touch-friendly (min target 44x44 CSS pixels).
- Primary action order (left to right, visually grouped): Loved (heart), Been here (flag), Want to see (star), Add to list (bookmark), Add log (note-plus/document-add), Share (share icon), Edit (pencil). Edit may be hidden for non-editors.
- Labels: show icons only by default; labels appear on hover or via an accessible label for screen readers. On wider screens (tablet/desktop) show the icon plus a small text label by default.
- Hover/focus motion: the icon inside the chip should perform a small "twitch" animation on hover/focus, matching existing artwork card interactions.
- Immediate feedback: successful state changes should show a subtle pop/ripple animation on the icon in addition to the visual state change.

## States & iconography

- Loved: outlined heart when not in list; filled red heart when in list.
- Been here: outlined flag vs filled flag (accent color when in list).
- Want to see: outlined star vs filled star (accent color when in list).
- Add to list: bookmark icon with filled state when the artwork exists in any list owned by the current user. Clicking opens the Add-to-List modal (see below).
- Add log: neutral chip; navigates to the full-page log form (e.g., `/logbook/:id`). Use a `note-plus` or `document-add` icon.
- Share: neutral chip; invokes native Web Share API when available; desktop fallback is a popover with "Copy Link" and social share shortcuts (X, Facebook, Reddit).
- Edit: visible only when `permissions.canEdit` is true. Use a pencil icon.

## Add-to-List modal

- Behavior: opens when the bookmark chip is clicked. Displays the user's lists with checkboxes to add/remove the artwork. Changes are saved via API and the bookmark chip reflects whether the artwork is in any list.
- Long lists: make modal content scrollable and include a search/filter bar at the top to help users find lists quickly.
- Create new list: include a "+ Create new list" button inside the modal to let users create a list without leaving the flow.

## Accessibility

- Each chip must have a descriptive aria-label including action and state. Example labels: "Add to Loved list — not in list" and "Remove from Loved list — in list". For list-specific active states use "Remove from [List Name]" when appropriate.
- Keyboard support: Tab navigates to each chip; Enter/Space activates. Focus ring must be visible and meet contrast requirements.
- Motion & animations: ensure reduced-motion preferences are respected.
- Screen readers: ensure chips expose role and state correctly and the Add-to-List modal is announced when opened.

## Data & API contract (frontend ↔ backend)

### Contract (frontend expectations)

- Input props to component:

  - `artworkId`: string (required)
  - `userId?`: string | null (null if unauthenticated)
  - `permissions?`: { canEdit: boolean }
  - `initialListStates?`: { loved?: boolean; beenHere?: boolean; wantToSee?: boolean; inAnyList?: boolean } (optional prefetch)

### API & fetch strategy

- Initial fetch: on mount, if `userId` is present and `initialListStates` isn't supplied by SSR, make a dedicated secondary API call to fetch membership booleans (`loved`, `beenHere`, `wantToSee`, `inAnyList`).

- Post-action refetch: after any successful mutation the component should refetch membership state from the API to ensure canonical server truth — optimistic UI is permitted but must be reconciled.

- Add-to-list modal: fetch the user's lists (paginated/searchable) and support creating a new list via an API endpoint.

- Counts: public counts (e.g., loves) should be fetched separately or lazily to avoid overloading the membership API.

### Error handling

- If an optimistic update fails, revert the UI and show a temporary, non-blocking toast: "Couldn't update list. Please try again.".

- Network failures on initial fetch: show chips in default (un-set) state and allow interactions; retries or a manual refresh can re-check state.

## Behavior & edge cases

- Initial loading: while membership state is being fetched show icons in their default (outline) state but allow clicks; actions performed before state arrival should be queued or retried against the eventual canonical state.
- Auth gating: clicking a list action while unauthenticated opens a login modal/prompt. After successful login the user is redirected back to the artwork details page but must re-click the action to execute it.
- Optimistic UI & revert: apply optimistic visual changes immediately; if the backend returns an error, revert the change and surface the non-blocking toast.
- Debounce & coalescing: ignore duplicate rapid taps for the same action until the first request resolves to avoid double toggles.
- Add-to-list modal behavior: for very long lists the modal scrolls and includes a search field; saving updates the bookmark chip and triggers a membership refetch.
- Mobile layout: chips wrap to a second row when space is constrained.
- Visual separation: add a thin horizontal dividing line above and below the action bar so it reads as a distinct region.

## Metrics & counts

- Show public counts for actions (e.g., loves) but implement counts via a separate, lightweight endpoint or lazy-load to keep membership endpoints efficient.

## Acceptance criteria

- UI: chips render under artwork photo, match design tokens (sizes, spacing, colors), animate on hover/focus and show subtle pop/ripple on success.
- State: chips accurately reflect list membership after load and after toggles; component refetches membership state after mutations.
- Auth: unauthenticated users are prompted to log in; after login users return to the artwork page and must re-click to perform the action.
- Add-to-list: bookmark chip opens a searchable modal, supports "+ Create new list", and updates bookmark state after save.
- Share: opens native share sheet when available; desktop fallback provides copy-link and social shortcuts.
- Accessibility: aria-labels include action and state; keyboard activation and focus-visible support are present; reduced-motion respected.
- Counts: public counts display without overloading membership APIs (separate/lazy endpoint).
- Tests: unit tests cover rendering, toggle behavior, optimistic updates and revert; integration tests cover login gating and add-to-list flows.

## Implementation notes

- Component: create `ArtworkActionBar.vue` (Vue 3, use a `script setup lang="ts"` block) using a small internal Pinia/store-free composition hook for local state management.
- Reusable chip: implement `MChip.vue` for consistency (icon, optional label, state props, accessible API).
- Icons & tokens: reuse project icon set and Tailwind tokens. Use `note-plus`/`document-add` for Add Log and a pencil icon for Edit.
- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.
- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

## QA checklist

- Verify chips appear under the photo on desktop and mobile and wrap gracefully.
- Verify icon state is correct after initial load for logged-in users.
- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).
- Verify optimistic update + revert on backend failure with the non-blocking toast message.
- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.
- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

## Open questions / assumptions

- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.
- Assumption: icons and design tokens are available and standardized.
- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

## Appendix: sample event sequence

- Page load (user authenticated): frontend GET membership -> sets chip states.
- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.
- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.
Product Requirements Document: Artwork Details — Action Bar

Summary
-------
Add a compact action bar below the main artwork photo on the Artwork Details page. The action bar groups common user actions (lists, logs, edit, share) into a single, mobile-first, accessible control using "chips" style buttons. The goal is to make social actions discoverable and reduce UI clutter by consolidating related actions.

Goals
-----
- Surface high-value actions (love, been here, want to see, add to list, add log, edit, share) near the photo where users expect them.
- Make list state obvious at-a-glance (filled vs outline icons and color accents).
- Ensure actions respect authentication: prompt login for unauthenticated actions and clearly document post-login behavior.
- Provide a small, reusable component and clear API so frontend and backend integration is simple and testable.

User stories
------------
- As a logged-in user, I want to tap "Loved" so that the artwork is added to my Loved list and the heart fills red.
- As a logged-in user, I want to tap "Been here" to record that I've seen the artwork (added to Have Seen list) and get a visual confirmation.
- As a logged-in user, I want to tap "Want to see" so I can save the artwork to my Want to See list.
- As an unauthenticated user, when I tap any of these actions I should be prompted to sign in. After a successful login the app redirects back to the artwork details page but the user must click the action again to perform it (login will not auto-run the original action).
- As a user, I want a single "Add to list" control to manage placing the artwork into any custom list I own; the control opens a modal listing my lists with checkboxes and a "+ Create new list" button.
- As an editor or admin user, I want an "Edit" action to open the artwork edit flow.
- As a user, I want a "Share" action that opens the native/share sheet when available and falls back to a copy-link + social shortcuts popover on desktop.

UX & visual design
-------------------
- Placement: horizontally centered under the primary photo and above metadata/details. On narrow viewports, chips may wrap to a second row.
- Components: use Material 3 Chips visual language (compact, icon + optional label). All chips should be touch-friendly (min target 44x44 CSS pixels).
- Primary action order (left to right, visually grouped): Loved (heart), Been here (flag), Want to see (star), Add to list (bookmark), Add log (note-plus/document-add), Share (share icon), Edit (pencil). Edit may be hidden for non-editors.
- Labels: show icons only by default; labels appear on hover or via an accessible label for screen readers. On wider screens (tablet/desktop) show the icon plus a small text label by default.
- Hover/focus motion: the icon inside the chip should perform a small "twitch" animation on hover/focus, matching existing artwork card interactions.
- Immediate feedback: successful state changes should show a subtle pop/ripple animation on the icon in addition to the visual state change.

States & iconography
---------------------
- Loved: outlined heart when not in list; filled red heart when in list.
- Been here: outlined flag vs filled flag (accent color when in list).
- Want to see: outlined star vs filled star (accent color when in list).
- Add to list: bookmark icon with filled state when the artwork exists in any list owned by the current user. Clicking opens the Add-to-List modal (see below).
- Add log: neutral chip; navigates to the full-page log form (e.g., `/logbook/:id`). Use a `note-plus` or `document-add` icon.
- Share: neutral chip; invokes native Web Share API when available; desktop fallback is a popover with "Copy Link" and social share shortcuts (X, Facebook, Reddit).
- Edit: visible only when `permissions.canEdit` is true. Use a pencil icon.

Add-to-List modal
------------------
- Behavior: opens when the bookmark chip is clicked. Displays the user's lists with checkboxes to add/remove the artwork. Changes are saved via API and the bookmark chip reflects whether the artwork is in any list.
- Long lists: make modal content scrollable and include a search/filter bar at the top to help users find lists quickly.
- Create new list: include a "+ Create new list" button inside the modal to let users create a list without leaving the flow.

Accessibility
-------------
- Each chip must have a descriptive aria-label including action and state. Example labels: "Add to Loved list — not in list" and "Remove from Loved list — in list". For list-specific active states use "Remove from [List Name]" when appropriate.
- Keyboard support: Tab navigates to each chip; Enter/Space activates. Focus ring must be visible and meet contrast requirements.
- Motion & animations: ensure reduced-motion preferences are respected.
- Screen readers: ensure chips expose role and state correctly and the Add-to-List modal is announced when opened.

Data & API contract (frontend ↔ backend)
---------------------------------------
Contract (frontend expectations):
- Input props to component:
  - `artworkId`: string (required)
  - `userId?`: string | null (null if unauthenticated)
  - `permissions?`: { canEdit: boolean }
  - `initialListStates?`: { loved?: boolean; beenHere?: boolean; wantToSee?: boolean; inAnyList?: boolean } (optional prefetch)

- API & fetch strategy:
  - Initial fetch: on mount, if `userId` is present and `initialListStates` isn't supplied by SSR, make a dedicated secondary API call to fetch membership booleans (`loved`, `beenHere`, `wantToSee`, `inAnyList`).
  - Post-action refetch: after any successful mutation the component should refetch membership state from the API to ensure canonical server truth — optimistic UI is permitted but must be reconciled.
  - Add-to-list modal: fetch the user's lists (paginated/searchable) and support creating a new list via an API endpoint.
  - Counts: public counts (e.g., loves) should be fetched separately or lazily to avoid overloading the membership API.

- Error handling:
  - If an optimistic update fails, revert the UI and show a temporary, non-blocking toast: "Couldn't update list. Please try again.".
  - Network failures on initial fetch: show chips in default (un-set) state and allow interactions; retries or a manual refresh can re-check state.

Behavior & edge cases
---------------------
- Initial loading: while membership state is being fetched show icons in their default (outline) state but allow clicks; actions performed before state arrival should be queued or retried against the eventual canonical state.
- Auth gating: clicking a list action while unauthenticated opens a login modal/prompt. After successful login the user is redirected back to the artwork details page but must re-click the action to execute it.
- Optimistic UI & revert: apply optimistic visual changes immediately; if the backend returns an error, revert the change and surface the non-blocking toast.
- Debounce & coalescing: ignore duplicate rapid taps for the same action until the first request resolves to avoid double toggles.
- Add-to-list modal behavior: for very long lists the modal scrolls and includes a search field; saving updates the bookmark chip and triggers a membership refetch.
- Mobile layout: chips wrap to a second row when space is constrained.
- Visual separation: add a thin horizontal dividing line above and below the action bar so it reads as a distinct region.

Metrics & counts
----------------
- Show public counts for actions (e.g., loves) but implement counts via a separate, lightweight endpoint or lazy-load to keep membership endpoints efficient.

Acceptance criteria
-------------------
- UI: chips render under artwork photo, match design tokens (sizes, spacing, colors), animate on hover/focus and show subtle pop/ripple on success.
- State: chips accurately reflect list membership after load and after toggles; component refetches membership state after mutations.
- Auth: unauthenticated users are prompted to log in; after login users return to the artwork page and must re-click to perform the action.
- Add-to-list: bookmark chip opens a searchable modal, supports "+ Create new list", and updates bookmark state after save.
- Share: opens native share sheet when available; desktop fallback provides copy-link and social shortcuts.
- Accessibility: aria-labels include action and state; keyboard activation and focus-visible support are present; reduced-motion respected.
- Counts: public counts display without overloading membership APIs (separate/lazy endpoint).
- Tests: unit tests cover rendering, toggle behavior, optimistic updates and revert; integration tests cover login gating and add-to-list flows.

Implementation notes
--------------------
- Component: create `ArtworkActionBar.vue` (Vue 3, use a `script setup lang="ts"` block) using a small internal Pinia/store-free composition hook for local state management.
- Reusable chip: implement `MChip.vue` for consistency (icon, optional label, state props, accessible API).
- Icons & tokens: reuse project icon set and Tailwind tokens. Use `note-plus`/`document-add` for Add Log and a pencil icon for Edit.
- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.
- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

QA checklist
------------
- Verify chips appear under the photo on desktop and mobile and wrap gracefully.
- Verify icon state is correct after initial load for logged-in users.
- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).
- Verify optimistic update + revert on backend failure with the non-blocking toast message.
- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.
- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

Open questions / assumptions
---------------------------
- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.
- Assumption: icons and design tokens are available and standardized.
- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

Appendix: sample event sequence
------------------------------
- Page load (user authenticated): frontend GET membership -> sets chip states.
- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.
- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.
Product Requirements Document: Artwork Details — Action Bar

Summary
-------
Add a compact action bar below the main artwork photo on the Artwork Details page. The action bar groups common user actions (lists, logs, edit, share) into a single, mobile-first, accessible control using "chips" style buttons. The goal is to make social actions discoverable and reduce UI clutter by consolidating related actions.

Goals
-----
- Surface high-value actions (love, been here, want to see, add to list, add log, edit, share) near the photo where users expect them.
- Make list state obvious at-a-glance (filled vs outline icons and color accents).
- Ensure actions respect authentication: prompt login for unauthenticated actions and clearly document post-login behavior.
- Provide a small, reusable component and clear API so frontend and backend integration is simple and testable.

User stories
------------
- As a logged-in user, I want to tap "Loved" so that the artwork is added to my Loved list and the heart fills red.
- As a logged-in user, I want to tap "Been here" to record that I've seen the artwork (added to Have Seen list) and get a visual confirmation.
- As a logged-in user, I want to tap "Want to see" so I can save the artwork to my Want to See list.
- As an unauthenticated user, when I tap any of these actions I should be prompted to sign in. After a successful login the app redirects back to the artwork details page but the user must click the action again to perform it (login will not auto-run the original action).
- As a user, I want a single "Add to list" control to manage placing the artwork into any custom list I own; the control opens a modal listing my lists with checkboxes and a "+ Create new list" button.
- As an editor or admin user, I want an "Edit" action to open the artwork edit flow.
- As a user, I want a "Share" action that opens the native/share sheet when available and falls back to a copy-link + social shortcuts popover on desktop.

UX & visual design
-------------------
- Placement: horizontally centered under the primary photo and above metadata/details. On narrow viewports, chips may wrap to a second row.
- Components: use Material 3 Chips visual language (compact, icon + optional label). All chips should be touch-friendly (min target 44x44 CSS pixels).
- Primary action order (left to right, visually grouped): Loved (heart), Been here (flag), Want to see (star), Add to list (bookmark), Add log (note-plus/document-add), Share (share icon), Edit (pencil) — Edit may be hidden for non-editors.
- Labels: show icons only by default; labels appear on hover or via an accessible label for screen readers. On wider screens (tablet/desktop) show the icon plus a small text label by default.
- Hover/focus motion: the icon inside the chip should perform a small "twitch" animation on hover/focus, matching existing artwork card interactions.
- Immediate feedback: successful state changes should show a subtle pop/ripple animation on the icon in addition to the visual state change.

States & iconography
---------------------
- Loved: outlined heart when not in list; filled red heart when in list.
- Been here: outlined flag vs filled flag (accent color when in list).
- Want to see: outlined star vs filled star (accent color when in list).
- Add to list: bookmark icon with filled state when the artwork exists in any list owned by the current user. Clicking opens the Add-to-List modal (see below).
- Add log: neutral chip; navigates to the full-page log form (e.g., `/logbook/:id`). Use a `note-plus` or `document-add` icon.
- Share: neutral chip; invokes native Web Share API when available; desktop fallback is a popover with "Copy Link" and social share shortcuts (X, Facebook, Reddit).
- Edit: visible only when `permissions.canEdit` is true. Use a pencil icon.

Add-to-List modal
------------------
- Behavior: opens when the bookmark chip is clicked. Displays the user's lists with checkboxes to add/remove the artwork. Changes are saved via API and the bookmark chip reflects whether the artwork is in any list.
- Long lists: make modal content scrollable and include a search/filter bar at the top to help users find lists quickly.
- Create new list: include a "+ Create new list" button inside the modal to let users create a list without leaving the flow.

Accessibility
-------------
- Each chip must have a descriptive aria-label including action and state. Example labels: "Add to Loved list — not in list" and "Remove from Loved list — in list". For list-specific active states use "Remove from [List Name]" when appropriate.
- Keyboard support: Tab navigates to each chip; Enter/Space activates. Focus ring must be visible and meet contrast requirements.
- Motion & animations: ensure reduced-motion preferences are respected.
- Screen readers: ensure chips expose role and state correctly and the Add-to-List modal is announced when opened.

Data & API contract (frontend ↔ backend)
---------------------------------------
Contract (frontend expectations):
- Input props to component:
  - `artworkId`: string (required)
  - `userId?`: string | null (null if unauthenticated)
  - `permissions?`: { canEdit: boolean }
  - `initialListStates?`: { loved?: boolean; beenHere?: boolean; wantToSee?: boolean; inAnyList?: boolean } (optional prefetch)

- API & fetch strategy:
  - Initial fetch: on mount, if `userId` is present and `initialListStates` isn't supplied by SSR, make a dedicated secondary API call to fetch membership booleans (`loved`, `beenHere`, `wantToSee`, `inAnyList`).
  - Post-action refetch: after any successful mutation the component should refetch membership state from the API to ensure canonical server truth — optimistic UI is permitted but must be reconciled.
  - Add-to-list modal: fetch the user's lists (paginated/searchable) and support creating a new list via an API endpoint.
  - Counts: public counts (e.g., loves) should be fetched separately or lazily to avoid overloading the membership API.

- Error handling:
  - If an optimistic update fails, revert the UI and show a temporary, non-blocking toast: "Couldn't update list. Please try again.".
  - Network failures on initial fetch: show chips in default (un-set) state and allow interactions; retries or a manual refresh can re-check state.

Behavior & edge cases
---------------------
- Initial loading: while membership state is being fetched show icons in their default (outline) state but allow clicks; actions performed before state arrival should be queued or retried against the eventual canonical state.
- Auth gating: clicking a list action while unauthenticated opens a login modal/prompt. After successful login the user is redirected back to the artwork details page but must re-click the action to execute it.
- Optimistic UI & revert: apply optimistic visual changes immediately; if the backend returns an error, revert the change and surface the non-blocking toast.
- Debounce & coalescing: ignore duplicate rapid taps for the same action until the first request resolves to avoid double toggles.
- Add-to-list modal behavior: for very long lists the modal scrolls and includes a search field; saving updates the bookmark chip and triggers a membership refetch.
- Mobile layout: chips wrap to a second row when space is constrained.
- Visual separation: add a thin horizontal dividing line above and below the action bar so it reads as a distinct region.

Metrics & counts
----------------
- Show public counts for actions (e.g., loves) but implement counts via a separate, lightweight endpoint or lazy-load to keep membership endpoints efficient.

Acceptance criteria
-------------------
- UI: chips render under artwork photo, match design tokens (sizes, spacing, colors), animate on hover/focus and show subtle pop/ripple on success.
- State: chips accurately reflect list membership after load and after toggles; component refetches membership state after mutations.
- Auth: unauthenticated users are prompted to log in; after login users return to the artwork page and must re-click to perform the action.
- Add-to-list: bookmark chip opens a searchable modal, supports "+ Create new list", and updates bookmark state after save.
- Share: opens native share sheet when available; desktop fallback provides copy-link and social shortcuts.
- Accessibility: aria-labels include action and state; keyboard activation and focus-visible support are present; reduced-motion respected.
- Counts: public counts display without overloading membership APIs (separate/lazy endpoint).
- Tests: unit tests cover rendering, toggle behavior, optimistic updates and revert; integration tests cover login gating and add-to-list flows.

Implementation notes
--------------------
- Component: create `ArtworkActionBar.vue` (Vue 3, use a `<code>script setup lang="ts"</code>` block) using a small internal Pinia/store-free composition hook for local state management.
- Reusable chip: implement `MChip.vue` for consistency (icon, optional label, state props, accessible API).
- Icons & tokens: reuse project icon set and Tailwind tokens. Use `note-plus`/`document-add` for Add Log and a pencil icon for Edit.
- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.
- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

QA checklist
------------
- Verify chips appear under the photo on desktop and mobile and wrap gracefully.
- Verify icon state is correct after initial load for logged-in users.
- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).
- Verify optimistic update + revert on backend failure with the non-blocking toast message.
- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.
- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

Open questions / assumptions
---------------------------
- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.
- Assumption: icons and design tokens are available and standardized.
- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

Appendix: sample event sequence
------------------------------
- Page load (user authenticated): frontend GET membership -> sets chip states.
- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.
- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.
Product Requirements Document: Artwork Details — Action Bar

Summary
-------
Add a compact action bar below the main artwork photo on the Artwork Details page. The action bar groups common user actions (lists, logs, edit, share) into a single, mobile-first, accessible control using "chips" style buttons. The goal is to make social actions discoverable and reduce UI clutter by consolidating related actions.

Goals
-----
- Surface high-value actions (love, been here, want to see, add to list, add log, edit, share) near the photo where users expect them.
- Make list state obvious at-a-glance (filled vs outline icons and color accents).
- Ensure actions respect authentication: prompt login for unauthenticated actions and clearly document post-login behavior.
- Provide a small, reusable component and clear API so frontend and backend integration is simple and testable.

User stories
------------
- As a logged-in user, I want to tap "Loved" so that the artwork is added to my Loved list and the heart fills red.
- As a logged-in user, I want to tap "Been here" to record that I've seen the artwork (added to Have Seen list) and get a visual confirmation.
- As a logged-in user, I want to tap "Want to see" so I can save the artwork to my Want to See list.
- As an unauthenticated user, when I tap any of these actions I should be prompted to sign in. After a successful login the app redirects back to the artwork details page but the user must click the action again to perform it (login will not auto-run the original action).
- As a user, I want a single "Add to list" control to manage placing the artwork into any custom list I own; the control opens a modal listing my lists with checkboxes and a "+ Create new list" button.
- As an editor or admin user, I want an "Edit" action to open the artwork edit flow.
- As a user, I want a "Share" action that opens the native/share sheet when available and falls back to a copy-link + social shortcuts popover on desktop.

UX & visual design
-------------------
- Placement: horizontally centered under the primary photo and above metadata/details. On narrow viewports, chips may wrap to a second row.
- Components: use Material 3 Chips visual language (compact, icon + optional label). All chips should be touch-friendly (min target 44x44 CSS pixels).
- Primary action order (left to right, visually grouped): Loved (heart), Been here (flag), Want to see (star), Add to list (bookmark), Add log (note-plus/document-add icon), Share (share icon), Edit (pencil) — Edit may be hidden for non-editors.
- Labels: show icons only by default; labels appear on hover or via an optional accessible label for screen readers. On wider screens (tablet/desktop) show the icon plus a small text label (text under or beside the icon) by default.
- Hover/focus motion: the icon inside the chip should perform a small "twitch" animation on hover/focus, matching existing artwork card interactions.
- Immediate feedback: successful state changes should show a subtle pop/ripple animation on the icon in addition to the visual state change.

States & iconography
---------------------
- Loved: outlined heart when not in list; filled red heart when in list.
- Been here: outlined flag vs filled flag (accent color when in list).
- Want to see: outlined star vs filled star (accent color when in list).
- Add to list: bookmark icon with filled state when the artwork exists in any list owned by the current user. Clicking opens the Add-to-List modal (see below).
- Add log: neutral chip; navigates to the full-page log form (e.g., `/logbook/:id`). Use a "note-plus" or "document-add" icon.
- Share: neutral chip; invokes native Web Share API when available; desktop fallback is a popover with "Copy Link" and social share shortcuts (X, Facebook, Reddit).
- Edit: visible only when `permissions.canEdit` is true. Use a pencil icon.

Add-to-List modal
------------------
- Behavior: opens when the bookmark chip is clicked. Displays the user's lists with checkboxes to add/remove the artwork. Changes are saved via API and the bookmark chip reflects whether the artwork is in any list.
- Long lists: make modal content scrollable and include a search/filter bar at the top to help users find lists quickly.
- Create new list: include a "+ Create new list" button inside the modal to let users create a list without leaving the flow.

Accessibility
-------------
- Each chip must have a descriptive aria-label including action and state. Example labels: "Add to Loved list — not in list" and "Remove from Loved list — in list". For list-specific active states use "Remove from [List Name]" when appropriate.
- Keyboard support: Tab navigates to each chip; Enter/Space activates. Focus ring must be visible and meet contrast requirements.
- Motion & animations: ensure reduced-motion preferences are respected.
- Screen readers: ensure chips expose role and state correctly and the Add-to-List modal is announced when opened.

Data & API contract (frontend ↔ backend)
---------------------------------------
Contract (frontend expectations):
- Input props to component:
  - artworkId: string (required)
  - userId?: string | null (null if unauthenticated)
  - permissions?: { canEdit: boolean }
  - initialListStates?: { loved?: boolean; beenHere?: boolean; wantToSee?: boolean; inAnyList?: boolean } (optional prefetch)

- API & fetch strategy:
  - Initial fetch: on mount, if `userId` is present and `initialListStates` isn't supplied by SSR, make a dedicated secondary API call to fetch membership booleans (loved, beenHere, wantToSee, inAnyList).
  - Post-action refetch: after any successful mutation the component should refetch membership state from the API to ensure canonical server truth — optimistic UI is permitted but must be reconciled.
  - Add-to-list modal: fetch the user's lists (paginated/searchable) and support creating a new list via an API endpoint.
  - Counts: public counts (e.g., loves) should be fetched separately or lazily to avoid overloading the membership API.

- Error handling:
  - If an optimistic update fails, revert the UI and show a temporary, non-blocking toast: "Couldn't update list. Please try again.".
  - Network failures on initial fetch: show chips in default (un-set) state and allow interactions; retries or a manual refresh can re-check state.

Behavior & edge cases
---------------------
- Initial loading: while membership state is being fetched show icons in their default (outline) state but allow clicks; actions performed before state arrival should be queued or retried against the eventual canonical state.
- Auth gating: clicking a list action while unauthenticated opens a login modal/prompt. After successful login the user is redirected back to the artwork details page but must re-click the action to execute it.
- Optimistic UI & revert: apply optimistic visual changes immediately; if the backend returns an error, revert the change and surface the non-blocking toast.
- Debounce & coalescing: ignore duplicate rapid taps for the same action until the first request resolves to avoid double toggles.
- Add-to-list modal behavior: for very long lists the modal scrolls and includes a search field; saving updates the bookmark chip and triggers a membership refetch.
- Mobile layout: chips wrap to a second row when space is constrained.
- Visual separation: add a thin horizontal dividing line above and below the action bar so it reads as a distinct region.

Metrics & counts
----------------
- Show public counts for actions (e.g., loves) but implement counts via a separate, lightweight endpoint or lazy-load to keep membership endpoints efficient.

Acceptance criteria
-------------------
- UI: chips render under artwork photo, match design tokens (sizes, spacing, colors), animate on hover/focus and show subtle pop/ripple on success.
- State: chips accurately reflect list membership after load and after toggles; component refetches membership state after mutations.
- Auth: unauthenticated users are prompted to log in; after login users return to the artwork page and must re-click to perform the action.
- Add-to-list: bookmark chip opens a searchable modal, supports "+ Create new list", and updates bookmark state after save.
- Share: opens native share sheet when available; desktop fallback provides copy-link and social shortcuts.
- Accessibility: aria-labels include action and state; keyboard activation and focus-visible support are present; reduced-motion respected.
- Counts: public counts display without overloading membership APIs (separate/lazy endpoint).
- Tests: unit tests cover rendering, toggle behavior, optimistic updates and revert; integration tests cover login gating and add-to-list flows.

Implementation notes
--------------------
- Component: create `ArtworkActionBar.vue` (Vue 3, <script setup lang="ts">) using a small internal Pinia/store-free composition hook for local state management.
- Reusable chip: implement `MChip.vue` for consistency (icon, optional label, state props, accessible API).
- Icons & tokens: reuse project icon set and Tailwind tokens. Use "note-plus"/"document-add" for Add Log and a pencil icon for Edit.
- Tests: add Vitest unit tests in `src/frontend/src/components/__tests__/ArtworkActionBar.spec.ts` and a Playwright E2E check for login gating and add-to-list.
- Dev notes: prefer refetching membership after mutations rather than relying solely on optimistic state, and debounce duplicate requests.

QA checklist
------------
- Verify chips appear under the photo on desktop and mobile and wrap gracefully.
- Verify icon state is correct after initial load for logged-in users.
- Verify unauthenticated clicks trigger the login flow and post-login returns user to artwork page (requires user to re-click the action).
- Verify optimistic update + revert on backend failure with the non-blocking toast message.
- Verify share works on Android/iOS and that desktop shows copy-link + socials fallback.
- Verify keyboard navigation, ARIA labels and reduced-motion behavior.

Open questions / assumptions
---------------------------
- Assumption: the app has an existing login modal flow that can be invoked and returns control to the artwork page after success.
- Assumption: icons and design tokens are available and standardized.
- If server-side prefetch of list membership isn't available, frontend will call a dedicated GET membership endpoint on mount.

Appendix: sample event sequence
------------------------------
- Page load (user authenticated): frontend GET membership -> sets chip states.
- User taps Loved (not in list): UI sets heart filled (optimistic); POST toggle endpoint called -> on success keep state; on error revert and show toast.
- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> membership refetch updates bookmark chip.
*** End Patch
- Verify icon state correct after initial load for logged-in user.
- Verify unauthenticated clicks trigger login modal and post-login action applies correctly.
- Verify optimistic update + revert on backend failure.
- Verify share works on Android/iOS/chrome desktop (copy link fallback).
- Verify keyboard navigation and screen reader labels.

## Open questions / assumptions

- Assumption: app has an existing login modal flow that can be invoked and returns control to the artwork page after success.
- Assumption: icons and design tokens are available and standardized.
- If server-side prefetch of list membership is not available, frontend will call GET membership endpoint on mount.

## Appendix: sample event sequence

- Page load (user authenticated): frontend GET membership -> sets chip states.
- User taps Loved (not in list): UI sets heart filled; POST toggle endpoint called -> on success keep state; on error revert and show toast.
- User taps Add to list: open modal -> selects lists -> saves -> modal closes -> bookmark chip fills.
