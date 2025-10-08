Review this brief. Ask numbered questions, with multiple choice answers, with "A" being the recommended response. These questions should help clarify this task for a developer. 

# Social Media Scheduler

Create a new view in the admin database called social media schedule. This new social media schedule has two goals. 

1) Display a list of possible artworks that could be turned into social media posts. 

This list would be filtered by several different conditions. Artwork has photo, has a description longer then 100 words, has a artist assocated with the artwork, Has not been posted on social media before. 

The list would be sorted by the the artworks that are in the most users "loved" lists, then by age ascending (older artworks first). 

The list should show 10 possible artworks at a time. For each artwork there would be a preview of what the post would look like in (Bluesky, Instagram). Use a template 

A user can click a "+" icon button to add the social media posts (Both Bluesky and instagram) to the calendar for this artwork. The artwork gets added to the next available day. One set of social media posts per day.

2) Show a calendar of schedule social media posts for each type (Bluesky, Instagram). 


Notes:
- A cron job will be added later on to do the posting to the social media websites. This feature is just for the scheduling
- A table should be created for the social media schedule. A field in that table should have if it was posted to the social media websites or not. 
- We can tell if a artwork has been schedule or posted if its in this social media schedule table

---

### Clarification Questions

1.  **Description Length Filter**
    The brief specifies a filter for "description longer then 100 words". Is this correct, or should it be 100 characters?
    *   A) **100 characters.** This is a more common and practical length for ensuring a minimum amount of text without being overly restrictive.
    *   B) **100 words.** This would require a much more substantial description.
    *   C) **No minimum length.** Any artwork with a description is eligible.

2.  **Social Media Post Template**
    The brief mentions using a template for post previews. What content should this template include?
    *   A) **Artwork Title, Artist Name, a snippet of the description, and the primary photo.** This provides a comprehensive and engaging preview.
    *   B) **Only the Artwork Title and photo.** This is more concise but less informative.
    *   C) **The full artwork description and all photos.** This might be too much information for a social media post.

3.  **"Loved" Lists Sorting**
    The sorting logic mentions artworks in the most "loved" lists. How is a "loved" list defined and tracked in the current system?
    *   A) **Assume a `user_artwork_lists` table exists where `list_type = 'loved'`. The count will be based on the number of users who have added the artwork to such a list.**
    *   B) This feature does not exist yet and needs to be implemented first.
    *   C) The sorting should be based on a simple "likes" count on the artwork itself.

4.  **Scheduling Logic**
    When a user clicks the "+" icon, the post is added to the "next available day". How should this be determined?
    *   A) **Find the latest `scheduled_date` in the `social_media_schedule` table and add one day. If the table is empty, use tomorrow's date.**
    *   B) Allow the user to select a date from the calendar.
    *   C) Add it to a queue without a specific date, to be scheduled later.

### Development Plan

Here is a proposed development plan to implement the Social Media Scheduler.

#### Phase 1: Backend Setup

1.  **Create Database Migration:**
    *   Define and create a new table named `social_media_schedule`.
    *   **Schema:**
        *   `id` (INTEGER, PRIMARY KEY)
        *   `artwork_id` (INTEGER, FOREIGN KEY to `artworks.id`, UNIQUE)
        *   `scheduled_date` (DATE, NOT NULL)
        *   `bluesky_posted_at` (DATETIME, NULLABLE)
        *   `instagram_posted_at` (DATETIME, NULLABLE)
        *   `created_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP)

2.  **Develop API Endpoint for Suggestions:**
    *   Create a new `GET /api/admin/social-media/suggestions` endpoint.
    *   Implement the filtering logic:
        *   Artwork has at least one photo.
        *   Description length > 100 characters.
        *   `artist_id` is not null.
        *   Artwork is not already in the `social_media_schedule` table.
    *   Implement the sorting logic:
        *   Primary sort: by the count of "loved" list entries (descending).
        *   Secondary sort: by `created_at` (ascending, older artworks first).
    *   Implement pagination (10 results per page).

3.  **Develop API Endpoint for Scheduling:**
    *   Create a new `POST /api/admin/social-media/schedule` endpoint.
    *   The endpoint will accept an `artwork_id`.
    *   It will calculate the next available `scheduled_date` and insert a new record into the `social_media_schedule` table.

4.  **Develop API Endpoint for Calendar View:**
    *   Create a new `GET /api/admin/social-media/schedule` endpoint.
    *   It will accept `start_date` and `end_date` query parameters.
    *   The endpoint will return all scheduled posts within the given date range, joining with the `artworks` table to include details for display.

#### Phase 2: Frontend Implementation

1.  **Create New Admin View:**
    *   Create a new Vue component for the Social Media Scheduler, accessible from the admin dashboard.
    *   The view will have two main sections: "Suggestions" and "Calendar".

2.  **Implement the Suggestions List:**
    *   Fetch and display the list of 10 artwork suggestions from the backend.
    *   For each suggestion, create a component that shows:
        *   A preview of the Bluesky and Instagram posts using a standardized template.
        *   A "+" button to schedule the post.
    *   Clicking the "+" button will call the scheduling API endpoint and provide feedback to the user (e.g., a success message).

3.  **Implement the Calendar View:**
    *   Integrate a calendar component (e.g., `fullcalendar-vue`).
    *   Fetch the scheduled posts for the visible month from the backend.
    *   Display the scheduled posts on the calendar, showing the artwork title or a small thumbnail.
    *   Indicate the status (e.g., scheduled, posted) for each platform (Bluesky, Instagram).
 