# Tag Categorization System - Quick Reference

This document provides a quick overview of the Cultural Archiver's tag categorization system for developers making schema changes.

## Recent Changes (September 2025)

**Location Tags Fixed**: The city, province, and country tags now properly appear under "Location Details" instead of "Other" category.

**Files Updated**:
- `src/shared/tag-schema.ts` - Backend schema with location_details category
- `src/frontend/src/services/tagSchema.ts` - Frontend schema with location category
- `src/workers/lib/artwork-edits.ts` - Enhanced categorization function
- `src/workers/routes/discovery.ts` - API response includes tags_categorized

## Key Documentation

| File | Purpose | When to Use |
|------|---------|-------------|
| [Tagging System Development Guide](./tagging-system-development.md) | Complete developer guide | Making schema changes, debugging categorization |
| [Tag Schema Reference](./tag-schema.md) | Technical specification | API integration, validation rules |
| [User Guide: Tags](./user-guide-tags.md) | User-facing documentation | Understanding tag usage, search examples |

## Quick Development Workflow

### Moving Tags Between Categories

1. **Update Backend Schema** (`src/shared/tag-schema.ts`):
   ```typescript
   category: 'location_details' // Change category here
   ```

2. **Update Frontend Schema** (`src/frontend/src/services/tagSchema.ts`):
   ```typescript
   category: 'location' // Must match backend category mapping
   ```

3. **Deploy Both**:
   ```powershell
   npm run deploy:workers
   npm run deploy:frontend
   ```

4. **Test**: Check artwork detail page for correct categorization

### Category Mapping

| Backend Category | Frontend Category | Display Name |
|------------------|-------------------|---------------|
| `physical_properties` | `physical` | "Physical Properties" |
| `historical_info` | `historical` | "Historical Information" |
| `location_details` | `location` | "Location Details" |
| `artwork_classification` | `classification` | "Artwork Classification" |
| `reference_data` | `reference` | "Reference Data" |

## Common Issues & Solutions

### Tags appear in "Other" category
- ✅ **Check**: Tag exists in both backend and frontend schemas
- ✅ **Check**: Category names match between schemas
- ✅ **Check**: Both backend and frontend are deployed

### Frontend shows wrong categories  
- ✅ **Check**: Browser cache (Ctrl+F5 to hard refresh)
- ✅ **Check**: Frontend deployment completed successfully
- ✅ **Check**: API response includes `tags_categorized` field

### Backend categorization not working
- ✅ **Check**: `categorizeTagsForDisplay()` function called in discovery.ts
- ✅ **Check**: Backend deployment completed successfully
- ✅ **Check**: No JavaScript errors in worker logs

## Testing Checklist

Before deploying schema changes:

- [ ] Backend schema updated with correct category
- [ ] Frontend schema updated with matching category
- [ ] Tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Backend deployed (`npm run deploy:workers`)
- [ ] Frontend deployed (`npm run deploy:frontend`)
- [ ] Live testing confirms fix

## Contact & Resources

- **Primary Documentation**: [Tagging System Development Guide](./tagging-system-development.md)
- **Technical Reference**: [Tag Schema Reference](./tag-schema.md)
- **API Documentation**: [API Reference](./api.md)
- **Database Schema**: [Database Documentation](./database.md)

For questions about tag categorization, refer to the comprehensive development guide above or create a GitHub issue with details about the specific categorization problem.