# Notifications UI

This document describes the Notifications UI and testing guidance.

## Header mark-all behavior

- The notification popup (accessed via the bell in the header) now exposes a "Mark all as read" button in the header when there are unread notifications.  
- The list in the popup is sorted with unread notifications at the top, then by newest first. The panel shows up to 10 notifications for quick access.

Clicking the header "Mark all as read" calls the frontend store action which in turn marks each in-memory unread notification as read. The backend currently does not provide a bulk API, so the store calls the per-notification mark-read endpoint in a best-effort loop.

## Accessibility

- The header button has aria-label="Mark all notifications as read" for reliable selector targeting in tests.

## Notes for developers

- The popup component is `src/frontend/src/components/NotificationPanel.vue` and is wrapped by `NotificationIcon.vue` in the header.  
- The store is `src/frontend/src/stores/notifications.ts` and provides `markAllRead()` and `markNotificationRead()` functions.

## Testing

- Unit tests are written with Vitest and Vue Test Utils; See `src/frontend/src/components/__tests__/NotificationPanel.test.ts` for an example of a unit test that asserts the header button triggers the store action. The test uses a single Pinia instance so the mounted component sees the same reactive store state.

- End-to-end tests use Playwright. The Playwright config is at `src/frontend/playwright.config.ts` with baseURL `http://localhost:5173`.

Running Playwright tests locally (from project root):

```powershell
# Start the dev server in one terminal
cd src/frontend; npm run dev

# In another terminal run playwright tests
cd src/frontend; npm run test:e2e
```

If the dev server uses a different port adjust `baseURL` in `src/frontend/playwright.config.ts` or use `PW_BASE_URL` env var when running the tests.
