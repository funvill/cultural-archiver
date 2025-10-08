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

-   **Scheduling:** The system will use a soft delete policy (`ON DELETE SET NULL`) to handle deleted artworks. Dates are stored without timezones, with the cron job assuming a default posting timezone (hardcoded to 'America/Vancouver').
-   **Scope:** Rescheduling (moving a post to a new date) is out of scope for the initial implementation.
-   **Content Generation:** Separate template files will be used for Bluesky and Instagram to pre-fill the editable text areas. Templates can be updated later without code changes.
-   **API Credentials:** Stored as environment variables (secrets) in `wrangler.toml`, never checked into version control. Variable: `BSKY_APP_PASSWORD`
-   **Cron Job:** Cloudflare Worker scheduled event (cron trigger) will be created but disabled by default
-   **Photo Handling:** Both Bluesky and Instagram posts will use up to 4 photos from the artwork
-   **Next Available Day:** The "+" button finds the next day with zero scheduled posts
-   **Permissions:** Admin-only feature (not accessible to moderators)

---

## Implementation Progress

- [x] Database migration 0034 - Create `social_media_schedules` table with flexible schema
- [x] TypeScript types - All social media types and interfaces in `src/shared/types.ts`
- [x] Template system - Platform templates in `src/workers/templates/social-media/`
- [x] Service architecture - Base interface, Bluesky service (full), Instagram service (stub)
- [x] Backend API endpoints - 6 admin-only endpoints in `src/workers/routes/social-media-admin.ts`
- [x] Frontend service layer - Extended `src/frontend/src/services/admin.ts`
- [x] Vue components - SocialMediaScheduler, SocialMediaSuggestionCard, SocialMediaScheduleList
- [x] TypeScript compilation - All compilation errors resolved, build successful
- [x] Apply database migration - Migration 0034 applied to local development database
- [x] Create cron trigger - Added scheduled event to wrangler.toml and cron handler (disabled by default)
- [x] Document environment variables - Added to .env.example, created comprehensive docs/social-media-scheduler.md, updated README.md

## ✅ Implementation Complete

All core tasks have been completed successfully. The social media scheduler is fully implemented and code-complete.

### What Was Built

1. **Database Layer**: Flexible `social_media_schedules` table supporting multiple platforms (migration 0034)
2. **Backend Services**: Extensible service module pattern with Bluesky (fully functional) and Instagram (stub)
3. **API Layer**: 6 RESTful admin-only endpoints for managing schedules and suggestions
4. **Frontend**: Complete Vue 3 components integrated into admin dashboard
5. **Automation**: Cron trigger system for daily post processing (disabled by default)
6. **Documentation**: Comprehensive setup and usage guide at `docs/social-media-scheduler.md`

### Current Status: Deployment Needed

✅ **Code Complete**: All features implemented and tested locally  
✅ **Secrets Set**: Bluesky credentials (`BSKY_IDENTIFIER`, `BSKY_APP_PASSWORD`) configured in production  
⚠️ **Pending**: Production deployment of new worker code with social media endpoints  
⚠️ **Error**: 500 error on `/api/admin/social-media/suggestions` - endpoint not yet deployed to production

---

## 🚀 Deployment Checklist

### Immediate Next Steps

1. **Deploy Workers to Production**
   ```bash
   npm run deploy:workers
   ```
   This will deploy the new social media endpoints to production.

2. **Apply Migration to Production** (if not already applied)
   ```bash
   cd src/workers
   npx wrangler d1 migrations apply public-art-registry --env production --remote
   ```
   Verify with:
   ```bash
   npx wrangler d1 execute public-art-registry --env production --remote \
     --command "SELECT COUNT(*) FROM social_media_schedules"
   ```

3. **Verify Deployment**
   - Navigate to `https://publicartregistry.com/admin`
   - Click "Social Media" tab
   - Check that suggestions load without 500 error
   - Test scheduling a post

4. **Enable Automatic Posting** (Optional)
   - Edit `src/workers/wrangler.toml`
   - Uncomment the `[triggers]` section:
     ```toml
     [triggers]
     crons = ["0 9 * * *"]  # Run daily at 9:00 AM UTC
     ```
   - Redeploy: `npm run deploy:workers`

### Environment Configuration

**Production Secrets** (Already Set ✅):
- `BSKY_IDENTIFIER` - Bluesky handle (@publicartregistry.com)
- `BSKY_APP_PASSWORD` - Bluesky app password

**Instagram Secrets** (To Add Later):
```bash
cd src/workers
npx wrangler secret put INSTAGRAM_ACCESS_TOKEN --env production
npx wrangler secret put INSTAGRAM_ACCOUNT_ID --env production
```

---

## 📋 Developer Handoff Notes

### Architecture Overview

**Service Pattern**: Platform-agnostic design using factory pattern
- Base class: `BaseSocialMediaService` (`src/workers/lib/social-media/base.ts`)
- Implementations: `BlueskyService`, `InstagramService` (stub)
- Factory: `createSocialMediaService()` in `factory.ts`

**Data Flow**:
1. Admin views suggestions via frontend → `SocialMediaScheduler.vue`
2. Frontend calls API → `admin.ts` service layer
3. Backend endpoint → `routes/social-media-admin.ts`
4. Creates schedule in DB → `social_media_schedules` table
5. Cron job processes → `lib/social-media/cron.ts` (if enabled)
6. Posts via service → `BlueskyService.post()`

**Template System**: Handlebars-style variable substitution
- Templates: `src/workers/templates/social-media/*.txt`
- Variables: `{{title}}`, `{{artist}}`, `{{url}}`, etc.
- Conditionals: `{{#if artist}}...{{/if}}`

### Key Files

**Backend**:
- `src/workers/routes/social-media-admin.ts` - 6 API endpoints
- `src/workers/lib/social-media/` - Service implementations
- `src/workers/index.ts` - Scheduled event handler (lines 1465-1491)
- `src/workers/migrations/0034_create_social_media_schedules_table.sql`

**Frontend**:
- `src/frontend/src/views/AdminView.vue` - Social media tab
- `src/frontend/src/components/SocialMediaScheduler.vue` - Main component
- `src/frontend/src/components/SocialMediaSuggestionCard.vue` - Artwork cards
- `src/frontend/src/components/SocialMediaScheduleList.vue` - Schedule view
- `src/frontend/src/services/admin.ts` - API client methods

**Configuration**:
- `src/workers/wrangler.toml` - Cron trigger (lines 6-10, commented out)
- `src/workers/types.ts` - Environment variables (lines 417-421)

### Known Limitations

1. **Instagram**: Stub implementation only - requires Facebook Graph API integration
2. **Twitter/Facebook**: Planned but not implemented
3. **Rescheduling**: Not supported - must delete and recreate
4. **Timezone**: Hardcoded to America/Vancouver in cron job
5. **Photo Limit**: Fixed at 4 photos per post (platform max may vary)

### Testing Locally

```bash
# Start development server
npm run devout

# Access admin dashboard
http://localhost:5173/admin → Social Media tab

# Test with local D1 database
cd src/workers
npx wrangler d1 migrations apply public-art-registry --local --env development
```

### Debugging Production Issues

**Check Worker Logs**:
```bash
cd src/workers
npx wrangler tail --env production --format pretty
```

**Verify Secrets**:
```bash
npx wrangler secret list --env production
```

**Test Database**:
```bash
npx wrangler d1 execute public-art-registry --env production --remote \
  --command "SELECT * FROM social_media_schedules LIMIT 5"
```

### Future Enhancements

- [ ] Instagram service implementation (requires Facebook Developer App)
- [ ] Twitter/X integration
- [ ] Facebook integration
- [ ] Analytics dashboard for post engagement
- [ ] A/B testing for post variations
- [ ] Automatic hashtag generation
- [ ] Cross-posting to multiple platforms simultaneously
- [ ] Bulk scheduling interface
- [ ] Post preview before scheduling

---

## 📚 Additional Resources

- **Full Documentation**: `docs/social-media-scheduler.md`
- **API Reference**: `docs/api.md`
- **Database Schema**: `docs/database.md`
- **Bluesky AT Protocol**: https://atproto.com/
- **Cloudflare Cron Triggers**: https://developers.cloudflare.com/workers/configuration/cron-triggers/

---

## ❓ Troubleshooting

### Error: 500 on /api/admin/social-media/suggestions

**Cause**: New endpoints not deployed to production  
**Solution**: Run `npm run deploy:workers`

### Error: Table 'social_media_schedules' not found

**Cause**: Migration 0034 not applied  
**Solution**: 
```bash
cd src/workers
npx wrangler d1 migrations apply public-art-registry --env production --remote
```

### Error: Authentication failed (Bluesky)

**Cause**: Invalid credentials or expired app password  
**Solution**:
1. Generate new app password at https://bsky.app/settings/app-passwords
2. Update secret: `npx wrangler secret put BSKY_APP_PASSWORD --env production`
3. Redeploy: `npm run deploy:workers`

### Posts not publishing automatically

**Cause**: Cron trigger disabled  
**Solution**: Uncomment `[triggers]` in `wrangler.toml` and redeploy

---

**Last Updated**: October 7, 2025  
**Status**: Code Complete - Awaiting Production Deployment  
**Contact**: See project maintainers for deployment access

