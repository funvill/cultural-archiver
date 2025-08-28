# Cultural Archiver Development Guide

This guide covers local development setup, testing, and debugging for the
Cultural Archiver Worker API.

## Prerequisites

- **Node.js 18+** with npm
- **Wrangler CLI** for Cloudflare Workers development
- **Git** for version control
- **Cloudflare account** (free tier sufficient for development)

## Development Environment Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/funvill/cultural-archiver.git
cd cultural-archiver
npm install
```

### 2. Worker-Specific Setup

```bash
cd src/workers
npm install
```

### 3. Environment Configuration

Create environment files:

```bash
# Copy example files
cp .env.example .env
cp src/workers/.dev.vars.example src/workers/.dev.vars
```

Edit `src/workers/.dev.vars` with your development settings:

```bash
# Development environment variables
ENVIRONMENT=development
MAGIC_LINK_BASE_URL=http://localhost:8787
REVIEWER_EMAIL=reviewer@example.com

# Optional: Email service configuration (leave empty for console logging)
# EMAIL_API_KEY=your-email-service-key
# EMAIL_FROM=noreply@yourdomain.com
```

### 4. Database Setup

Initialize the local D1 database:

```bash
# From the workers directory
cd src/workers
npx wrangler d1 create cultural-archiver-dev
npx wrangler d1 execute cultural-archiver-dev --local --file=../../migrations/002_mvp_schema.sql
```

## Development Workflow

### Starting the Development Server

```bash
# From src/workers directory
npm run dev
```

This starts the Wrangler development server with:

- Hot reloading on file changes
- Local D1 database
- Local KV storage
- Console logging for emails (no external service needed)
- API available at `http://localhost:8787`

### Project Structure

```
src/workers/
├── index.ts                 # Main worker entry point
├── routes/                  # API route handlers
│   ├── auth.ts             # Authentication endpoints
│   ├── discovery.ts        # Artwork discovery
│   ├── review.ts           # Moderation endpoints
│   ├── submissions.ts      # Logbook submissions
│   └── user.ts             # User management
├── middleware/             # Request middleware
│   ├── auth.ts             # Authentication middleware
│   ├── rateLimit.ts        # Rate limiting
│   └── validation.ts       # Input validation
├── lib/                    # Utility libraries
│   ├── database.ts         # Database operations
│   ├── email.ts            # Email utilities
│   ├── errors.ts           # Error handling
│   ├── photos.ts           # Photo processing
│   └── spatial.ts          # Geospatial utilities
└── tests/                  # Test files
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- submissions.test.ts

# Run tests in watch mode
npm run test:watch
```

### Test Types

- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint workflows
- **Performance Tests**: Spatial query optimization
- **Moderation Tests**: Review workflow validation

### Writing Tests

Tests use Jest with Cloudflare Workers testing utilities:

```typescript
import { createMockEnv } from './test-utils';

describe('Submissions API', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
  });

  test('should validate coordinates', async () => {
    const request = new Request('http://localhost/api/logbook', {
      method: 'POST',
      body: createFormData({ lat: 'invalid', lon: '-123.1207' }),
    });

    const response = await app.fetch(request, env);
    expect(response.status).toBe(400);
  });
});
```

## Debugging

### Development Mode Features

**Console Logging:**

- All email magic links logged to console
- Database queries logged with execution time
- Rate limiting status displayed
- Error stack traces included

**Local Storage:**

- D1 database stored locally in `.wrangler/state`
- KV storage simulated in memory
- R2 storage simulated locally

### Debug Endpoints

In development mode, additional endpoints are available:

```bash
# Check rate limit status
GET /debug/rate-limits/:token

# View KV storage contents
GET /debug/kv

# Database connection test
GET /debug/health
```

### Common Issues

**Database Connection Errors:**

```bash
# Reset local database
rm -rf .wrangler/state
npx wrangler d1 execute cultural-archiver-dev --local --file=../../migrations/002_mvp_schema.sql
```

**Rate Limiting in Development:**

```bash
# Clear rate limits
curl -X DELETE http://localhost:8787/debug/rate-limits/your-token
```

**Photo Upload Issues:**

- Check file size limits (15MB max)
- Verify MIME type support (jpg, png, webp)
- Ensure multipart/form-data encoding

## API Testing

### Using curl

```bash
# Get nearby artworks
curl "http://localhost:8787/api/artworks/nearby?lat=49.2827&lon=-123.1207&radius=1000"

# Submit new artwork
curl -X POST http://localhost:8787/api/logbook \
  -H "Authorization: Bearer test-user-uuid" \
  -F "lat=49.2827" \
  -F "lon=-123.1207" \
  -F "note=Beautiful street art" \
  -F "photos=@image1.jpg"

# Request magic link
curl -X POST http://localhost:8787/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

### Using Postman

Import the collection from `postman-collection.json` in the repository root. It
includes:

- Pre-configured requests for all endpoints
- Environment variables for development/staging
- Authentication token management
- Example form data for submissions

## Database Management

### Schema Changes

1. Create new migration file in `migrations/`
2. Apply locally:
   `npx wrangler d1 execute cultural-archiver-dev --local --file=migrations/new-migration.sql`
3. Test with existing data
4. Update TypeScript types in `src/shared/types.ts`

### Sample Data

The development database includes sample artworks in Vancouver for testing:

```sql
-- Sample coordinates for testing
-- Downtown Vancouver: 49.2827, -123.1207
-- Nearby locations within 500m radius for testing discovery
```

### Database Debugging

```bash
# Access local database directly
npx wrangler d1 execute cultural-archiver-dev --local --command="SELECT * FROM artwork LIMIT 5"

# Export data for inspection
npx wrangler d1 export cultural-archiver-dev --local --output=backup.sql
```

## Performance Optimization

### Spatial Query Testing

Test with realistic datasets:

```typescript
// Generate test coordinates around Vancouver
const generateTestCoordinates = (count: number) => {
  const base = { lat: 49.2827, lon: -123.1207 };
  return Array.from({ length: count }, () => ({
    lat: base.lat + (Math.random() - 0.5) * 0.01,
    lon: base.lon + (Math.random() - 0.5) * 0.01,
  }));
};
```

### Rate Limiting Testing

```bash
# Test rate limit enforcement
for i in {1..15}; do
  curl -X POST http://localhost:8787/api/logbook \
    -H "Authorization: Bearer test-token" \
    -F "lat=49.2827" -F "lon=-123.1207" -F "note=Test $i"
done
```

## Deployment Testing

### Staging Environment

```bash
# Deploy to staging
npm run deploy:staging

# Test staging endpoints
curl "https://cultural-archiver-staging.workers.dev/api/artworks/nearby?lat=49.2827&lon=-123.1207"
```

### Production Deployment

```bash
# Run full test suite first
npm test

# Deploy to production
npm run deploy:production
```

## IDE Setup

### VS Code Configuration

Recommended extensions:

- TypeScript and JavaScript Language Features
- Prettier - Code formatter
- ESLint
- Cloudflare Workers

Workspace settings (`.vscode/settings.json`):

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.workingDirectories": ["src/workers"]
}
```

### Environment Variables

For development with environment variables:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "terminal.integrated.env.linux": {
    "NODE_ENV": "development"
  }
}
```

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for common issues and solutions.

## Next Steps

Once development setup is complete:

1. Review [API documentation](./api.md) for endpoint specifications
2. Check [deployment guide](./deployment.md) for production setup
3. Understand [rate limiting](./rate-limiting.md) configuration
4. Learn about [photo processing](./photo-processing.md) pipeline
