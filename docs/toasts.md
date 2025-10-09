# Global toast system (frontend)

Overview

The frontend uses a centralized toast system to display transient notifications across the app. This keeps UX consistent and reduces duplication.

Core pieces

- `src/frontend/src/stores/toasts.ts` — Pinia store that holds an array of `ToastItem` objects. Each item includes an optional `payload` field for structured data.
- `src/frontend/src/composables/useToasts.ts` — Composable exposing typed helpers:
  - `push(message, type?, timeoutMs?)` — generic push
  - `success(message, timeoutMs?)`, `error(...)`, `info(...)`, `warning(...)` — convenience wrappers
  - `badge(badgePayload, timeoutMs?)` — pushes a structured badge toast (see below)
  - `remove(id)`, `clear()` — removal helpers
- `src/frontend/src/components/Toasts.vue` — global renderer mounted in `AppShell.vue`. It reads `toasts` from the store and renders them. For structured payloads the renderer delegates to specific presentational components (e.g. `BadgeToast.vue`).

Badge toasts

The current structured payload type supports `kind: 'badge'` with a `badge` object. `BadgePayload` fields:

- `badge_id` (string) — identifier for the badge
- `badge_key` (string, optional)
- `title` (string, optional)
- `description` (string, optional)
- `icon_emoji` (string, optional)
- `award_reason` (string, optional)

To show a badge toast from application code:

- Use the composable:
  const { badge } = useToasts();
  badge({ badge_id: 'abc', title: 'Nice!', description: 'You earned a badge' }, 8000);

- `Toasts.vue` will render `BadgeToast.vue` for toasts whose `payload.kind === 'badge'`.

Testing notes

- Tests that mount `Toasts.vue` must share the same Pinia instance as the test context. Create a Pinia instance with `createPinia()` and call `setActivePinia(pinia)` before mounting the component.
- The suite includes an integration test: `src/frontend/src/components/__tests__/BadgeToast.integration.spec.ts` which verifies the badge path.

Future

- If we add more structured notification kinds, extend `ToastPayload` as a discriminated union and add presentational components for each.
- Consider adding actions/callbacks to payloads for interactive toasts (confirm/dismiss actions).

