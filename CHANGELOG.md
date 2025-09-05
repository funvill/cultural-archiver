# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Complete Artwork Details Page implementation with mobile optimization (#22)
- PhotoCarousel component with touch/swipe support and fullscreen modal
- MiniMap component with responsive controls and Google Maps directions
- TagBadge component with expandable display (5 initial, "show more" option)
- LogbookTimeline component with chronological entries and pagination
- Direct marker click navigation to artwork details pages
- Comprehensive routing integration with breadcrumb navigation
- Enhanced mobile-first responsive design (320px to 1920px viewports)
- Touch-friendly UI with 44px minimum button sizes throughout
- WCAG AA accessibility compliance with screen reader support

### Enhanced

- Map markers now clickable for direct navigation to artwork details
- MapComponent with enhanced router integration and error handling
- Database schema with creators table and proper foreign key constraints
- API responses extended to include creator information and paginated logbook entries
- Comprehensive unit test suite (261 total tests, 255 passing)
- Code quality improvements with ESLint error resolution and TypeScript cleanup

### Fixed

- Map marker click handlers for direct navigation
- Mobile touch interactions and gesture support
- ESLint component tag order errors (Vue components)
- TypeScript compilation issues in API service
- Frontend test failures in AuditLogViewer date filtering
- URL parameter validation with UUID format checking
- Error handling for invalid artwork IDs and network issues

## [1.0.0] - 2024-12-XX

### Added

- Initial release of Cultural Archiver MVP
- Vue 3 + TypeScript frontend with Tailwind CSS
- Cloudflare Workers backend with Hono framework
- SQLite database (Cloudflare D1) with spatial indexing
- Cloudflare R2 storage for photo processing pipeline
- Interactive map with Leaflet + OpenStreetMap
- Photo upload with EXIF location extraction
- Anonymous user authentication with magic link verification
- Content moderation workflow with reviewer interface
- Mobile-first responsive design
- Comprehensive accessibility implementation (WCAG AA)
- Full API integration with error handling and retry logic
- Production deployment on Cloudflare infrastructure

### Security

- Anonymous user tokens (UUIDs) for submissions
- Age gates and content consent workflows
- Rate limiting (10/day per user token, 60/hour for lookups)
- Input validation and sanitization
