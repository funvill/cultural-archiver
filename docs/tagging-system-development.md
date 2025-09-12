# Tagging System Development Guide

This document provides comprehensive guidance for developers working with the Cultural Archiver tagging system, including schema modifications, categorization changes, and troubleshooting common issues.

## Overview

The Cultural Archiver uses a dual-schema tagging system with backend and frontend components that must be kept in sync. Tag categorization determines how tags are displayed to users in organized sections on artwork detail pages.

### Architecture

```text
Frontend Tag Schema ← API Response ← Backend Tag Categorization ← Database Tags
src/frontend/src/      src/workers/     src/workers/lib/          SQLite JSON
services/tagSchema.ts  routes/          artwork-edits.ts          artwork.tags
                       discovery.ts     + tag-schema.ts
```

## File Structure

### Core Files

| File | Purpose | Responsibilities |
|------|---------|------------------|
| `src/shared/tag-schema.ts` | Backend schema definitions | Tag definitions, categories, validation rules |
| `src/workers/lib/artwork-edits.ts` | Tag categorization logic | `categorizeTagsForDisplay()` function |
| `src/workers/routes/discovery.ts` | API endpoint enhancement | Adds `tags_categorized` to artwork responses |
| `src/frontend/src/services/tagSchema.ts` | Frontend schema definitions | Tag definitions for UI components |
| `src/frontend/src/components/TagBadge.vue` | Tag display component | Uses frontend schema for categorization |

### Documentation Files

| File | Content | Audience |
|------|---------|-----------|
| `docs/tag-schema.md` | Complete technical reference | Developers, API users |
| `docs/user-guide-tags.md` | User-facing guide | Contributors, moderators |
| `docs/tagging-system-development.md` | This file | Developers |

## Common Development Tasks

### 1. Moving Tags Between Categories

**Problem**: Tags appear in wrong category (e.g., location tags in "Other" instead of "Location Details")

**Root Cause**: Usually inconsistency between backend schema and frontend schema definitions.

**Solution Steps**:

1. **Update Backend Schema** (`src/shared/tag-schema.ts`):
   ```typescript
   {
     key: 'city',
     label: 'City',
     description: 'City where the artwork is located',
     category: 'location_details', // ✅ Correct category
     dataType: 'text',
     required: false,
     osmMapping: 'addr:city',
   }
   ```

2. **Update Frontend Schema** (`src/frontend/src/services/tagSchema.ts`):
   ```typescript
   {
     key: 'city',
     label: 'City',
     description: 'City where the artwork is located',
     category: 'location', // ✅ Must match display category
     dataType: 'text',
     required: false,
   }
   ```

3. **Deploy Backend**:
   ```powershell
   npm run deploy:workers
   ```

4. **Deploy Frontend**:
   ```powershell
   npm run deploy:frontend
   ```

5. **Verify Fix**:
   Use Playwright or browser dev tools to check categorization.

### 2. Adding New Tag Categories

**Steps**:

1. **Define Category in Backend** (`src/shared/tag-schema.ts`):
   ```typescript
   export const TAG_CATEGORIES: Record<TagCategory, CategoryInfo> = {
     // ... existing categories
     new_category: {
       key: 'new_category',
       label: 'New Category',
       description: 'Description of new category',
       icon: 'icon-name',
       displayOrder: 6,
     },
   };
   ```

2. **Update Type Definition**:
   ```typescript
   export type TagCategory = 
     | 'physical_properties'
     | 'historical_info' 
     | 'location_details'
     | 'artwork_classification'
     | 'reference_data'
     | 'new_category'; // ✅ Add here
   ```

3. **Add Tags to New Category**:
   ```typescript
   export const TAG_DEFINITIONS: TagDefinition[] = [
     // ... existing tags
     {
       key: 'new_tag',
       label: 'New Tag',
       description: 'Description',
       category: 'new_category', // ✅ Use new category
       dataType: 'text',
       required: false,
     },
   ];
   ```

4. **Update Frontend Schema** with equivalent definitions.

5. **Test and Deploy**.

### 3. Adding New Tags

**Process**:

1. **Research OpenStreetMap Compatibility**:
   - Check [OSM Wiki](https://wiki.openstreetmap.org/wiki/Key:artwork_type) for existing standards
   - Verify no conflicts with existing tags
   - Document OSM mapping if applicable

2. **Backend Implementation** (`src/shared/tag-schema.ts`):
   ```typescript
   {
     key: 'new_field',
     label: 'New Field',
     description: 'Detailed description for developers',
     category: 'appropriate_category',
     dataType: 'enum', // or text, number, etc.
     required: false,
     enumValues: ['value1', 'value2', 'value3'], // if enum type
     validation: {
       maxLength: 200, // if text type
       min: 0, // if number type
       max: 100,
     },
     osmMapping: 'osm_key', // if applicable
     helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:new_field',
     examples: ['example1', 'example2'],
   }
   ```

3. **Frontend Implementation** (`src/frontend/src/services/tagSchema.ts`):
   ```typescript
   {
     key: 'new_field',
     label: 'New Field',
     description: 'User-friendly description',
     category: 'display_category', // Maps to backend category
     dataType: 'enum',
     enumValues: ['value1', 'value2', 'value3'],
     placeholder: 'Choose a value...',
   }
   ```

4. **Database Migration** (if needed):
   - Create migration file in `src/workers/migrations/`
   - Update indexes if the tag will be frequently queried

5. **Testing**:
   ```powershell
   npm run test # Run all tests
   npm run test:workers # Backend tests
   npm run test:frontend # Frontend tests
   ```

### 4. Debugging Tag Categorization Issues

**Common Issues**:

1. **Tags appear in "Other" category**:
   - Check if tag exists in both backend and frontend schemas
   - Verify category names match between schemas
   - Confirm `categorizeTagsForDisplay()` function is being called

2. **Frontend shows wrong categories**:
   - Check browser cache (hard refresh with Ctrl+F5)
   - Verify frontend deployment completed successfully
   - Check console for JavaScript errors

3. **Backend categorization not working**:
   - Check `discovery.ts` includes `tags_categorized` in response
   - Verify `categorizeTagsForDisplay()` function logic
   - Check tag definitions exist in backend schema

**Debugging Tools**:

1. **Browser Dev Tools**:
   ```javascript
   // Check API response structure
   fetch('/api/artworks/artwork-id').then(r => r.json()).then(console.log);
   
   // Check frontend tag schema
   console.log(window.tagSchema); // if exposed
   ```

2. **Backend Logging**:
   ```typescript
   // Add temporary logging in categorizeTagsForDisplay()
   console.log('Input tags:', tags);
   console.log('Categorized result:', result);
   ```

3. **Playwright Testing**:
   ```javascript
   // Check rendered categorization
   const locationSection = await page.locator('h4:has-text("Location Details")');
   const tags = await locationSection.locator('..').locator('[class*="tag"]').allTextContents();
   console.log('Location tags:', tags);
   ```

## Schema Synchronization

### Critical Synchronization Points

1. **Tag Definitions**: Must exist in both backend and frontend
2. **Category Mapping**: Frontend categories must map to backend categories
3. **Enum Values**: Must match exactly between schemas
4. **Validation Rules**: Should be consistent for user experience

### Category Mapping Table

| Backend Category | Frontend Category | Display Name |
|------------------|-------------------|---------------|
| `physical_properties` | `physical` | "Physical Properties" |
| `historical_info` | `historical` | "Historical Information" |
| `location_details` | `location` | "Location Details" |
| `artwork_classification` | `classification` | "Artwork Classification" |
| `reference_data` | `reference` | "Reference Data" |

### Verification Checklist

Before deploying schema changes:

- [ ] Backend schema updated
- [ ] Frontend schema updated  
- [ ] Categories match between schemas
- [ ] Tag definitions consistent
- [ ] Tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Both backend and frontend deployed
- [ ] Live testing confirms fix

## API Integration

### Backend API Enhancement

The `categorizeTagsForDisplay()` function enhances API responses:

```typescript
// In src/workers/routes/discovery.ts
const tagsParsed = artwork.tags ? JSON.parse(artwork.tags) : {};
const categorizedTags = categorizeTagsForDisplay(tagsParsed);

return {
  ...artwork,
  tags_categorized: categorizedTags, // ✅ Enhanced response
};
```

### Frontend Consumption

Frontend components use the categorized structure:

```vue
<!-- In TagBadge.vue or artwork detail components -->
<template>
  <div v-for="(category, categoryKey) in artwork.tags_categorized" :key="categoryKey">
    <h4>{{ getCategoryDisplayName(categoryKey) }}</h4>
    <div v-for="tag in category" :key="tag.key">
      {{ tag.label }}: {{ tag.value }}
    </div>
  </div>
</template>
```

## Performance Considerations

### Database Optimization

For frequently queried tags, add functional indexes:

```sql
-- Example: Index for material-based searches
CREATE INDEX idx_artwork_tags_material ON artwork(
  json_extract(tags, '$.material')
) WHERE json_extract(tags, '$.material') IS NOT NULL;

-- Example: Index for year-based searches  
CREATE INDEX idx_artwork_tags_year ON artwork(
  CAST(json_extract(tags, '$.year') AS INTEGER)
) WHERE json_extract(tags, '$.year') IS NOT NULL;
```

### Frontend Performance

- Tag schemas are loaded once and cached
- Categorization happens server-side to reduce client processing
- Lazy loading for large tag lists

### Caching Strategy

- API responses include pre-categorized tags
- Frontend caches schema definitions
- Browser caching for static schema files

## Testing Strategy

### Unit Tests

**Backend Tests** (`src/workers/test/`):
```typescript
describe('Tag Categorization', () => {
  test('categorizes city tags under location_details', () => {
    const tags = { city: 'vancouver', province: 'british_columbia' };
    const result = categorizeTagsForDisplay(tags);
    
    expect(result.location_details).toHaveLength(2);
    expect(result.location_details[0].key).toBe('city');
  });
});
```

**Frontend Tests** (`src/frontend/src/test/`):
```typescript
describe('TagBadge Component', () => {
  test('displays location tags in Location Details section', () => {
    const artwork = {
      tags_categorized: {
        location_details: [
          { key: 'city', value: 'vancouver', label: 'City' }
        ]
      }
    };
    
    const wrapper = mount(TagBadge, { props: { artwork } });
    expect(wrapper.text()).toContain('Location Details');
    expect(wrapper.text()).toContain('City: vancouver');
  });
});
```

### Integration Tests

**End-to-End Testing**:
```typescript
// Test complete workflow
test('tag categorization end-to-end', async () => {
  // 1. Create artwork with location tags
  const artwork = await createTestArtwork({
    tags: { city: 'vancouver', country: 'canada' }
  });
  
  // 2. Fetch via API
  const response = await fetch(`/api/artworks/${artwork.id}`);
  const data = await response.json();
  
  // 3. Verify categorization
  expect(data.tags_categorized.location_details).toBeDefined();
  expect(data.tags_categorized.location_details).toHaveLength(2);
});
```

### Playwright Testing

**Browser Automation**:
```typescript
test('location tags display correctly', async ({ page }) => {
  await page.goto('/artwork/test-artwork-id');
  
  // Wait for page load
  await page.waitForSelector('h4:has-text("Location Details")');
  
  // Check tag placement
  const locationSection = page.locator('h4:has-text("Location Details")');
  const tags = await locationSection.locator('..').locator('[class*="tag"]').allTextContents();
  
  expect(tags).toContain('City:vancouver');
  expect(tags).toContain('Country:canada');
});
```

## Migration Procedures

### Schema Version Updates

When making breaking changes to the schema:

1. **Version Increment**:
   ```typescript
   export const SCHEMA_VERSION = {
     version: '1.1.0', // ✅ Increment version
     releaseDate: '2025-09-11',
     changes: [
       'Added city, province, country to location_details category',
       'Enhanced tag categorization logic'
     ]
   };
   ```

2. **Backward Compatibility**:
   ```typescript
   function migrateTagSchema(tags: any, fromVersion: string): StructuredTags {
     // Handle migration from older versions
     if (fromVersion === '1.0.0') {
       // Apply v1.0.0 → v1.1.0 migration rules
       return migrateFromV1_0_0(tags);
     }
     return tags;
   }
   ```

3. **Database Migration**:
   ```sql
   -- File: src/workers/migrations/XXXX_update_tag_categorization.sql
   
   -- Update existing artworks with new categorization
   UPDATE artwork 
   SET tags = json_patch(tags, '{"version": "1.1.0"}')
   WHERE json_extract(tags, '$.version') = '1.0.0';
   ```

### Data Migration

For bulk tag recategorization:

```typescript
// Script for mass tag updates
async function migrateLocationTags() {
  const artworks = await db.prepare(`
    SELECT id, tags FROM artwork 
    WHERE tags LIKE '%city%' OR tags LIKE '%province%' OR tags LIKE '%country%'
  `).all();

  for (const artwork of artworks.results) {
    const tags = JSON.parse(artwork.tags);
    const updatedTags = applyCategoryMigration(tags);
    
    await db.prepare(`
      UPDATE artwork SET tags = ? WHERE id = ?
    `).bind(JSON.stringify(updatedTags), artwork.id).run();
  }
}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Tags appear in "Other" category

**Symptoms**: Tags that should be categorized appear under "Other"

**Diagnosis**:
```typescript
// Check if tag definition exists
const definition = getTagDefinition('city');
console.log('Definition found:', definition);

// Check categorization result
const result = categorizeTagsForDisplay({ city: 'vancouver' });
console.log('Categorization result:', result);
```

**Solutions**:
- Verify tag exists in backend schema (`src/shared/tag-schema.ts`)
- Check category assignment in tag definition
- Ensure frontend schema includes the tag

#### 2. Frontend shows outdated categorization

**Symptoms**: Frontend UI shows old categories after schema update

**Diagnosis**:
- Check browser cache (hard refresh)
- Verify frontend build and deployment
- Check API response includes `tags_categorized`

**Solutions**:
```powershell
# Clear build cache and rebuild
npm run clean
npm run build
npm run deploy:frontend

# Force browser cache refresh
# Ctrl+F5 in browser
```

#### 3. Backend categorization not working

**Symptoms**: API doesn't include `tags_categorized` field

**Diagnosis**:
```typescript
// Check if function is called in discovery.ts
const categorizedTags = categorizeTagsForDisplay(tagsParsed);
console.log('Categorized tags:', categorizedTags);
```

**Solutions**:
- Verify `categorizeTagsForDisplay()` function is imported and called
- Check backend deployment completed successfully
- Verify no JavaScript errors in worker logs

#### 4. Schema validation errors

**Symptoms**: Tag updates fail with validation errors

**Diagnosis**:
```typescript
// Test validation directly
const result = validateTagValue('city', 'vancouver');
console.log('Validation result:', result);
```

**Solutions**:
- Check validation rules in tag definition
- Verify enum values match exactly
- Ensure required fields are provided

### Debugging Workflow

1. **Identify Issue Scope**:
   - Frontend only: Check browser cache, frontend schema
   - Backend only: Check API response, backend schema
   - Both: Check deployment, network issues

2. **Check Schemas**:
   - Backend: `src/shared/tag-schema.ts`
   - Frontend: `src/frontend/src/services/tagSchema.ts`
   - Verify tag definitions exist and categories match

3. **Verify Deployments**:
   ```powershell
   # Check last deployment status
   npm run deploy:workers
   npm run deploy:frontend
   ```

4. **Test Incrementally**:
   - Test backend categorization function
   - Test API response structure
   - Test frontend component rendering

5. **Use Browser Dev Tools**:
   - Network tab: Check API responses
   - Console: Check JavaScript errors
   - Elements: Inspect rendered DOM structure

## Best Practices

### Development Workflow

1. **Schema Changes**:
   - Always update both backend and frontend schemas
   - Test categorization logic thoroughly
   - Document changes in this guide

2. **Deployment Strategy**:
   - Deploy backend first (API compatibility)
   - Deploy frontend second (UI updates)
   - Test end-to-end after both deployments

3. **Version Control**:
   - Use semantic versioning for schema changes
   - Document breaking changes clearly
   - Provide migration paths for existing data

### Code Quality

1. **Consistency**:
   - Use same naming conventions across schemas
   - Maintain consistent validation rules
   - Follow established patterns for new tags

2. **Documentation**:
   - Update this guide for significant changes
   - Document OSM compatibility for new tags
   - Provide clear examples and usage guidelines

3. **Testing**:
   - Write tests for new tag definitions
   - Test categorization logic changes
   - Verify UI rendering with updated schemas

### Performance

1. **Minimize Schema Size**:
   - Only include essential tags in core schema
   - Use extensions for specialized tags
   - Optimize enum value lists

2. **Efficient Categorization**:
   - Cache category definitions
   - Minimize API response size
   - Use server-side categorization

3. **Database Optimization**:
   - Add indexes for frequently queried tags
   - Consider denormalization for critical fields
   - Monitor query performance

## Future Enhancements

### Planned Improvements

1. **Dynamic Categories**:
   - Runtime category registration
   - Plugin-based tag extensions
   - User-defined tag categories

2. **Enhanced Validation**:
   - Cross-field validation rules
   - Conditional required fields
   - Advanced data type support

3. **Internationalization**:
   - Multi-language tag labels
   - Localized validation messages
   - Regional tag variations

4. **Performance Optimization**:
   - Cached categorization results
   - Incremental schema loading
   - Optimized database queries

### Extension Points

The current architecture supports future extensions:

```typescript
// Example: Custom tag processor
interface TagProcessor {
  process(tags: StructuredTags): StructuredTags;
  validate(tags: StructuredTags): ValidationResult;
}

// Example: Dynamic category registration
interface CategoryExtension {
  key: string;
  definition: CategoryInfo;
  tags: TagDefinition[];
}
```

## Resources

### Documentation

- [Tag Schema Reference](./tag-schema.md) - Complete technical documentation
- [User Guide](./user-guide-tags.md) - User-facing documentation
- [API Documentation](./api.md) - API endpoint specifications
- [Database Schema](./database.md) - Database structure

### External Resources

- [OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Key:artwork_type) - OSM artwork tags
- [JSON Schema](https://json-schema.org/) - Validation patterns
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Type definitions

### Tools

- **Schema Validation**: Use TypeScript compiler for type checking
- **API Testing**: Use Playwright for end-to-end testing
- **Database Tools**: SQLite CLI for direct database inspection
- **Deployment**: Cloudflare Wrangler for worker deployment

---

For questions about tagging system development, please:
1. Check this guide and related documentation
2. Review existing test cases for patterns
3. Create GitHub issues for bugs or feature requests
4. Update this documentation when making significant changes