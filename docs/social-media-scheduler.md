# Social Media Scheduler

The social media scheduler allows administrators to automatically schedule and post public artwork highlights to various social media platforms including Bluesky, Instagram, Twitter/X, and Facebook.

## Features

- **Multi-Platform Support**: Post to Bluesky, Instagram, Twitter, and Facebook from a unified interface
- **Flexible Scheduling**: Schedule posts for specific dates or use the "next available date" feature
- **Artwork Suggestions**: AI-powered suggestions for artworks that haven't been posted recently
- **Template System**: Customizable post templates for each platform with variable substitution
- **Photo Management**: Automatic photo selection and upload (up to 4 photos per post)
- **Admin Dashboard**: View, edit, and manage all scheduled posts
- **Automatic Posting**: Cron-triggered daily processing of scheduled posts

## Architecture

### Database Schema

The `social_media_schedules` table stores all scheduled posts:

```sql
CREATE TABLE social_media_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  artwork_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL, -- YYYY-MM-DD format
  social_type TEXT NOT NULL CHECK(social_type IN ('bluesky', 'instagram', 'twitter', 'facebook', 'other')),
  status TEXT NOT NULL CHECK(status IN ('scheduled', 'posted', 'failed')),
  body TEXT NOT NULL,
  photos TEXT, -- JSON array of photo URLs
  last_attempt_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE SET NULL
);
```

### Service Architecture

The system uses a service module pattern with platform-specific implementations:

- **Base Service** (`base.ts`): Abstract class with common validation logic
- **Bluesky Service** (`services/bluesky.ts`): Full implementation using AT Protocol
- **Instagram Service** (`services/instagram.ts`): Stub implementation (Facebook Graph API)
- **Factory** (`factory.ts`): Creates service instances based on platform type

### API Endpoints

All endpoints require admin authentication:

- `GET /api/admin/social-media/suggestions` - Get artwork suggestions for posting
- `POST /api/admin/social-media/schedule` - Create a new scheduled post
- `GET /api/admin/social-media/schedule` - List all scheduled posts
- `DELETE /api/admin/social-media/schedule/:id` - Delete a scheduled post
- `PATCH /api/admin/social-media/schedule/:id` - Update a scheduled post
- `GET /api/admin/social-media/next-available-date` - Get next available scheduling date

### Template System

Templates support Handlebars-style variable substitution:

**Available Variables:**
- `{{title}}` - Artwork title
- `{{artist}}` - Primary artist name
- `{{artists}}` - All artists (comma-separated)
- `{{description}}` - Artwork description
- `{{url}}` - Link to artwork detail page
- `{{location}}` - City or location
- `{{year}}` - Year created
- `{{medium}}` - Art medium/material

**Conditional Blocks:**
```
{{#if artist}}
  by {{artist}}
{{/if}}
```

### Cron Job

The scheduled event handler runs daily to process posts:

1. Queries all posts with `status='scheduled'` and `scheduled_date <= today`
2. For each post:
   - Creates the appropriate service instance
   - Attempts to post to the platform
   - Updates status to `posted` (success) or `failed` (error)
3. Logs all activity for monitoring

## Configuration

### Environment Variables

Add these to your Cloudflare Workers environment (via `wrangler secret put` or dashboard):

#### Bluesky

```bash
# Your Bluesky handle (e.g., username.bsky.social)
BSKY_IDENTIFIER=your-handle.bsky.social

# App password from https://bsky.app/settings/app-passwords
BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

#### Instagram

```bash
# Facebook Graph API access token
INSTAGRAM_ACCESS_TOKEN=your-access-token

# Instagram account ID
INSTAGRAM_ACCOUNT_ID=your-account-id
```

#### Twitter/X (Future)

```bash
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_SECRET=your-access-secret
```

#### Facebook (Future)

```bash
FACEBOOK_PAGE_ID=your-page-id
FACEBOOK_ACCESS_TOKEN=your-access-token
```

### Setting Secrets

**Development:**
```bash
wrangler secret put BSKY_IDENTIFIER --env development
wrangler secret put BSKY_APP_PASSWORD --env development
```

**Production:**
```bash
wrangler secret put BSKY_IDENTIFIER --env production
wrangler secret put BSKY_APP_PASSWORD --env production
```

### Enabling Cron Trigger

The cron trigger is disabled by default. To enable automatic posting:

1. Uncomment the `[triggers]` section in `src/workers/wrangler.toml`:

```toml
[triggers]
crons = ["0 9 * * *"]  # Run daily at 9:00 AM UTC
```

2. Adjust the cron schedule as needed (see [Cron syntax](https://developers.cloudflare.com/workers/configuration/cron-triggers/))

3. Deploy the workers:

```bash
npm run deploy:workers
```

## Usage

### Admin Dashboard

1. Navigate to **Admin** → **Social Media** tab
2. View artwork suggestions with pre-generated post text
3. Select platform (Bluesky, Instagram, etc.)
4. Edit the post text if desired
5. Choose scheduling option:
   - **Next Available Date**: Automatically schedule for the next free day
   - **Custom Date**: Pick a specific date

### Managing Scheduled Posts

- View all scheduled posts grouped by month
- Edit post text or scheduled date
- Delete scheduled posts
- See posting status (scheduled, posted, failed)
- View error messages for failed posts

### Templates

Templates are stored in `src/workers/templates/social-media/`:

- `bluesky.txt` - Bluesky template (300 character limit)
- `instagram.txt` - Instagram template (2200 character limit)
- `twitter.txt` - Twitter template (280 character limit)
- `facebook.txt` - Facebook template (5000 character limit)

To customize templates, edit these files and redeploy the workers.

## Platform-Specific Notes

### Bluesky

- **Character Limit**: 300 characters
- **Photo Limit**: 4 images per post
- **Authentication**: Uses AT Protocol with app passwords
- **Implementation Status**: ✅ Fully implemented

### Instagram

- **Character Limit**: 2200 characters
- **Photo Limit**: 10 images per carousel
- **Authentication**: Facebook Graph API
- **Implementation Status**: ⚠️ Stub implementation (requires Facebook app setup)

### Twitter/X

- **Character Limit**: 280 characters
- **Photo Limit**: 4 images per tweet
- **Implementation Status**: 📝 Planned

### Facebook

- **Character Limit**: 5000 characters
- **Photo Limit**: Varies by post type
- **Implementation Status**: 📝 Planned

## Development

### Testing Locally

1. Set up local environment variables in `.env`
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Access admin dashboard at `http://localhost:5173/admin`
4. Test scheduling functionality

### Adding New Platforms

1. Create service class in `src/workers/lib/social-media/services/`
2. Extend `BaseSocialMediaService`
3. Implement `post()` method
4. Add platform credentials to environment
5. Update factory in `factory.ts`
6. Create template in `templates/social-media/`

## Troubleshooting

### Posts Not Being Published

1. **Check cron trigger**: Ensure `[triggers]` is uncommented in `wrangler.toml`
2. **Verify credentials**: Check that all required environment variables are set
3. **Review logs**: Check Cloudflare Workers logs for error messages
4. **Check status**: View scheduled posts in admin dashboard for error messages

### Authentication Errors

**Bluesky:**
- Verify your handle is correct (should be your full handle, e.g., `username.bsky.social`)
- Generate a new app password at https://bsky.app/settings/app-passwords
- Ensure the app password is set correctly via `wrangler secret put`

**Instagram:**
- Verify access token hasn't expired (tokens typically expire after 60 days)
- Check Facebook Developer Console for API permissions
- Ensure Instagram Business Account is properly linked

### Photo Upload Failures

- Verify photos are accessible at their URLs
- Check file sizes (max 1MB for Bluesky)
- Ensure photo URLs use HTTPS
- Verify photo format is supported (JPG, PNG)

## Security Considerations

- All API endpoints require admin authentication
- Credentials are stored as Cloudflare Worker secrets (encrypted at rest)
- Social media tokens should have minimal required permissions
- Use app passwords/tokens instead of account passwords where possible
- Regularly rotate API credentials

## Future Enhancements

- [ ] Twitter/X integration
- [ ] Facebook integration
- [ ] Analytics and engagement tracking
- [ ] A/B testing for post text
- [ ] Automatic hashtag generation
- [ ] Cross-posting to multiple platforms simultaneously
- [ ] Post preview before scheduling
- [ ] Bulk scheduling interface
- [ ] RSS feed integration
- [ ] Performance metrics dashboard
