# User Permissions Audit (2025-09-08)

This audit was performed to identify any deprecated user permission types (specifically `reviewer`) and enumerate all active permission types in the codebase.

## Findings

Active permission constants / types in code:

- `anonymous` (implicit state – UUID token without elevated permissions)
- `moderator` (grants review / approval abilities)
- `admin` (grants administrative + moderator capabilities)

Deprecated / transitional identifiers encountered:

- `reviewer` – Present only in legacy variable names, comments, and boolean fields like `isReviewer`; not persisted as a distinct permission in the current permission type union (`'moderator' | 'admin'`). Migration `0008_replace_reviewer_with_moderator.sql` ensures any lingering database rows using `reviewer` are normalized to `moderator`.

New canonical runtime flags (added 2025-09-08):

- `isModerator` – Preferred explicit moderator privilege boolean (maps to DB permission `moderator` or higher)
- `canReview` – Convenience flag: true if user can perform moderation actions (currently identical to `isModerator` or admin)

Backward compatibility fields:

- `isReviewer` – Deprecated alias; will be removed after a deprecation window (target removal date to be scheduled; tentatively Q4 2025). Provided temporarily in API responses (`is_reviewer`) alongside `is_moderator` & `can_review`.

Other terms observed (NOT permission types):

- `isVerifiedEmail` / `email_verified_at` – Represents email verification status, not a role.
- `is_anonymous` – Derived flag, not stored as a permission.

## Migration Added

`src/workers/migrations/0008_replace_reviewer_with_moderator.sql` converts any existing `reviewer` rows in `user_permissions` to `moderator` and removes duplicates.

## Recommended Follow-up (Status 2025-09-08)

| Item | Status |
|------|--------|
| Rename code references (`isReviewer` -> `isModerator` / `canReview`) | In progress (most routes & UI updated) |
| Test asserting no `reviewer` rows remain | Implemented (`permissions.migration.test.ts`) |
| Frontend copy updated to “Moderator” | Mostly complete (residual debug fields only) |
| Add API doc entries for `is_moderator` / `can_review` | Pending (this PR) |
| Add CHANGELOG deprecation note | Pending |
| Introduce runtime deprecation warning | Pending (optional) |
| Schedule final removal issue | Pending |

Planned removal phases:

1. Introduction (DONE) – Add new flags, keep deprecated alias.
2. Transition (ACTIVE) – Update docs & UI; discourage new `isReviewer` usage.
3. Warning (UPCOMING) – Emit one-time console warning on backend/frontend access.
4. Removal (Q4 2025 tentative) – Drop `isReviewer` from types, API payloads, and tests.

## Verification Query (manual)

```sql
SELECT permission, COUNT(*) AS count
FROM user_permissions
GROUP BY permission;
```

All valid rows should now be only `moderator` or `admin`.

---
Generated automatically as part of role consolidation.
