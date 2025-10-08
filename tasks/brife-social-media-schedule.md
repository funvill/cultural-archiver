# Social Media Scheduler (MVP)

Create a new view in the admin dashboard for scheduling social media posts. This feature has two primary goals: suggesting artworks for posts and providing a list to view the schedule.

### 1. Artwork Suggestions

Display a paginated list of artworks that are good candidates for social media posts.

-   **Filtering Criteria (MVP):**
    -   Artwork has at least one photo.
    -   Artwork has an associated artist.
    -   Artwork has not been successfully posted to social media before.
-   **Sorting Order (MVP):**
    -   Artwork creation date (oldest first).
-   **Display:**
    -   Show 10 suggestions at a time with a "Load More" button.
    -   For each suggestion, show a generic preview that approximates the look of a social media post.
    -   The text for both the Bluesky and Instagram posts will be pre-filled but editable in text areas. This includes any hashtags.
    -   Provide a "+" button to schedule the post for the next available day and a "Schedule for later" option for manual date selection.

### 2. Schedule View

Display a simple chronological list of scheduled posts, grouped by week or month.

-   Each item in the list will show the artwork thumbnail, title, and scheduled date.
-   Clicking an item opens a modal with post details and management options (Edit, Unschedule).
-   Admins will be prompted for confirmation if they try to schedule more than one post on the same day.

---

### Technical Specifications

#### Database Schema (`social_media_schedules` table)

-   `id` (TEXT, PK) - UUID
-   `user_id` (FK to `users.id`)
-   `artwork_id` (FK to `artworks.id`)
-   `scheduled_date` (DATE)
-   `status` (TEXT: 'scheduled', 'posted', 'failed')
-   `bluesky_text` (TEXT)
-   `instagram_text` (TEXT)
-   `last_attempt_at` (DATETIME)
-   `error_message` (TEXT)
-   `created_at` (DATETIME)

*Note: The `artwork_id` will not have a UNIQUE constraint to allow for re-scheduling the same artwork.*

#### API Endpoints

-   `GET /api/admin/social-media/suggestions`: Fetches artwork suggestions based on the simplified MVP logic.
-   `POST /api/admin/social-media/schedule`: Schedules a new post with the (potentially edited) text.
-   `GET /api/admin/social-media/schedule`: Fetches scheduled posts for the chronological list view.
-   `DELETE /api/admin/social-media/schedule/{id}`: Unschedules a post.

#### Frontend Implementation

-   The scheduler will be a new tab within the main admin dashboard view.
-   It will use a single generic preview component.
-   If an artwork has multiple photos, the Instagram post will be a carousel.
-   If the suggestions list is empty, a simple "No suggestions found" message will be shown.

#### Key Logic & Assumptions

-   **Scheduling:** The system will use a soft delete policy (`ON DELETE SET NULL`) to handle deleted artworks. Dates are stored without timezones, with the cron job assuming a default posting timezone (e.g., 'America/Vancouver').
-   **Scope:** Rescheduling (moving a post to a new date) is out of scope for the initial implementation.
-   **Content Generation:** Separate logic and templates will be used for Bluesky and Instagram to pre-fill the editable text areas.
