# PRD: Artwork Editing System

## Introduction/Overview

This feature enables logged-in users to edit artwork details directly from the artwork details page, similar to a wiki-style collaborative editing system. Users can update key information about artworks (title, description, creators, tags) through inline editing, with all changes subject to moderator approval before publication. This enhances the public resource by allowing community contributions to improve the knowledge and accuracy of artwork information.

**Problem Statement:** Currently, artwork information can only be updated by moderators or through new submissions. There's no way for the community to contribute corrections, additional details, or improvements to existing artwork records.

**Goal:** Create a collaborative editing system that allows any logged-in user to propose improvements to artwork details while maintaining quality through moderation.

## Goals

1. Enable community-driven improvement of artwork information quality and completeness
2. Provide an intuitive inline editing interface for artwork details
3. Maintain content quality through existing moderation workflows
4. Create transparency in edit history through logbook entries
5. Encourage user engagement with artwork detail pages

## User Stories

1. **As a gallery visitor,** I want to correct a typo in the artwork's description so that the information is accurate for everyone.

2. **As an art enthusiast,** I want to add relevant tags to an artwork to improve its discoverability through search.

3. **As a moderator,** I want to review proposed changes with a clear before/after comparison to ensure they are accurate and appropriate before they become public.

4. **As a community member,** I want to see the edit history of an artwork in the logbook to understand how the information has evolved over time.

## Functional Requirements

### User Interface Requirements

1. The system must display an "Edit" button on artwork detail pages for logged-in users.
2. When a user clicks "Edit", all editable fields must immediately transform into input boxes.
3. Read-only fields (location, photos, internal fields) must appear disabled (grayed out) and unchangeable.
4. The system must show a prominent "Save" button when in edit mode.
5. The system must show a "Cancel" button that discards changes with confirmation dialog.
6. Tag fields must be implemented as interactive tag chips that users can add/remove.
7. The interface must work consistently on both desktop and mobile devices.

### Editable Fields

8. Users must be able to edit the following fields:
   - Title (max 512 characters)
   - Description (Markdown formatting supported)
   - Created by (comma-separated list of creators)
   - Tags/Keywords (comma-separated, displayed as chips)

### Submission and Validation

9. The system must allow users to save only once when completely done with all changes.
10. Upon saving, users must see a "Your changes have been submitted for review" message and return to normal view.
11. The system must not perform validation on edits - moderators will handle all quality control.
12. Users must be able to see their pending edits with a message showing "You have a pending edit for this artwork - [field names] modified".

### Rate Limiting

13. The system must enforce a rate limit of 500 edits per 24-hour period per user.

### Moderation Integration

14. All edit submissions must be added to the existing moderation queue alongside new artwork submissions in chronological order.
15. Moderators must see a diff view (like GitHub) highlighting exactly what changed for each field.
16. Moderators must be able to approve or reject entire edit submissions (all-or-nothing).
17. Moderators must be able to provide text feedback when rejecting edits.
18. The system must track which moderator approved/rejected each edit for audit purposes (visible to moderators only).
19. If another user has a pending edit for the same artwork, new edits must still be allowed, and moderators will see both submissions independently.

### Logbook Integration

20. Approved changes must automatically create logbook entries showing:
    - "Artwork details updated on [date] by [anonymous user token]"
    - Specific fields that were modified
    - Before/after values for transparency

### Error Handling

21. The system must implement full error handling for network errors, validation errors, and other failure scenarios.
22. Error messages must be user-friendly and actionable.

## Non-Goals (Out of Scope)

1. **Email notifications** - Users will not be notified whether their edits were approved or rejected in this initial version.
2. **Edit modification** - Users cannot edit their submissions after saving; they must submit new changes.
3. **Conflict resolution** - No special handling for simultaneous edits beyond allowing multiple pending submissions.
4. **Advanced validation** - No profanity filters or spam detection (moderators handle quality control).
5. **Partial approvals** - Moderators cannot approve some fields while rejecting others.
6. **Draft saving** - No auto-save or draft functionality.
7. **Anonymous editing** - Only logged-in users can edit artwork details.

## Design Considerations

- **Reuse Existing Components:** Leverage existing form components from the current codebase where available.
- **Simple UI Elements:** Use basic HTML input/textarea elements enhanced with existing styling.
- **Tag Chips:** Implement basic tag chips with simple add/remove functionality for better UX.
- **Mobile Responsive:** Maintain the same inline editing experience across all devices.
- **Visual Feedback:** Clear visual indicators for edit mode, pending changes, and disabled fields.

## Technical Considerations

### Database Design

- **New Table:** Create a separate `artwork_edits` table to store edit submissions using a flexible key-value structure.
- **Reuse Logic:** Extend existing moderation code to handle artwork edits with minimal changes.
- **Schema Fields:**
  - `edit_id` (primary key), `artwork_id`, `user_token`, `submitted_at`
  - `field_name` (e.g., 'title', 'description', 'created_by', 'tags') 
  - `field_value_old` (original value before edit)
  - `field_value_new` (proposed new value)
  - `status` (pending/approved/rejected), `moderator_notes`, `reviewed_at`, `reviewed_by`
- **Key-Value Benefits:** This flexible structure allows adding new editable fields in the future without schema changes, while maintaining support for comparing old vs new values for any field type.

### API Endpoints

- `POST /api/artwork/{id}/edit` - Submit edit proposal
- `GET /api/artwork/{id}/pending-edits` - Check user's pending edits
- Extend existing moderation endpoints to handle edit reviews

### Integration Points

- **Authentication:** Use existing user authentication system
- **Rate Limiting:** Integrate with existing rate limiting infrastructure
- **Moderation Queue:** Extend current moderation UI and workflows
- **Logbook System:** Use existing logbook entry creation logic

## Success Metrics

1. **Primary Metric:** Improvement in artwork data quality/completeness measured by:
   - Reduction in incomplete artwork records
   - Increase in average field completion rate
   - Community-reported accuracy improvements

2. **Secondary Metrics:**
   - Number of edit submissions per month
   - Edit approval rate (target: >70% approved)
   - User engagement increase on artwork detail pages
   - Reduction in moderator-initiated corrections

## Open Questions

1. Should there be a character limit increase for any fields to accommodate community contributions?
2. Should successful contributors be recognized in any way (badges, contributor status)?
3. Would it be valuable to show edit statistics publicly (e.g., "This artwork has been improved 5 times by the community")?
4. Should there be a cooldown period after a user's edit is rejected before they can edit the same artwork again?

---
