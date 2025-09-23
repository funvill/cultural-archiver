# Progress: Artwork Submission Issues Fix

## Overview

Fixing multiple issues with the artwork submission system where data is not being properly saved, displayed, or processed.

## Issues Identified

1. **Title Issue**: Submission shows "Untitled Submission" instead of submitted title "test title"
2. **Description Issue**: Shows "No note provided" instead of submitted description "this is the description"
3. **User Identity Issue**: Shows "Anonymous" instead of user UUID
4. **Artwork Type Issue**: Shows "unknown" instead of selected type "tiny_library"
5. **Photo Display Issue**: Shows 39 black images with incorrect URLs ("/artwork/t" instead of proper image URLs)

## Investigation Progress

### Task 1: Create Progress Tracking File

**Status**: ✅ Completed **Summary**: Created this progress file to track the investigation and fixes.

### Task 2: Investigate Submission Endpoint

**Status**: ✅ Completed **Summary**: Found multiple issues in the submission flow:

1. **Frontend Data Mapping Issue**: Frontend sends `note` but backend expects `notes` (plural)
2. **Artwork Type Issue**: Fast submissions hardcode `artwork_type: 'unknown'` instead of using the form selection
3. **Title Storage Issue**: Title is stored in `notes` as JSON instead of proper fields
4. **Description/Notes Confusion**: Description from form is not being mapped correctly

**Key Files Analyzed**:

- `src/frontend/src/stores/artworkSubmission.ts` - Frontend submission logic
- `src/workers/routes/submissions.ts` - Backend `/api/artworks/fast` endpoint
- `src/workers/types.ts` - Request/response type definitions

### Task 3: Investigate Moderation Queue Display

**Status**: ⏳ Pending

### Task 4: Fix Artwork Type Mapping

**Status**: ⏳ Pending

### Task 5: Fix Photo Display Issues

**Status**: ⏳ Pending

### Task 6: Test Complete Submission Flow

**Status**: ⏳ Pending

### Task 7: Run Tests and Build Verification

**Status**: ⏳ Pending

## Technical Notes

- Project uses Vue 3 + TypeScript frontend with Cloudflare Workers backend
- Database is SQLite (Cloudflare D1) with migrations system
- Photos stored in Cloudflare R2 with thumbnail generation
- API documentation available at `/docs/api.md`

## Next Steps

1. Examine the submission API endpoint implementation
2. Check database schema and data storage
3. Investigate moderation queue data retrieval
4. Fix photo URL generation and carousel display

---

_Last Updated: September 15, 2025_
