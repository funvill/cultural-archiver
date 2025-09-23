# Logbook Submission Feature - Clarifying Questions

## Theme: Success Metrics & Measurement

**1. Primary Success Metric:** What is the most important metric to measure the success of the logbook feature in the first three months?

- **Answer:** a) Total number of logbook entries submitted.

**2. Data Quality Metric:** How should we measure the feature's impact on data quality?

- **Answer:** a) Reduction in the number of artworks with missing information (type, artist, etc.).
- **Answer:** d) Manual audit of 100 random artworks to check for improved data accuracy.

**3. User Engagement Metric:** Beyond the primary metric, how should we track user engagement with this feature?

- **Answer:** d) Number of users who submit more than one logbook entry.

**4. Feature Adoption Metric:** How will we measure the initial adoption of the feature?

- **Answer:** b) Number of unique users submitting their first logbook entry each week.

**5. Long-Term Value Metric:** What metric will indicate the long-term value of the logbook feature after the initial launch period (e.g., after 6 months)?

- **Answer:** a) Sustained rate of logbook submissions over time.

## Theme: Risks & Assumptions

**6. Biggest Risk to Adoption:** What is the biggest potential risk that might prevent users from adopting this feature?

- **Answer:** c) Users are not interested in documenting their visits.

**7. Assumption about User Motivation:** What is our primary assumption about why users will use this feature?

- **Answer:** b) Users have an intrinsic desire to contribute to a community project and improve data quality.

**8. Risk of Low-Quality Submissions:** How should we mitigate the risk of users submitting low-quality or irrelevant photos?

- **Answer:** a) Rely on the existing manual review process to filter out bad submissions.
- **Note:** User specified that moderation will happen after submission to remove bad/low-ranked photos.

**9. Assumption about "Nearby Artwork" feature:** What is a key assumption we're making about the "Nearby Artwork" search?

- **Answer:** a) The 500m radius is effective enough for users to find the correct artwork.

**10. Risk of User Confusion:** What is the most likely point of confusion for users in the logbook submission flow?

- **Answer:** b) Understanding why they can only submit a logbook entry once per month.
- **Answer:** d) Finding the "Add Report" button on the nearby artwork list.

## Theme: Functional Requirements

**11. Handling of "Missing" or "Removed" Artwork:** If a user reports an artwork's condition as "Missing" or "Removed," how should the system react?

- **Answer:** a) The logbook entry is submitted for review, and moderators will decide how to update the artwork's status.

**12. Photo Upload Requirements:** What should happen if a user tries to submit a logbook entry without a photo?

- **Answer:** a) The submission should be blocked, and a message should inform the user that a photo is required.

**13. Conditional Fields Behavior:** When a user fills in missing information (e.g., Artist, Material), how is this new information handled?

- **Answer:** a) The new information is added to the logbook submission and applied to the artwork record only after a moderator approves it.

**14. "Add Report" Button Visibility:** When should the "Add Report" button be visible on a nearby artwork card?

- **Answer:** c) Always visible and clickable, with the cooldown message shown on the logbook submission page itself.

**15. Drafts and Offline Support:** How should the system handle incomplete logbook submissions?

- **Answer:** a) The system should not save drafts; if the user navigates away, the data is lost.

## Theme: Design Considerations & UI/UX

**16. Confirmation & Feedback:** After a user successfully submits a logbook entry, what feedback should they receive?

- **Answer:** a) A simple toast notification (e.g., "Logbook entry submitted for review!").

**17. Display of Logbook Entries:** How should a user's own logbook entries be displayed on an artwork's detail page?

- **Answer:** Out of scope for this PRD.

**18. Error Messaging for Cooldown:** When a user clicks "Add Report" for an artwork they've recently logged, what should the cooldown message on the submission page say?

- **Answer:** c) A more playful message, like "Looks like you've been here recently! Come back after [Date] to log another visit."

**19. Visual Distinction:** Should the "Add Logbook Entry" page be visually distinct from the "Add New Artwork" page?

- **Answer:** b) Yes, a different header color or a prominent banner should state "Log a Visit" to avoid confusion.

**20. Accessibility of Conditional Fields:** How should the optional, conditional fields (Artist, Material, etc.) be presented to the user?

- **Answer:** a) They should appear as standard, optional form fields within a section titled "Help Us Improve This Listing."

## Theme: Non-Goals / Out of Scope

**21. Social Features:** Which of the following social features should be explicitly considered out of scope for this PRD?

- **Answer:** a) All of the below.
  - b) Commenting on or "liking" logbook entries from other users.
  - c) Sharing a logbook submission directly to social media.
  - d) A public feed of all recent logbook entries.

**22. Advanced Photo Features:** Which photo-related features are not part of this initial implementation?

- **Answer:** b) Allowing users to upload multiple photos or a video in a single logbook entry.
- **Answer:** c) Adding filters, tags, or captions to the uploaded photo.
- **Note:** The user clarified that using EXIF data for location suggestions (d) is a required feature, while others are not.

**23. Gamification and Leaderboards:** Beyond the future concept of "points," what gamification elements are out of scope?

- **Answer:** a) All of the below. (User noted this is for a future PRD)
  - b) Public leaderboards showing users with the most logbook entries.
  - c) Badges or achievements for visiting a certain number of artworks.
  - d) "Streaks" for visiting artworks on consecutive days or weeks.

**24. User-to-User Interaction:** What forms of interaction between users are not included in this feature?

- **Answer:** a) All of the below.
  - b) Flagging another user's logbook entry as inaccurate or inappropriate.
  - c) Sending a message to another user about their logbook entry.
  - d) Viewing a gallery of all logbook entries submitted for a specific artwork.

**25. Offline Functionality:** To be perfectly clear, what is the expected behavior when a user has no internet connection?

- **Answer:** a) The entire logbook submission feature is unavailable, and no part of the flow can be initiated.
