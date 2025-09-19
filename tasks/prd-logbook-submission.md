# Product Requirements Document: Logbook Submission Feature

## 1. Introduction/Overview

The logbook submission feature allows users to document their visits to existing artworks by submitting photos and additional information. This feature is designed to deepen user engagement by providing a way to contribute beyond adding new artworks. It aims to improve the quality of the artwork database through crowd-sourced updates and creates a foundation for a future rewards system.

**Problem Solved:** Currently, users can only contribute by adding new artworks. There is no mechanism for them to document their visits to existing artworks, report on an artwork's current condition, or help fill in missing information for existing entries.

**Goal:** Enable users to document their visits to existing artworks, contribute to data quality, and be rewarded for their engagement, with a clear and intuitive user experience that leverages existing UI patterns.

## 2. Goals

- **Allow users to document visits** to existing artworks through a simple photo submission process.
- **Improve artwork data quality** by collecting missing information (e.g., artist, material) and current condition reports from visitors.
- **Increase user engagement** by providing a new interaction loop beyond initial artwork submission.
- **Maintain data integrity** by integrating logbook submissions into the existing moderation and review process.
- **Establish a foundation** for a future points-based reward system.

## 3. User Stories

- **As a user exploring the city,** I want to submit a photo when I visit an artwork so that I can document my experience and earn points.
- **As a frequent art enthusiast,** I want to contribute missing information about artworks I visit so that the database becomes more complete and helpful for other users.
- **As a user browsing nearby artworks,** I want to easily report my visit to an artwork so that I don't have to navigate through multiple screens.
- **As a user who has already visited an artwork,** I want to understand why I can't submit another logbook entry immediately so that I know when I can visit again.
- **As a community member,** I want my logbook submissions to be reviewed for quality so that the platform maintains high standards.

## 4. Functional Requirements

### Core Functionality
1.  **Entry Point:** Users access the logbook flow via the existing "Add" button, which leads to the "Nearby Artwork" search.
2.  **Nearby Artwork Integration:** The system must display nearby artworks (500m radius) with an "Add Report" button on each artwork card.
3.  **Direct Navigation:** Clicking "Add Report" navigates directly to the logbook submission page for the selected artwork. The button will always be visible and clickable.
4.  **Mandatory Photo Submission:** Users **must** upload one photo that clearly shows the artwork as proof of visit. The submission is blocked without a photo.
5.  **EXIF Data Usage:** The system will use the photo's EXIF data to suggest the artwork location.
6.  **Conditional Information Fields:** The UI will present optional fields for missing artwork information (Artwork type, Access, Artist, Material) under a clear section titled "Help Us Improve This Listing."
7.  **Condition Assessment:** Users will be asked the optional multiple-choice question: "What is the current condition?" with options: "Good", "Damaged", "Missing", "Removed".
8.  **Extensible Questions:** The system must be designed to easily support adding more optional multiple-choice questions in the future.
9.  **Consent Integration:** The submission page must include the existing "Consent & Legal Requirements" component.
10. **Duplicate Prevention:** The system must prevent users from submitting more than one logbook entry for the same artwork within a 30-day period.
11. **No Drafts:** The system will not save drafts. If a user navigates away during submission, the data is lost.

### Moderation Workflow
12. **Unified Queue:** Logbook submissions will appear in the same review queue as new artwork submissions but will be clearly labeled "Logbook Entry".
13. **Moderator View:** The review interface must show the submitted photo, any answers to questions (e.g., condition), and a list of any suggested changes to artwork info.
14. **Two-Step Approval:** When a submission contains suggested data changes, moderators will perform a two-step approval: first approve the logbook entry itself, then separately approve each suggested data change.
15. **Rejection Reasons:** Moderators must select a reason from a predefined list when rejecting a submission.
16. **Final Authority:** Moderators have the final authority on submissions; there is no "Flag for Admin Review" feature.
17. **Handling of "Missing" Reports:** If a user reports an artwork as "Missing" or "Removed," the entry is submitted for standard review, and moderators will decide how to update the artwork's official status.

## 5. Design & UI/UX

1.  **Visual Distinction:** The "Add Logbook Entry" page will have a different header color and a prominent banner stating "Log a Visit" to distinguish it from the "Add New Artwork" page.
2.  **Cooldown Messaging:** If a user attempts to submit for an artwork within the 30-day cooldown, the submission page will display a playful message: "Looks like you've been here recently! Come back after [Date] to log another visit."
3.  **Submission Confirmation:** After successful submission, the user will receive a simple toast notification (e.g., "Logbook entry submitted for review!").
4.  **Error Handling:**
    *   If a photo upload fails mid-submission, the entire form will be cleared, forcing the user to start over.
    *   If submission fails due to network loss, a clear error ("Submission Failed. Please check your connection and try again") will be shown, and the entered form data will be preserved for a manual retry.

## 6. Technical Requirements & API

1.  **API Endpoint:** Submissions will be sent to the existing `POST /api/submissions` endpoint. The request body will include `submissionType: 'logbook'` and the target `artworkId`.
2.  **Data Model:** Logbook entries will be stored in the existing `submissions` table. Logbook-specific data (like answers to questions) will be concatenated into a single string and stored in the `notes` text field.
3.  **Cooldown Status:** The user's cooldown status for an artwork will be included in the main `GET /api/artworks/{artworkId}` response via a `userLogbookStatus` field.
4.  **API Response:** On successful submission, the API will return a `201 Created` status with a JSON body containing the `submissionId` and a status message: `"Submission received for review."`
5.  **Error Handling (API):**
    *   If a logbook entry is submitted for a deleted/disabled artwork, the API will reject it with a `404 Not Found` or `409 Conflict` error.
    *   If an artwork is edited while a user is submitting, the submission will proceed based on the old data, and any inconsistencies will be handled by moderators.
    *   If a photo's EXIF location is >1km from the artwork's location, the submission will be accepted but automatically flagged with a "Location Mismatch" warning for moderators.

## 7. Non-Goals (Out of Scope)

- **Points & Gamification:** The actual implementation of points, leaderboards, badges, or streaks is out of scope for this PRD.
- **Advanced Photo Features:** Uploading multiple photos/videos, adding filters/captions.
- **Social Features:** Commenting, liking, sharing, or public feeds of logbook entries.
- **User-to-User Interaction:** Flagging other users' entries or direct messaging.
- **Offline Support:** The feature will be unavailable without an internet connection.
- **Displaying Logbook Entries:** How or where approved logbook entries are displayed to other users (e.g., on artwork pages) is not part of this PRD.

## 8. Success Metrics

- **Primary Metric:** Total number of logbook entries submitted in the first three months.
- **Data Quality:**
    - Reduction in the number of artworks with missing information.
    - Manual audit of 100 random artworks to check for improved data accuracy.
- **User Engagement:** Number of unique users who submit more than one logbook entry.
- **Feature Adoption:** Number of unique users submitting their first logbook entry each week.
- **Long-Term Value:** Sustained rate of logbook submissions over time (measured after 6 months).

## 9. Risks & Assumptions

- **Biggest Risk:** Users may not be interested in documenting their visits.
- **Primary Assumption:** Users are intrinsically motivated to contribute to a community project and improve data quality.
- **Mitigation for Low-Quality Photos:** Rely on the manual review process to filter out bad submissions. Moderators will remove bad or low-ranked photos after they have been submitted.
- **Key Assumption:** The 500m "Nearby Artwork" radius is effective for users to find the correct artwork.
- **Likely User Confusion:**
    - Understanding the one-month submission cooldown.
    - Finding the "Add Report" button in the nearby artwork list.

