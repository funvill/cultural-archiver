# Mass-Import Documentation Update Summary

**Date:** October 13, 2025  
**Updated Document:** `docs/mass-import.md`  
**Status:** Complete

## Major Updates

### 1. Added Comprehensive Duplicate Detection Algorithm Documentation

**New Sections:**
- **Algorithm Specification**: Complete mathematical formula and search process
- **Scoring Components**: Detailed breakdown of all four signals (Title, Artist, Location, Tags)
- **Business Rules**: Five key rules governing duplicate detection behavior
- **Example Scenarios**: Three realistic examples with complete scoring calculations
- **Report Output**: JSON structure showing duplicate detection results

**Key Details Documented:**
- Search radius: 100 meters (spatial pre-filtering)
- Scoring radius: 50 meters (location score falloff)
- Default threshold: 0.75 (increased from 0.7 for conservative detection)
- Scoring weights:
  - Title: 0.2 points max (Levenshtein distance)
  - Artist: 0.2 points max (Levenshtein distance with multi-artist support)
  - Location: 0.3 points max (distance-weighted within 50m)
  - Tags: 0.05 points per exact match (no maximum)

### 2. Documented October 2025 Artist Matching Bug Fix

**Bug Description:**
- **Previous Behavior**: Artist comparison always returned 0 score
- **Root Cause**: Query selected `created_by` field (submitter UUID) instead of artist names
- **Database Schema**: Artist data stored in separate `artists` table with `artwork_artists` linking table

**Fix Implementation:**
- Updated SQL queries to JOIN with `artists` and `artwork_artists` tables
- Changed comparison field from `created_by` to `artist_names` (comma-separated list)
- Now properly retrieves actual artist names for comparison

**Code Changes:**
- `src/workers/lib/mass-import-duplicate-detection.ts`
- `src/workers/lib/mass-import-v2-duplicate-detection.ts`
- `src/shared/mass-import-similarity.ts` (existing logic was correct)

### 3. Added CLI Plugin System Documentation

**New Content:**
- **Architecture Overview**: Plugin-based design with importers and exporters
- **Available Plugins**: Complete list with descriptions
  - Importers: `osm-artwork`, `artist-json`, `vancouver-public-art`
  - Exporters: `api`, `json`, `console`
- **CLI Usage**: Build instructions and command structure
- **Example Commands**: Three practical examples with full parameter sets
- **Configuration Files**: Structure and field descriptions

**Practical Examples:**
```bash
# Import OSM artwork data
node dist/lib/mass-import-system/cli/cli-entry.js import \
  --importer osm-artwork \
  --exporter api \
  --config api-config-dev.json \
  --input merged-artworks.geojson \
  --limit 100 \
  --generate-report
```

### 4. Enhanced Business Rules & Data Integrity Section

**New Comprehensive Coverage:**
- **Artwork Records**: Title requirements, coordinate validation, status assignment
- **Artist Records**: Name requirements, matching logic, linking behavior
- **Photo Management**: Limits, processing pipeline, URL storage
- **Tag Management**: Structure, reserved keys, validation rules
- **External ID Management**: Purpose, format, duplicate detection impact

### 5. Added System Architecture Diagram

**Visual Component:**
```text
[Data Source] → [Importer Plugin] → [Data Pipeline] → [Exporter Plugin]
                                                             ↓
                                                    Backend API
                                                             ↓
                    [Duplicate Detection] ← [Database] → [Artist Linking]
```

### 6. Expanded Best Practices Section

**New Subsections:**
- **Data Preparation**: 4 detailed guidelines with examples
- **Import Strategy**: Start small, batch processing, photo caching
- **Duplicate Management**: Prevention, threshold tuning, manual review
- **Development Workflow**: Plugin development, config management, logging

**Practical Guidance:**
- Batch size recommendations: 50-100 items optimal
- Pagination strategy for large datasets
- Threshold tuning guidelines (default 0.75, range 0.6-0.9)
- Error recovery procedures

### 7. Added Comprehensive Report System Documentation

**Report Structure:**
```json
{
  "summary": { "total": 100, "successful": 88, "skipped": 10 },
  "records": [
    {
      "status": "skipped",
      "duplicateInfo": {
        "confidenceScore": 0.85,
        "scoreBreakdown": { "title": 0.2, "artist": 0.2, ... }
      }
    }
  ]
}
```

**Report Location:** `./reports/mass-import-{timestamp}.json`

### 8. Enhanced Security Considerations

**New Content:**
- **Authentication & Authorization**: Admin-only access, token security, audit logging
- **Data Validation**: Input sanitization, coordinate validation, photo URL security
- **Rate Limiting**: 100 requests/hour default, configurable
- **Data Privacy**: Attribution, automatic approval, public visibility

### 9. Added Troubleshooting Section

**Common Issues Covered:**
1. Unauthorized (401) - Token issues
2. Forbidden (403) - Role issues
3. High Duplicate Detection Rate - Threshold tuning
4. Photo Processing Failures - Network/format issues
5. Build Failures - Dependency/compilation issues

**Each Issue Includes:**
- Cause explanation
- Step-by-step solution
- Code examples where applicable

### 10. Added Backend Processing Pipeline Documentation

**Six-Stage Pipeline:**
1. Request Validation
2. Duplicate Detection
3. Artist Management
4. Photo Processing
5. Database Insert
6. Response Generation

**Each Stage Documented:**
- Purpose and behavior
- Error handling
- Database interactions

### 11. Restructured V1 Legacy Section

**Changes:**
- Moved to bottom of document
- Added deprecation warning
- Documented differences from V2
- Provided migration guide

### 12. Added Table of Contents

**Navigation:**
- 11 major sections with subsection links
- Quick reference for 50+ subsections
- Markdown anchor links for easy navigation

## Document Statistics

**Before Update:**
- Length: ~337 lines
- Focus: Basic API endpoint documentation
- Coverage: V1 and V2 API schemas only

**After Update:**
- Length: ~1,145 lines (3.4x increase)
- Focus: Complete system documentation
- Coverage: CLI, API, algorithm, business rules, security, troubleshooting

**New Sections:** 15+  
**Code Examples:** 25+  
**Business Rules:** 30+

## Impact

### For Developers
- Complete understanding of duplicate detection algorithm
- Practical CLI usage examples
- Clear business rules for validation logic
- Security best practices

### For Data Importers
- Step-by-step import procedures
- Batch processing strategies
- Duplicate management guidance
- Troubleshooting solutions

### For System Administrators
- Security configuration requirements
- Performance tuning guidelines
- Monitoring and logging practices
- Error recovery procedures

## Testing Validation

**Code Changes Tested:**
- ✅ All 46 mass-import system tests pass
- ✅ Build completes with 0 errors
- ✅ TypeScript compilation successful
- ✅ Artist matching fix verified in code

**Documentation Quality:**
- ✅ Table of contents complete
- ✅ All sections cross-referenced
- ✅ Code examples validated
- ⚠️ Minor markdown linting warnings (formatting only, not content)

## Maintenance Notes

### Future Updates Needed

1. **When Algorithm Changes**: Update scoring weights, threshold values, search radius
2. **New Plugins Added**: Update available plugins lists with descriptions
3. **API Schema Changes**: Update request/response examples
4. **Security Changes**: Update authentication/authorization procedures
5. **Performance Improvements**: Document new optimization strategies

### Related Documents to Keep in Sync

- `src/lib/mass-import-system/README.md` - CLI plugin system documentation
- `docs/database.md` - Database schema for artists and artwork_artists tables
- `docs/api.md` - General API authentication and rate limiting
- `docs/photo-processing.md` - Photo pipeline details

## Conclusion

The mass-import documentation has been transformed from a basic API reference into a comprehensive guide covering all aspects of the mass-import system, including the recently fixed artist matching algorithm. The document now serves as a complete resource for developers, data importers, and system administrators working with the Cultural Archiver's bulk data import capabilities.
