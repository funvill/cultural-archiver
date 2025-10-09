# Edit Workflow

This document summarizes the artwork edit workflow and recent UI changes.

Summary:

- Authenticated users can propose edits to artwork details (title, description, artists, keywords).
- Edits are submitted as `submission_type: 'artwork_edit'` and enter the moderation queue for curator review.
- Approved edits update the artwork row and related `artwork_artists` associations.

Recent UI change:

- The "Report Missing" and "Report Issue" actions have been moved into the artwork action bar. The "Report Issue" control now uses a dedicated 'bug' icon in the action bar chip.

Developer notes:

- The frontend uses `ArtworkActionBar.vue` to render action chips. The new actions emit `reportMissing` and `reportIssue` events which the parent view (`ArtworkDetailView.vue`) listens for and opens the `FeedbackDialog`.
- Keep `FeedbackDialog.vue` behaviour unchanged; only the location of its triggers changed.

Testing:

- Verify clicking the "Report Missing" and "Report Issue" chips opens the `FeedbackDialog` with appropriate mode (`missing` vs `comment`).
- Run frontend tests and the workers tests after making changes.

Additional developer note:

- The "Report Missing" and "Report Issue" triggers were moved from the detail view into the `ArtworkActionBar` as action chips. The `reportIssue` chip uses the 'bug' icon. When updating UI tests, target the action bar chips and the `reportMissing` / `reportIssue` emitted events instead of the old button elements.

