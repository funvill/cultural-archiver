# Tag Schema Reference

This document provides technical documentation for the Cultural Archiver structured tag schema. It serves as a reference for developers, contributors, and maintainers working with the tag system.

## Schema Overview

The Cultural Archiver uses a structured tag schema with version 1.0.0, consisting of 15 essential tags organized across 5 categories. The schema is implemented consistently across frontend and backend systems.

### Schema Structure

```json
{
  "version": "1.0.0",
  "lastModified": "2024-12-19T12:00:00.000Z", 
  "tags": {
    "tourism": "artwork",
    "artwork_type": "statue",
    "name": "Victory Angel",
    "artist_name": "Jane Doe",
    "material": "bronze",
    "height": 5.5,
    "condition": "excellent",
    "access": "yes",
    "year": "1995",
    "wikidata_id": "Q12345678"
  }
}
```

### Design Principles

1. **OpenStreetMap Compatibility**: Use standard OSM tags where possible
2. **Data Type Safety**: Enforce proper validation for each field type
3. **Extensibility**: Support schema versioning for future enhancements  
4. **Internationalization Ready**: UTF-8 support for global artwork names
5. **Minimal but Complete**: Essential tags only, avoiding bloat

## Tag Definitions

### Category: Artwork Classification

Essential identification and categorization information.

#### `tourism` (enum)
- **Type**: Enum (single value)
- **Required**: Recommended
- **Values**: `artwork`
- **Description**: OpenStreetMap tourism tag, always set to "artwork"
- **OSM Standard**: Yes
- **Example**: `"tourism": "artwork"`

#### `artwork_type` (enum)
- **Type**: Enum (single value)
- **Required**: Recommended  
- **Values**: `statue`, `mural`, `sculpture`, `installation`, `monument`, `graffiti`, `mosaic`, `relief`, `fountain`, `other`
- **Description**: Primary classification of the artwork type
- **OSM Standard**: Yes
- **Example**: `"artwork_type": "statue"`
- **Validation**: Must be one of the predefined values

#### `name` (text)
- **Type**: Text
- **Required**: Optional
- **Max Length**: 200 characters
- **Description**: Official name or title of the artwork
- **OSM Standard**: Yes
- **Example**: `"name": "Victory Angel"`
- **Guidelines**: Use official names; for unnamed works, use descriptive titles

#### `inscription` (text)
- **Type**: Text  
- **Required**: Optional
- **Max Length**: 500 characters
- **Description**: Text inscriptions, dedications, or plaques on the artwork
- **OSM Standard**: Yes
- **Example**: `"inscription": "Dedicated to the memory of fallen soldiers 1914-1918"`

### Category: Physical Properties

Material composition and physical characteristics.

#### `material` (enum)
- **Type**: Enum (single value)
- **Required**: Optional
- **Values**: `bronze`, `stone`, `metal`, `concrete`, `wood`, `paint`, `ceramic`, `glass`, `mixed`, `other`
- **Description**: Primary material composition
- **OSM Standard**: Yes
- **Example**: `"material": "bronze"`
- **Guidelines**: Choose primary material for mixed-media works

#### `height` (number)
- **Type**: Number (decimal)
- **Required**: Optional
- **Unit**: Meters
- **Range**: 0.1 - 500.0
- **Description**: Height of the artwork in meters
- **OSM Standard**: Yes
- **Example**: `"height": 5.5`
- **Guidelines**: Include pedestal if integral to the work

#### `width` (number)
- **Type**: Number (decimal)
- **Required**: Optional
- **Unit**: Meters  
- **Range**: 0.1 - 500.0
- **Description**: Width of the artwork in meters
- **OSM Standard**: Yes
- **Example**: `"width": 2.3`

#### `condition` (enum)
- **Type**: Enum (single value)
- **Required**: Optional
- **Values**: `excellent`, `good`, `fair`, `poor`, `damaged`
- **Description**: Current physical condition of the artwork
- **OSM Standard**: No (Cultural Archiver extension)
- **Example**: `"condition": "excellent"`

### Category: Historical Information

Creation and historical context.

#### `artist_name` (text)
- **Type**: Text
- **Required**: Optional
- **Max Length**: 200 characters
- **Description**: Name of the artist or creator
- **OSM Standard**: Yes
- **Example**: `"artist_name": "Jane Doe"`
- **Guidelines**: Use full names; "Unknown Artist" if unknown; "Various Artists" for collaborations

#### `year` (number)
- **Type**: Number (integer)
- **Required**: Optional
- **Range**: 1000 - 2025
- **Description**: Year of creation or installation
- **OSM Standard**: Yes (as start_date)
- **Example**: `"year": "1995"`
- **Format**: YYYY (four-digit year)
- **Guidelines**: Use completion/installation year

#### `heritage` (enum)
- **Type**: Enum (single value)
- **Required**: Optional
- **Values**: `world_heritage`, `national`, `regional`, `local`, `listed`, `none`
- **Description**: Heritage designation or protection status
- **OSM Standard**: Partially (heritage tag)
- **Example**: `"heritage": "national"`

### Category: Location Details

Geographic and access information.

#### `city` (text)
- **Type**: Text
- **Required**: Optional
- **Max Length**: 100 characters
- **Description**: City where the artwork is located
- **OSM Standard**: Yes (as addr:city)
- **Example**: `"city": "vancouver"`
- **Category**: location_details

#### `province` (text)
- **Type**: Text
- **Required**: Optional
- **Max Length**: 100 characters
- **Description**: Province, state, or region where the artwork is located
- **OSM Standard**: Yes (as addr:state)
- **Example**: `"province": "british_columbia"`
- **Category**: location_details

#### `country` (text)
- **Type**: Text
- **Required**: Optional
- **Max Length**: 100 characters
- **Description**: Country where the artwork is located
- **OSM Standard**: Yes (as addr:country)
- **Example**: `"country": "canada"`
- **Category**: location_details

#### `access` (enum)
- **Type**: Enum (single value)  
- **Required**: Optional
- **Values**: `yes`, `no`, `restricted`, `private`, `seasonal`
- **Description**: Public accessibility of the artwork
- **OSM Standard**: Yes
- **Example**: `"access": "yes"`
- **Guidelines**: `yes` = freely accessible to public; `no` = not accessible

#### `operator` (text)
- **Type**: Text
- **Required**: Optional
- **Max Length**: 200 characters
- **Description**: Organization or entity responsible for the artwork
- **OSM Standard**: Yes
- **Example**: `"operator": "City of Vancouver"`

### Category: Reference Data

External links and identifiers.

#### `website` (url)
- **Type**: URL
- **Required**: Optional
- **Description**: Official website or detailed information page
- **OSM Standard**: Yes
- **Example**: `"website": "https://example.com/victory-angel"`
- **Validation**: Must be valid HTTP/HTTPS URL

#### `wikidata_id` (wikidata_id)
- **Type**: Wikidata identifier
- **Required**: Optional
- **Format**: Q followed by digits (e.g., Q12345678)
- **Description**: Wikidata entity identifier
- **OSM Standard**: Yes
- **Example**: `"wikidata_id": "Q12345678"`
- **Validation**: Must match pattern `/^Q\d+$/`

## Data Types and Validation

### Enum Types

**Definition**: Predefined list of allowed values with strict validation.

```typescript
type ArtworkType = 'statue' | 'mural' | 'sculpture' | 'installation' | 
                   'monument' | 'graffiti' | 'mosaic' | 'relief' | 
                   'fountain' | 'other';
```

**Validation Rules**:
- Case-insensitive matching during input
- Stored in lowercase
- Must match exactly one predefined value
- No custom values allowed

### Text Types

**Definition**: Free-form text with length restrictions.

```typescript
interface TextField {
  maxLength: number;
  required: boolean;
  sanitization: 'basic' | 'html' | 'none';
}
```

**Validation Rules**:
- UTF-8 encoding supported
- HTML tags stripped (basic sanitization)
- Trailing/leading whitespace trimmed
- Empty strings treated as undefined

### Number Types

**Definition**: Numeric values with range validation.

```typescript
interface NumberField {
  type: 'integer' | 'decimal';
  min?: number;
  max?: number;
  precision?: number; // for decimals
}
```

**Validation Rules**:
- Must be valid number format
- Range checking enforced
- Decimals rounded to specified precision
- Negative values rejected for physical measurements

### URL Types

**Definition**: Valid HTTP/HTTPS URLs.

```typescript
interface URLField {
  protocols: ['http', 'https'];
  maxLength: 500;
}
```

**Validation Rules**:
- Must include protocol (http:// or https://)
- Domain must be accessible (optional check)
- No malformed URLs accepted
- Maximum length enforced

### Wikidata ID Types

**Definition**: Wikidata entity identifiers.

```typescript
interface WikidataField {
  pattern: RegExp; // /^Q\d+$/
  apiValidation: boolean; // optional API check
}
```

**Validation Rules**:
- Must start with 'Q' followed by digits only
- Case sensitive (uppercase Q required)
- Optional API validation against Wikidata
- No other identifier formats accepted

## Schema Implementation

### Frontend (TypeScript)

Located in `src/frontend/src/services/tagSchema.ts`:

```typescript
export interface TagDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  dataType: 'enum' | 'text' | 'number' | 'date' | 'yes_no' | 'url' | 'wikidata_id';
  required?: boolean;
  enumValues?: string[];
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  helpUrl?: string;
}
```

**Functions**:
- `getTagDefinition(key: string): TagDefinition | undefined`
- `validateTagValue(key: string, value: string): ValidationResult`
- `formatTagValueForDisplay(key: string, value: string): string`
- `getTagsByCategory(categoryKey: string): TagDefinition[]`

### Backend (TypeScript)

Located in `src/workers/lib/tag-validation.ts`:

```typescript
export interface TagValidationError {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface TagValidationResult {
  valid: boolean;
  errors: TagValidationError[];
  warnings: TagValidationError[];
  sanitized?: StructuredTags;
}
```

**Functions**:
- `validateStructuredTags(tags: any): TagValidationResult`
- `sanitizeTagValue(key: string, value: any): any`
- `getTagValidationSchema(): TagSchema`

### Database Storage

Tags are stored as JSON in the `artwork.tags` column:

```sql
CREATE TABLE artwork (
  id TEXT PRIMARY KEY,
  -- other columns
  tags TEXT, -- JSON string containing structured tags
  CONSTRAINT artwork_tags_valid_json CHECK (json_valid(tags) OR tags IS NULL)
);

-- Indexes for common tag-based queries  
CREATE INDEX idx_artwork_tags_type ON artwork(json_extract(tags, '$.tags.artwork_type'));
CREATE INDEX idx_artwork_tags_material ON artwork(json_extract(tags, '$.tags.material'));
CREATE INDEX idx_artwork_tags_artist ON artwork(json_extract(tags, '$.tags.artist_name'));
```

## Migration and Compatibility

### Legacy Tag Migration

Existing unstructured tags are automatically migrated using mapping rules:

```typescript
const LEGACY_MAPPING: Record<string, string> = {
  'type': 'artwork_type',
  'artist': 'artist_name', 
  'material': 'material',
  'height': 'height',
  'width': 'width',
  'condition': 'condition',
  'year': 'year',
  'created': 'year',
  'access': 'access',
  'website': 'website',
  'wikidata': 'wikidata_id'
};
```

**Migration Process**:
1. Parse existing JSON tags
2. Apply mapping rules where possible
3. Validate migrated values against schema
4. Preserve unmappable data in legacy format
5. Flag for manual review if validation fails

### Version Compatibility

The schema includes versioning for backward compatibility:

```typescript
interface TaggedArtwork {
  version: string;           // "1.0.0"
  lastModified: string;     // ISO 8601 timestamp
  tags: StructuredTags;     // Current schema tags
  legacy?: any;             // Preserved legacy data
}
```

**Version Handling**:
- **v1.0.0**: Current schema with 15 core tags
- **Future versions**: Additive changes only (new tags, not breaking changes)
- **Backward compatibility**: Older versions remain readable
- **Migration path**: Clear upgrade procedures for each version

## OpenStreetMap Export Mapping

### Standard OSM Tags

Tags that map directly to OpenStreetMap standards:

| Cultural Archiver | OpenStreetMap | Notes |
|-------------------|---------------|--------|
| `tourism` | `tourism` | Always "artwork" |
| `artwork_type` | `artwork_type` | Direct mapping |
| `name` | `name` | Direct mapping |
| `artist_name` | `artist_name` | Direct mapping |
| `material` | `material` | Direct mapping |
| `height` | `height` | Converted to string with unit |
| `width` | `width` | Converted to string with unit |
| `inscription` | `inscription` | Direct mapping |
| `year` | `start_date` | Formatted as YYYY |
| `access` | `access` | Direct mapping |
| `operator` | `operator` | Direct mapping |
| `website` | `website` | Direct mapping |
| `wikidata_id` | `wikidata` | Direct mapping |

### Cultural Archiver Extensions

Custom tags prefixed with `ca:` for OSM export:

| Cultural Archiver | OpenStreetMap Export | Purpose |
|-------------------|---------------------|---------|
| `condition` | `ca:condition` | Cultural Archiver specific |
| `heritage` | `ca:heritage` | Until OSM standardizes |
| (artwork_id) | `ca:artwork_id` | Internal reference |
| (source) | `ca:source` | Attribution |

### Export Format Examples

**JSON Export**:
```json
{
  "id": "artwork-123",
  "lat": 49.2827,
  "lon": -123.1207,
  "osm_tags": {
    "tourism": "artwork",
    "artwork_type": "statue",
    "name": "Victory Angel",
    "artist_name": "Jane Doe",
    "material": "bronze",
    "height": "5.5",
    "access": "yes",
    "start_date": "1995",
    "ca:artwork_id": "artwork-123",
    "ca:condition": "excellent",
    "ca:source": "Cultural Archiver"
  }
}
```

**OSM XML Export**:
```xml
<node id="-1" lat="49.2827" lon="-123.1207">
  <tag k="tourism" v="artwork"/>
  <tag k="artwork_type" v="statue"/>
  <tag k="name" v="Victory Angel"/>
  <tag k="artist_name" v="Jane Doe"/>
  <tag k="material" v="bronze"/>
  <tag k="height" v="5.5"/>
  <tag k="access" v="yes"/>
  <tag k="start_date" v="1995"/>
  <tag k="ca:artwork_id" v="artwork-123"/>
  <tag k="ca:condition" v="excellent"/>
  <tag k="ca:source" v="Cultural Archiver"/>
</node>
```

## Error Handling and Validation

### Validation Error Codes

**Field-Level Errors**:
- `REQUIRED_FIELD`: Missing required field
- `INVALID_ENUM`: Value not in allowed enum list
- `INVALID_NUMBER`: Not a valid number or outside range
- `INVALID_URL`: Malformed URL
- `INVALID_WIKIDATA_ID`: Incorrect Wikidata ID format
- `TEXT_TOO_LONG`: Exceeds maximum length
- `INVALID_DATE`: Invalid date format

**Schema-Level Errors**:
- `SCHEMA_VERSION_UNSUPPORTED`: Unknown schema version
- `MALFORMED_TAGS`: Invalid JSON structure
- `BREAKING_CHANGE`: Modification would break core identification

### Error Message Templates

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  REQUIRED_FIELD: "This field is required",
  INVALID_ENUM: "Must be one of: {allowedValues}",
  INVALID_NUMBER: "Must be a number between {min} and {max}",
  INVALID_URL: "Must be a valid HTTP or HTTPS URL",
  INVALID_WIKIDATA_ID: "Must be in format Q12345678 (Q followed by numbers)",
  TEXT_TOO_LONG: "Must be {maxLength} characters or less",
  INVALID_YEAR: "Must be a valid year between 1000 and 2025"
};
```

### Warning Conditions

**Data Quality Warnings** (allowed but flagged):
- Very large dimensions (>50m height or width)
- Very old dates (<1500)
- Generic names ("Statue", "Sculpture")
- Missing recommended tags for artwork type
- Unusual material combinations

**Validation Warnings**:
```typescript
interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
  severity: 'low' | 'medium' | 'high';
}
```

## Development Guidelines

### Adding New Tags

**Process for Schema Extensions**:
1. **Research**: Verify need and OSM compatibility
2. **Design**: Define data type, validation rules, category
3. **Implementation**: Add to both frontend and backend schema
4. **Migration**: Create migration path from existing data
5. **Documentation**: Update all relevant documentation
6. **Testing**: Comprehensive validation and export tests

**Schema Definition Template**:
```typescript
const newTagDefinition: TagDefinition = {
  key: 'new_field',
  label: 'New Field',
  description: 'Description of the new field',
  category: 'physical_properties', // or appropriate category
  dataType: 'text', // or appropriate type
  required: false,
  maxLength: 200, // if text type
  helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:new_field'
};
```

### Testing Guidelines

**Unit Tests Required**:
- Validation logic for each data type
- Migration from legacy formats
- Export format generation
- Error handling and edge cases

**Integration Tests Required**:
- End-to-end tag editing workflow
- Search functionality with new tags
- OSM export with all tag types
- Database migration procedures

**Test Data Requirements**:
- Valid examples for each tag type
- Invalid examples for validation testing
- Edge cases (boundaries, special characters)
- Legacy data samples for migration testing

## Performance Considerations

### Database Optimization

**JSON Query Performance**:
- Use functional indexes on frequently queried tags
- Consider denormalization for critical search fields
- Monitor query performance on large datasets

```sql
-- Optimized indexes for common queries
CREATE INDEX idx_artwork_searchable_name ON artwork(
  lower(json_extract(tags, '$.tags.name'))
) WHERE json_extract(tags, '$.tags.name') IS NOT NULL;

CREATE INDEX idx_artwork_year_range ON artwork(
  CAST(json_extract(tags, '$.tags.year') AS INTEGER)
) WHERE json_extract(tags, '$.tags.year') IS NOT NULL;
```

### Frontend Performance

**Tag Editor Optimization**:
- Lazy load enum values
- Debounce validation calls
- Cache schema definitions
- Minimize DOM updates during typing

### API Performance

**Bulk Operations**:
- Batch tag validation requests
- Implement efficient migration procedures
- Cache validation schemas
- Use appropriate HTTP caching headers

## Security Considerations

### Input Sanitization

**XSS Prevention**:
- HTML tags stripped from text fields
- URL validation prevents javascript: schemes
- Proper escaping in templates

**SQL Injection Prevention**:
- Parameterized queries for JSON extraction
- Whitelist validation for tag keys
- No dynamic query construction

### Data Privacy

**Personal Information**:
- No personal identifiers in tags
- Artist names are public information only
- Location data limited to artwork coordinates

**Access Control**:
- Tag editing requires authentication
- Moderation permissions for sensitive changes
- Audit logging for all tag modifications

## Future Enhancements

### Planned Features

**Schema v1.1** (Future):
- Additional physical property tags (depth, weight)
- Extended heritage classification system
- Multi-language name support
- Creator/commissioner distinction

**Schema v2.0** (Long-term):
- Hierarchical tag categories
- Custom field definitions per installation
- Advanced validation rules (cross-field dependencies)
- Semantic linking to external databases

### Extensibility Hooks

The schema is designed for extension:

```typescript
// Reserved namespaces for future use
namespace CustomTags {
  interface ExtendedPhysicalProperties {
    depth?: number;
    weight?: number;
    volume?: number;
  }
  
  interface MultilingualNames {
    'name:en'?: string;
    'name:fr'?: string;
    'name:es'?: string;
  }
}
```

## Support and Contributing

### Documentation Updates

When modifying the schema:
1. Update this reference document
2. Update user guide with examples
3. Update API documentation
4. Update migration procedures
5. Update test cases and examples

### Reporting Issues

**Schema Issues**:
- Missing essential tag types
- Validation too restrictive/permissive
- OSM compatibility problems
- Performance issues with queries

**Contribution Process**:
1. Open GitHub issue with detailed description
2. Discuss impact on existing data
3. Create pull request with implementation
4. Update documentation and tests
5. Review and merge process

For questions about the tag schema, please refer to the user guide (`docs/user-guide-tags.md`) or create an issue in the GitHub repository.