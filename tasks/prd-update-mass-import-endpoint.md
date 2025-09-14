# PRD: Update Mass Import Endpoint with New Database Schema

## Executive Summary

This PRD outlines the complete rewrite of the mass import endpoint to integrate with the updated database schema (unified submissions system) and the new mass-import CLI plugin system. The endpoint will support importing both artworks and artists with sophisticated deduplication, automatic approval, and seamless integration with the modular plugin architecture.

## Problem Statement

The current mass import endpoint (`/api/mass-import`) is incompatible with the updated database schema that has transitioned from separate logbook/artwork_edits tables to a unified submissions system. Additionally, it lacks support for artist imports and doesn't integrate with the new mass-import CLI plugin system that provides a modular, extensible architecture for data imports.

## Goals

### Primary Goals

1. **Schema Compatibility**: Implement full compatibility with the new unified submissions database schema
2. **Dual Import Support**: Enable import of both artwork and artist records through a single endpoint
3. **Advanced Deduplication**: Implement sophisticated duplicate detection with configurable scoring algorithms
4. **CLI Integration**: Seamlessly integrate with the mass-import CLI plugin system for data processing
5. **Automatic Approval**: Auto-approve mass-imported content while maintaining audit trails

### Secondary Goals

1. **Performance Optimization**: Process large datasets efficiently with batch processing
2. **Error Resilience**: Graceful handling of failures with detailed error reporting
3. **Audit Compliance**: Comprehensive logging and tracking of all import operations
4. **Tag Enhancement**: Merge new tags with existing content when duplicates are found

### Success Criteria

- Zero duplicate artworks/artists created during mass import operations
- Support for importing up to 1,000 records efficiently
- Full integration with mass-import CLI plugin outputs
- 100% compatibility with new submissions table schema
- Automatic artist page creation when artwork references unknown artists

## Technical Requirements

### 1. Database Schema Integration

#### Submissions Table Usage

The endpoint will utilize the new `submissions` table with the following submission types:

- `new_artwork`: For new artwork imports
- `new_artist`: For new artist imports

**Key Schema Features:**
- All imports are auto-approved (`status: 'approved'`)
- Uses a default system user token for mass imports
- Stores original plugin data in `old_data` field for traceability
- Tracks importer source in tags

#### Default User Configuration

```typescript
interface MassImportConfig {
  defaultUserToken: string; // UUID for mass import system user
  autoApprove: boolean; // Always true for mass imports
  requireConsent: boolean; // False for mass imports (system content)
}
```

### 2. CLI Plugin System Integration

#### Data Flow Architecture

```
CLI Plugin System → API Endpoint → Database
     ↓               ↓              ↓
[Data Processing] → [Validation] → [Storage]
[Deduplication]   → [Import]     → [Audit]
```

#### Input Format Compatibility

The endpoint will accept the `RawImportData` format from the CLI system. The final request to the endpoint will be structured as `MassImportRequestV2`.

```typescript
export const RawImportDataSchema = z.object({
  // Core location and identification
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  
  // Artist and creation info
  artist: z.string().max(500).optional(),
  created_by: z.string().max(500).optional(),
  yearOfInstallation: z.string().optional(),
  
  // Physical properties
  material: z.string().max(200).optional(),
  type: z.string().max(100).optional(),
  
  // Location details
  address: z.string().max(500).optional(),
  neighborhood: z.string().max(200).optional(),
  siteName: z.string().max(300).optional(),
  
  // Photos
  photos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().optional(),
    credit: z.string().optional(),
    filename: z.string().optional(),
  })).optional(),
  primaryPhotoUrl: z.string().url().optional(),
  
  // Attribution and tracking
  source: z.string().max(100), // Required: data source identifier
  sourceUrl: z.string().url().optional(),
  externalId: z.string().max(200).optional(),
  license: z.string().max(200).optional(),
  
  // Additional metadata
  tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  status: z.enum(['active', 'inactive', 'removed', 'unknown']).optional(),
});

export type RawImportData = z.infer<typeof RawImportDataSchema>;
```

### 3. Advanced Deduplication System

#### Multi-Entity Deduplication

**Artwork Deduplication Scoring:**
- **GPS Location**: 0.6 points (primary indicator, distance-weighted within 100m)
- **Title Match**: 0.25 points (Levenshtein distance with normalization)
- **Artist Match**: 0.2 points (fuzzy match against artist names)
- **Reference IDs**: 0.5 points (external_id, registry_id matches)
- **Tag Similarity**: 0.05 points (matching structured tags)

*Note: The above weights are the default. The API will accept weight overrides in the `config` object to allow for flexible, per-import tuning.*

**Artist Deduplication Scoring:**
- **Name Match**: 0.5 points (primary indicator with fuzzy matching)
- **Website Match**: 0.2 points (exact URL match)
- **Bio Similarity**: 0.15 points (text similarity analysis)
- **Reference IDs**: 0.5 points (external identifiers)
- **Location Tags**: 0.05 points (location-based artist tags)

#### Intelligent Duplicate Handling

**When Duplicates Detected:**
1. Skip import of duplicate entity
2. Merge new tags with existing entity tags
3. Log merge operation in audit trail
4. Return existing entity ID in response

**Tag Merging Logic:**
- Add new tags that don't exist in existing entity
- If a tag with the same label exists, keep the original tag's value and discard the new one, preserving the earliest data.
- Update tag values only if existing value is empty/null
- Preserve original tag creation metadata
- Log all tag changes for audit

### 4. Artist Auto-Creation System

#### Workflow for Unknown Artists

When an artwork references an artist not found in the database (and `createMissingArtists: true` is set):

1. **Artist Detection**: Extract artist names from artwork data. For each name:
2. **Fuzzy Search**: Search existing artists. If a name has a strong match (>95% similarity), link to the existing artist.
3. **Auto-Creation**: If no strong match is found, create a new, separate artist record.
4. **Linking**: Associate the artwork with the new or found artist ID(s) via a dedicated linking table (`artwork_artists`).
5. **Audit Trail**: Log the artist creation or linking decision and its source.

#### Artwork-Artist Linking Table

A new table, `artwork_artists`, will be created to manage the many-to-many relationship between artworks and artists.

```sql
CREATE TABLE artwork_artists (
  artwork_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  role TEXT, -- e.g., 'primary', 'contributor'
  PRIMARY KEY (artwork_id, artist_id),
  FOREIGN KEY (artwork_id) REFERENCES artworks(id),
  FOREIGN KEY (artist_id) REFERENCES artists(id)
);
```

#### Artist Record Structure

```typescript
interface AutoCreatedArtist {
  id: string; // UUID
  name: string; // From artwork artist_names
  bio: null; // Will be filled by future edits
  tags: {
    source: string; // "mass-import-auto-created"
    original_artwork_id: string; // The first artwork that triggered creation
    created_reason: "referenced_in_artwork";
    website?: string; // Artist website stored as tag
  };
  status: "approved";
  created_at: string;
  updated_at: string;
}
```

### 5. API Endpoint Specification

#### Endpoint Definition

```http
POST /api/mass-import
Content-Type: application/json
Authorization: Bearer {admin_token}
```

#### Request Format

```typescript
interface MassImportRequestV2 {
  metadata: {
    importId: string; // UUID for tracking this import batch
    source: {
      pluginName: string;
      pluginVersion?: string;
      originalDataSource: string; // e.g., "vancouver-open-data"
    };
    timestamp: string; // ISO 8601 timestamp
  };
  config: {
    duplicateThreshold: number; // Default: 0.7
    enableTagMerging: boolean; // Default: true
    createMissingArtists: boolean; // Default: true
    batchSize: number; // Default: 10, max: 10
  };
  data: {
    artworks?: Array<RawImportData>;
    artists?: Array<RawImportData>;
  };
}
```

#### Response Format

- **Status Code**: On successful completion of the entire batch, the API will return a `201 Created` status code, even if some individual records failed or were duplicates. The detailed breakdown will be in the response body. For catastrophic failures (e.g., auth error, invalid top-level structure), a `4xx` or `5xx` code will be returned.

The response body will be a JSON object with the following structure:

```typescript
interface MassImportResponseV2 {
  importId: string;
  summary: {
    totalRequested: number;
    totalProcessed: number;
    totalSucceeded: number;
    totalFailed: number;
    totalDuplicates: number;
    processingTimeMs: number;
  };
  results: {
    artworks: {
      created: Array<{ 
        id: string; // UUID of created artwork
        title: string; 
        submissionId: string;
      }>;
      duplicates: Array<{
        title: string;
        existingId: string;
        confidenceScore: number;
        scoreBreakdown: DuplicationScore;
        error: "DUPLICATE_DETECTED";
      }>;
      failed: Array<{
        title: string;
        error: string;
        validationErrors?: ValidationError[];
      }>;
    };
    artists: {
      created: Array<{ 
        id: string; // UUID of created artist
        name: string; 
        submissionId: string;
      }>;
      autoCreated: Array<{
        id: string; // UUID of auto-created artist
        name: string;
        reason: string;
        sourceArtworkId: string;
      }>;
      duplicates: Array<{
        name: string;
        existingId: string;
        confidenceScore: number;
        error: "DUPLICATE_DETECTED";
      }>;
      failed: Array<{
        name: string;
        error: string;
      }>;
    };
  };
  auditTrail: {
    importStarted: string;
    importCompleted: string;
    batchesProcessed: number;
    tagsMerged: number;
    photosDownloaded: number;
    photosUploaded: number;
    systemUserToken: string;
  };
}

interface DuplicationScore {
  gps: number;
  title: number;
  artist: number;
  referenceIds: number;
  tagSimilarity: number;
  total: number;
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### 6. Security and Authorization

#### Authentication Requirements

- **Admin/Moderator Only**: Only users with admin or moderator roles can access mass import
- **Internal Use Only**: Endpoint designed for internal developers only
- **No Rate Limiting**: No rate limits applied for internal development usage
- **Request Size Limits**: Maximum 10MB request body, 1000 entities per request (but batch sizes expected to be <10)

#### Data Validation

- **Strict Schema Validation**: All input data validated against TypeScript schemas
- **Coordinate Validation**: GPS coordinates within valid ranges (-90/90, -180/180)
- **Content Sanitization**: HTML sanitization for text fields
- **Photo Processing**: For each artwork, photo URLs will be downloaded. A standard 800px thumbnail will be generated, and both the original image and the thumbnail will be uploaded to the R2 storage bucket. The database will store references to both images.

### 7. Performance Requirements

#### Processing Specifications

- **Batch Processing**: Process imports in small batch sizes (default: 10, max: 10)
- **Memory Management**: Optimized for smaller datasets (up to 1,000 records)
- **Database Optimization**: Use database transactions for consistency
- **Timeout Handling**: 1-minute maximum processing time per import. The CLI tool is responsible for handling timeouts and splitting batches if necessary.
- **Photo Processing**: Automatic download of images from URLs, generation of an 800px thumbnail, and upload of both original and thumbnail to the R2 bucket.

#### Monitoring and Metrics

- **Processing Time Tracking**: Detailed timing for each processing phase
- **Success/Failure Rates**: Track import success rates by plugin and data source
- **Duplicate Detection Metrics**: Track deduplication effectiveness
- **Database Performance**: Monitor query performance and optimization needs

### 8. Error Handling and Recovery

#### Graceful Failure Handling

- **Individual Record Failures**: Continue processing batch even if individual records fail
- **Validation Errors**: Detailed error messages with field-level specificity
- **Database Failures**: Rollback transactions and provide recovery options
- **Network Failures**: Retry logic for photo downloads and external API calls

#### Error Response Format

```typescript
interface ImportError {
  recordIndex: number;
  recordType: 'artwork' | 'artist';
  recordTitle: string;
  errorType: 'validation' | 'duplicate' | 'database' | 'network';
  errorMessage: string;
  validationErrors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  suggestedFix?: string;
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

- Remove existing mass-import endpoint code
- Implement new submissions table integration
- Create basic authentication and validation framework
- Set up request/response schemas

### Phase 2: Deduplication Engine (Week 3-4)

- Implement artwork deduplication algorithm
- Implement artist deduplication algorithm
- Create tag merging system
- Add comprehensive testing for duplicate detection

### Phase 3: CLI Integration (Week 5-6)

- Integrate with mass-import CLI plugin system
- Implement `RawImportData` format compatibility
- Add plugin metadata tracking
- Create end-to-end testing with actual plugins

### Phase 4: Artist Auto-Creation (Week 7-8)

- Implement artist auto-creation workflow
- Add artist linking system
- Create artist fuzzy matching algorithms
- Add audit trails for auto-created entities

### Phase 5: Performance & Production (Week 9-10)

- Optimize database queries and batch processing
- Add comprehensive monitoring and metrics
- Implement rate limiting and security measures
- Production deployment and documentation

## Testing Strategy

### Unit Testing

- Individual deduplication algorithms
- Tag merging logic
- Artist auto-creation workflows
- Request/response validation

### Integration Testing

- End-to-end import workflows
- CLI plugin integration
- Database transaction handling
- Error recovery scenarios

### Performance Testing

- Dataset imports (up to 1,000 records)
- Small batch processing (batches of 10)
- Memory usage optimization for smaller datasets
- Database performance under load
- Photo download and R2 upload performance

### Security Testing

- Authentication and authorization
- Input validation and sanitization
- Rate limiting effectiveness
- SQL injection prevention

## Migration and Rollback

Since this is a pre-release development system, there is no need for backward compatibility or complex migration strategies. The existing mass import endpoint will be completely replaced with the new implementation.

### Development Strategy

1. Remove existing mass import endpoint completely
2. Implement new endpoint with updated schema compatibility
3. Update mass-import CLI system as needed for seamless integration
4. Test thoroughly with development database

### Rollback Plan

- Git version control for quick rollback if needed
- Development database can be reset if data corruption occurs
- No production considerations needed in pre-release phase

## Success Metrics

### Functional Metrics

- **Zero Duplicates**: No duplicate entities created during imports
- **Import Success Rate**: >95% successful import rate
- **Artist Auto-Creation Accuracy**: >90% correct artist associations
- **Tag Merge Accuracy**: >99% successful tag merges without conflicts

### Performance Metrics

- **Processing Speed**: <10 seconds per 100 records
- **Memory Usage**: <100MB for 1,000 record imports (optimized for smaller datasets)
- **Database Performance**: <1 second average query time
- **API Response Time**: <5 seconds for typical 10-record imports
- **Photo Processing**: <2 seconds per photo download and R2 upload

### Quality Metrics

- **Code Coverage**: >90% test coverage
- **Documentation Completeness**: 100% API documentation
- **Error Rate**: <1% unhandled errors
- **User Satisfaction**: Positive feedback from internal developers

## Risks and Mitigation

### Technical Risks

1. **Photo Processing Failures**: Issues downloading or uploading photos to R2
   - *Mitigation*: Implement retry logic and graceful failure handling for photo operations
2. **Data Corruption**: Duplicate detection errors causing data loss
   - *Mitigation*: Comprehensive testing and rollback procedures
3. **CLI Plugin Compatibility**: Breaking changes between CLI and API systems
   - *Mitigation*: Coordinate development of both systems, shared type definitions

### Operational Risks

1. **Development Coordination**: Coordinating changes between CLI and API systems
   - *Mitigation*: Shared development timeline and regular integration testing
2. **R2 Storage Costs**: Photo uploads increasing storage costs unexpectedly
   - *Mitigation*: Monitor storage usage and implement photo optimization
3. **Small Batch Inefficiency**: Processing overhead for very small batches
   - *Mitigation*: Profile and optimize batch processing for small datasets

## Conclusion

This PRD provides a comprehensive plan for completely rewriting the mass import endpoint to support the new database schema and CLI plugin system. The focus on sophisticated deduplication, artist auto-creation, and seamless integration will create a robust foundation for importing cultural datasets while maintaining data integrity and providing excellent developer experience.

The streamlined approach for pre-release development ensures rapid iteration cycles while the comprehensive testing strategy guarantees reliability and performance. The new system will serve as the primary method for adding artwork and artist data to the Cultural Archiver platform.