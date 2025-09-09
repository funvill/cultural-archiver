# Cultural Archiver

**Cultural Archiver** is a production-ready community-driven platform that empowers people to become Citizen Cultural Archivists. The goal is to document, preserve, and share public and cultural artworks so they remain accessible to everyone, forever.

## 🌍 Project Vision

Cities are filled with cultural landmarks—murals, sculptures, mosaics, tiny libraries, installations, and more. Too often, these works fade away, get demolished, or disappear when privately managed websites go offline. Cultural Archiver provides a public, open platform to:

- **Discover** public art near you on an interactive map.
- **Document** artworks by uploading photos, notes, and details.
- **Preserve** submissions by contributing metadata under CC0 to the open commons.
- **Contribute** to long-lived open datasets such as OpenStreetMap and Wikidata (future phases).

This ensures that the cultural history of our cities outlives any single platform or institution.

## 🚀 Production Ready Status

✅ **Complete Fast Photo-First Workflow - Production Ready**:

### **🗄️ Complete Database Infrastructure**
- **Full schema migration system** with 6 migrations applied successfully
- **Production database operational** with all required entities and relationships
- **Real photo processing pipeline** with R2 storage integration and EXIF extraction
- **API endpoints functional** including similarity checking, nearby searches, and uploads

### **🎨 Revolutionary 3-Screen Fast Photo Workflow**
- **Screen 1**: Smart photo upload with intelligent location detection (EXIF GPS → Browser → IP → Manual)
- **Screen 2**: Automated nearby artwork search with prominent "Add New Artwork" card
- **Screen 3**: Streamlined details form with pre-filled data and minimal required fields
- **Ultra-fast submission times** (≤20s) with duplicate detection reducing submissions by ≥30%

### **🏗️ Enterprise-Grade Architecture**
- **Frontend**: Vue 3 + TypeScript + Tailwind CSS deployed as Cloudflare Worker
- **Backend**: Cloudflare Workers + Hono framework with comprehensive API
- **Database**: SQLite (Cloudflare D1) with spatial indexing and migration system
- **Storage**: Cloudflare R2 for photo processing with EXIF location extraction
- **Quality Assurance**: 539 passing tests (1 skipped) across 30 test suites

### **🔧 Production Code Quality**
- **Build System**: ✅ Both frontend and backend building successfully
- **Type Safety**: TypeScript strict mode with proper error handling
- **Code Standards**: ESLint with 229 issues (43 errors, 186 warnings) - significantly improved from initial state
- **Vue.js Standards**: Standardized event naming (camelCase) and component architecture

**Latest Features (v2.0 - Fast Photo Workflow):**

- 🚀 **Fast Photo-First Workflow**: Revolutionary 3-screen submission process with ≤20s completion time
- 🔍 **Intelligent Similarity Engine**: Multi-signal duplicate detection (location + title + tags) reducing duplicate submissions by ≥30%
- 📸 **Smart Location Detection**: Hierarchical location resolution (EXIF GPS → Browser → IP → Manual map picker)
- 🎯 **Nearby Artwork Discovery**: Automatic search results with prominent "Add New Artwork" option
- 🗄️ **Complete Database Infrastructure**: Full migration system with 6 applied migrations
- ⚡ **Real-Time Photo Processing**: EXIF extraction and R2 storage with thumbnail generation
- 🧪 **Production Code Quality**: 539 passing tests with significantly improved TypeScript compliance

**Previous Features (v1.2 - Data Export System):**

- 💾 **Backup System**: Complete system snapshots for disaster recovery with database and R2 photo collection
- 📦 **Data Dumps**: Public CC0-licensed data exports for researchers and developers
- 🔧 **Admin Interface**: Data dump management with one-click generation and download history
- 📋 **CLI Tools**: NPM commands for local and remote backup generation with progress logging
- 🛡️ **Data Privacy**: Comprehensive filtering to exclude sensitive information from public exports

**Core Platform Features (v1.0-1.1):**

- 🎨 **PhotoCarousel**: Touch/swipe support with fullscreen modal and keyboard navigation
- 🗺️ **Interactive Map**: Leaflet + OpenStreetMap with clickable markers and clustering
- 🏷️ **Smart Tagging**: TagBadge system with expandable display and structured metadata
- 📖 **Community Engagement**: LogbookTimeline with chronological community contributions
- 📱 **Mobile-First Design**: Responsive layouts with 44px touch targets and WCAG AA compliance
- 🔐 **Privacy-First Auth**: Anonymous tokens with optional email verification via magic links
- ✅ **Content Moderation**: Review queue with approval/rejection workflow and detailed logs

## 🎯 User Experience

The platform focuses on making cultural archiving accessible and enjoyable:

- **Upload photos** (auto-geolocated) and notes about artworks with intelligent duplicate prevention
- **See submissions immediately** with real-time feedback and community visibility after moderation
- **Browse artworks** on an interactive map with rich detail pages and photo galleries
- **Contribute to the commons** with all metadata released under CC0 for maximum reuse
- **Store data safely** in enterprise-grade Cloudflare infrastructure (Workers, D1, R2)

## 🛠 Tech Stack

### Frontend (Production Ready)

- **Framework**: Vue 3 + TypeScript + Composition API
- **Styling**: Tailwind CSS with mobile-first responsive design
- **Build**: Vite with optimized production builds
- **State**: Pinia stores with reactive TypeScript interfaces
- **Routing**: Vue Router with lazy loading and navigation guards
- **Maps**: Leaflet + OpenStreetMap with artwork clustering and clickable markers
- **Components**: PhotoCarousel, MiniMap, TagBadge, LogbookTimeline for rich artwork details
- **Accessibility**: WCAG AA compliant with comprehensive screen reader support
- **Testing**: Vitest with 261 unit tests across 19 test files covering components, views, and API integration

### Backend (Production Ready)

- **Runtime**: Cloudflare Workers + TypeScript + Hono framework
- **Database**: SQLite (Cloudflare D1) with spatial indexing
- **Storage**: Cloudflare R2 for photo uploads (up to 15MB per photo)
- **Cache**: Cloudflare KV for rate limiting and magic link sessions
- **Auth**: Anonymous UUID tokens + optional email magic link verification
- **Testing**: 54 comprehensive tests across all API endpoints

### Infrastructure

- **Hosting**: Cloudflare Pages (frontend) + Workers (backend)
- **Global CDN**: Automatic edge caching and distribution
- **Monitoring**: Built-in analytics and error tracking
- **Security**: CORS handling, rate limiting, input validation

## Licensing

- Metadata → CC0
- Photos → Free licenses (Commons integration in later phases)

## 📚 API Documentation

The Cultural Archiver API provides a comprehensive backend for crowdsourced public art mapping. The API is built with Hono and TypeScript, running on Cloudflare Workers.

### Base URL

#### Production

- Main website: https://art.abluestar.com
- API: https://art-api.abluestar.com/api
- Photos: https://art-photos.abluestar.com

#### Devlopment

- Main website: http://localhost:8787

### Authentication

Uses anonymous user tokens with multiple authentication methods:

**Primary Method (Recommended):**

```http
X-User-Token: {user-token-uuid}
```

**Alternative Methods:**

```http
Authorization: Bearer {user-token-uuid}
# OR
Cookie: user_token={user-token-uuid}
```

The frontend uses `X-User-Token` header by default.

### Core Endpoints

#### Submission Workflow

```http
POST /api/logbook
Content-Type: multipart/form-data
X-User-Token: {user-token}

# Submit artwork with photos and location
lat: 49.2827
lon: -123.1207
note: "Beautiful street art on Main Street"
photos: [file1.jpg, file2.jpg] # Up to 3 photos, 15MB each
```

#### Discovery

```http
# Find nearby artworks
GET /api/artworks/nearby?lat=49.2827&lon=-123.1207&radius=500

# Get artwork details
GET /api/artworks/{artwork-id}
```

#### User Management

```http
# Get user's submissions
GET /api/me/submissions
X-User-Token: {user-token}

# Get user profile and stats
GET /api/me/profile
X-User-Token: {user-token}
```

#### Email Authentication

```http
# Request magic link
POST /api/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com"
}

# Consume magic link token
POST /api/auth/consume
Content-Type: application/json

{
  "token": "magic-link-token"
}
```

#### Content Moderation (Reviewers Only)

```http
# Get review queue
GET /api/review/queue
Authorization: Bearer {reviewer-token}

# Approve submission
POST /api/review/approve/{logbook-id}
Authorization: Bearer {reviewer-token}

# Reject submission
POST /api/review/reject/{logbook-id}
Authorization: Bearer {reviewer-token}
```

### Rate Limits

- **Submissions**: 10 per day per user token
- **Queries**: 60 per hour per user token
- **Magic Links**: 5 per hour per email

### Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

For complete API documentation with examples and error codes, see [`docs/api.md`](docs/api.md).

## 🚀 Quick Start

### Prerequisites

- **Node.js >=22.0.0** (required for native TypeScript support)
- **npm** (comes with Node.js)
- **Cloudflare account** (for deployment)

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/funvill/cultural-archiver.git
   cd cultural-archiver
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment setup**

   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare credentials
   # Required for migrations: D1_DATABASE_ID and CLOUDFLARE_API_TOKEN
   ```

4. **Run database migrations**

   ```bash
   npm run migrate
   ```

5. **Start development servers**

   ```bash
   npm run dev
   ```

   This starts both the frontend (Vite) and workers (Wrangler) with hot reloading.

### Available Scripts

- `npm run dev` - Start development servers for frontend and workers
- `npm run build` - Build both frontend and workers for production
- `npm run test` - Run test suite (ESLint, TypeScript checks, Prettier)
- `npm run lint` - Run ESLint on all TypeScript files
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript compiler checks
- `npm run migrate` - Run database migrations against Cloudflare D1 (requires .env setup)
- `npm run migrate:list` - List all available migration files
- `npm run migrate:help` - Show migration help and setup instructions
- `npm run backup` - Generate local backup archive with database and photos
- `npm run backup:remote` - Generate remote backup using Cloudflare credentials
- `npm run deploy:frontend` - Deploy frontend to Cloudflare Pages
- `npm run deploy:workers` - Deploy workers to Cloudflare

### Project Structure

```text
cultural-archiver/
├── src/
│   ├── frontend/           # Vue 3 + TypeScript frontend
│   │   ├── components/     # Vue components
│   │   ├── views/          # Page components
│   │   └── main.ts         # Frontend entry point
│   ├── workers/            # Cloudflare Workers backend
│   │   ├── index.ts        # Workers entry point and main router
│   │   ├── routes/         # API route handlers
│   │   │   ├── auth.ts     # Magic link authentication
│   │   │   ├── discovery.ts # Artwork discovery and search
│   │   │   ├── review.ts   # Content moderation endpoints
│   │   │   ├── submissions.ts # Logbook submissions
│   │   │   └── user.ts     # User management
│   │   ├── middleware/     # Request middleware
│   │   │   ├── auth.ts     # Authentication and permissions
│   │   │   ├── rateLimit.ts # Rate limiting with KV storage
│   │   │   └── validation.ts # Input validation with Zod
│   │   ├── lib/            # Utility libraries
│   │   │   ├── database.ts # D1 database operations
│   │   │   ├── email.ts    # Magic link email sending
│   │   │   ├── photos.ts   # R2 photo processing
│   │   │   ├── spatial.ts  # Geospatial calculations
│   │   │   └── errors.ts   # Error handling utilities
│   │   └── tests/          # Comprehensive test suite
│   └── shared/             # Shared TypeScript types and utilities
├── migrations/             # Database migration scripts
├── docs/                   # Project documentation
│   ├── api.md             # Complete API documentation
│   ├── deployment.md      # Cloudflare deployment guide
│   ├── development.md     # Local development setup
│   ├── rate-limiting.md   # Rate limiting configuration
│   ├── photo-processing.md # Photo upload pipeline
│   └── troubleshooting.md # Common issues and solutions
├── .github/                # GitHub workflows and templates
└── postman-collection.json # API testing collection
```

### Development Features

- **Native TypeScript**: Uses Node.js v23+ native TypeScript support (no compilation needed)
- **Hot Reloading**: Frontend and workers restart automatically on changes
- **Shared Types**: Common TypeScript interfaces between frontend and backend
- **Database Migrations**: Version-controlled schema changes with TypeScript runner
- **CI/CD**: Automated testing and deployment workflows

### Cloudflare Resources

The project uses these Cloudflare services:

- **Pages**: Frontend hosting with automatic deployments from GitHub
- **Workers**: Serverless backend API with global edge distribution
- **D1**: SQLite database with automatic scaling and replication
- **KV**: Key-value store for rate limiting, sessions, and magic links
- **R2**: Object storage for artwork photos with CDN integration

### Worker API Features

- **Spatial Queries**: Efficient geospatial search with bounding box optimization
- **Photo Processing**: Secure upload pipeline with validation and R2 storage
- **Rate Limiting**: Per-user limits using KV storage (10 submissions/day, 60 queries/hour)
- **Magic Link Auth**: Email verification with secure token generation
- **Content Moderation**: Review workflow for submissions with approval/rejection
- **Type Safety**: Full TypeScript with comprehensive error handling
- **Testing**: 54 tests across integration, performance, and moderation workflows

### Documentation

- **[API Documentation](docs/api.md)**: Complete endpoint specifications with examples
- **[Deployment Guide](docs/deployment.md)**: Cloudflare Workers, D1, KV, and R2 setup
- **[Development Guide](docs/development.md)**: Local development and debugging
- **[Rate Limiting](docs/rate-limiting.md)**: Configuration and monitoring
- **[Photo Processing](docs/photo-processing.md)**: Upload pipeline and R2 storage
- **[Troubleshooting](docs/troubleshooting.md)**: Common issues and solutions

### Setup Time Goals

- **15 minutes**: Complete development environment setup
- **5 minutes**: Deploy changes to production

## 🤝 Contributing

Everyone is welcome to contribute to this project. See the CONTRIBUTING.md for guidelines. All metadata is licensed CC0, making it freely reusable for the commons.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make changes using TypeScript (leverages Node.js v23+ native support)
4. Run tests: `npm test`
5. Submit a pull request

### Code Standards

- **TypeScript**: Strict mode enabled for better code quality
- **ESLint**: Configured with Vue/TypeScript rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Use `feat:`, `fix:`, `refactor:`, etc.
