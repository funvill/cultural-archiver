# User Guide: Structured Tag System

The Cultural Archiver uses a structured tag system to capture detailed metadata about public artworks. This guide explains how to use the tag system effectively as both a contributor and moderator.

## Overview

The structured tag system replaces the previous unstructured approach with 15 essential tags organized across 5 categories. This provides consistency, better search functionality, and enables data export to OpenStreetMap.

### Key Benefits

- **Consistent Data**: Predefined schema ensures uniform artwork descriptions
- **Enhanced Search**: Tag-based search like `tag:material:bronze` or `tag:artist_name:banksy`  
- **OpenStreetMap Export**: Direct integration with OSM using standard tags
- **Data Validation**: Real-time validation prevents errors and guides users

## Tag Categories

### 1. Artwork Classification
Essential identification and categorization tags.

- **`tourism`**: Always set to "artwork" for OpenStreetMap compatibility
- **`artwork_type`**: Type of artwork (statue, mural, sculpture, installation, monument, graffiti, mosaic, relief, fountain, other)
- **`name`**: Official name or title of the artwork
- **`inscription`**: Text inscriptions, dedications, or plaques

### 2. Physical Properties  
Material composition and dimensions.

- **`material`**: Primary material (bronze, stone, metal, concrete, wood, paint, ceramic, glass, mixed, other)
- **`height`**: Height in meters (e.g., 5.5)
- **`width`**: Width in meters (e.g., 2.3) 
- **`condition`**: Physical condition (excellent, good, fair, poor, damaged)

### 3. Historical Information
Creation and historical context.

- **`artist_name`**: Name of the artist or creator
- **`year`**: Year of creation (YYYY format, 1000-2025)
- **`heritage`**: Heritage designation (world_heritage, national, regional, local, listed, none)

### 4. Location Details
Access and ownership information.

- **`access`**: Public accessibility (yes, no, restricted, private, seasonal)
- **`operator`**: Managing organization or entity

### 5. Reference Data
External links and identifiers.

- **`website`**: Official website URL
- **`wikidata_id`**: Wikidata identifier (format: Q12345678)

## Using the Tag Editor

### For Contributors

When viewing an artwork, click the **"Edit Tags"** button to open the structured tag editor:

1. **Select Tag**: Choose from the dropdown of available tag keys
2. **Enter Value**: Input will adapt based on tag type:
   - **Dropdowns**: For predefined values (artwork_type, material, condition, etc.)
   - **Text Fields**: For names, descriptions, and URLs
   - **Number Fields**: For height, width, and year
3. **Validation**: Real-time validation shows errors and suggestions
4. **Save Changes**: Review and submit your updates

### Input Types

**Enum Fields** (Dropdowns):
- `artwork_type`: statue, mural, sculpture, installation, monument, graffiti, mosaic, relief, fountain, other
- `material`: bronze, stone, metal, concrete, wood, paint, ceramic, glass, mixed, other  
- `condition`: excellent, good, fair, poor, damaged
- `heritage`: world_heritage, national, regional, local, listed, none
- `access`: yes, no, restricted, private, seasonal

**Text Fields**:
- `name`: Artwork title (max 200 characters)
- `artist_name`: Artist name (max 200 characters)  
- `inscription`: Text content (max 500 characters)
- `operator`: Managing entity (max 200 characters)

**Number Fields**:
- `height`: Height in meters (0.1 - 500)
- `width`: Width in meters (0.1 - 500)
- `year`: Creation year (1000 - 2025)

**URL Fields**:
- `website`: Valid HTTP/HTTPS URL

**Special Fields**:
- `wikidata_id`: Must match pattern Q followed by numbers (e.g., Q12345678)

## Best Practices

### Essential Tags First
Focus on these core tags that provide the most value:

1. **`artwork_type`** - Critical for categorization
2. **`name`** - Essential for identification  
3. **`material`** - Important for search and context
4. **`condition`** - Helps with maintenance and documentation

### Data Quality Tips

**Names and Titles**:
- Use official names when available
- For unnamed works, use descriptive titles: "Bronze Warrior Statue"
- Avoid generic names like "Sculpture" - be specific

**Artist Names**:
- Use full names when known: "Pablo Picasso" not "Picasso"
- For multiple artists, list primary artist or use "Various Artists"
- Include "Unknown Artist" rather than leaving blank

**Materials**:
- Choose the primary material for mixed-media works
- Use "mixed" for complex combinations
- Be specific: "bronze" rather than "metal" when possible

**Dimensions**:
- Measure to the nearest half-meter for large works
- Include base/pedestal if integral to the piece
- Use meters (not feet/inches): 5.5 instead of 18 feet

**Years**:
- Use completion/installation year, not design year
- For ranges, use the latest year: 1995 for "1992-1995"
- Research dedication plaques for accurate dating

### Validation and Errors

The system provides real-time validation with helpful error messages:

**Common Validation Errors**:

```
Height must be a positive number
→ Fix: Enter a number like 5.5 (for 5.5 meters)

Invalid Wikidata ID format  
→ Fix: Use format Q12345678 (Q followed by numbers)

Year must be between 1000 and 2025
→ Fix: Enter a 4-digit year like 1995

URL must be a valid HTTP/HTTPS address
→ Fix: Use complete URL like https://example.com
```

**Warnings** (allowed but flagged):
- Very large dimensions (>50m height)
- Very old dates (<1500)
- Missing recommended tags for the artwork type

## Search Integration

### Tag-Based Search

The structured tags enable powerful search capabilities:

**Find by Type**:
```
tag:artwork_type:statue
tag:artwork_type:mural
```

**Find by Material**:
```
tag:material:bronze
tag:material:stone  
```

**Find by Artist**:
```
tag:artist_name:banksy
tag:artist_name:picasso
```

**Find by Era**:
```
tag:year:2020
tag:year:1995
```

**Combined Searches**:
```
bronze tag:year:1995           # Bronze artworks from 1995
tag:access:yes tag:condition:excellent  # Accessible art in excellent condition
mural tag:artist_name:banksy   # Banksy murals
```

### Search Tips

- **Use partial matches**: `tag:artist_name:van` finds "Vincent van Gogh"
- **Combine text and tags**: `fountain tag:material:stone` 
- **Case insensitive**: `BRONZE` same as `bronze`
- **Flexible matching**: `tag:material:bronz` will suggest `bronze`

## OpenStreetMap Integration

### Export Formats

Structured tags enable seamless OpenStreetMap integration:

**Standard OSM Tags**:
- `tourism=artwork` (always included)
- `artwork_type=statue`
- `name=Victory Angel`  
- `artist_name=Jane Doe`
- `material=bronze`
- `height=5.5`

**Cultural Archiver Tags** (prefixed with `ca:`):
- `ca:artwork_id=123` - Internal artwork ID
- `ca:source=Cultural Archiver` - Data source attribution  
- `ca:custom_field=value` - Non-standard fields

### OSM Compatibility

The tag schema follows OpenStreetMap conventions:

- Standard keys used where possible (`tourism`, `name`, `artist_name`)
- Values match OSM standards (`yes`/`no` for access)
- Custom fields prefixed with `ca:` to avoid conflicts
- Proper attribution and source tracking

## For Moderators

### Reviewing Tag Changes

The moderation interface displays tag changes in an organized format:

**Visual Indicators**:
- ➕ **Green**: Added tags  
- ➖ **Red**: Removed tags
- ✏️ **Blue**: Modified tags

**Category Organization**:
Changes are grouped by category for easy review:
- Artwork Classification changes first
- Physical Properties  
- Historical Information
- Location Details
- Reference Data last

### Validation During Review

**Required Validation Checks**:
1. **`artwork_type`** must be appropriate for the artwork
2. **Dimensions** should be reasonable (height <500m, width <500m)  
3. **Years** should match visible evidence or research
4. **URLs** must be accessible and relevant
5. **Wikidata IDs** should link to correct entities

**Common Review Issues**:

**Incorrect Classifications**:
- Murals tagged as "sculpture"  
- Installations tagged as "monument"
- → Check photos and descriptions to verify type

**Unrealistic Dimensions**:
- 50-meter tall statues (check if including building)
- Micro dimensions for large works
- → Cross-reference with photos and context

**Inaccurate Historical Data**:
- Modern works dated to historical periods
- Artists misattributed  
- → Verify against reliable sources

**Poor Data Quality**:
- Generic names like "Statue" 
- Inconsistent artist name formats
- → Provide specific, researched alternatives

### Bulk Corrections

For systematic issues across multiple artworks:

1. **Identify Pattern**: Common misspellings, incorrect classifications
2. **Document Changes**: Record rationale for bulk updates  
3. **Apply Consistently**: Use same values for same artists/materials
4. **Update Guidelines**: Add clarifications to prevent future issues

## Advanced Features

### Tag Schema Versioning

The tag schema includes versioning for future updates:

```json
{
  "version": "1.0.0",
  "lastModified": "2024-12-19T12:00:00.000Z",
  "tags": {
    "artwork_type": "statue",
    "name": "Victory Angel"
  }
}
```

**Version History**:
- **v1.0.0**: Initial structured tag schema with 15 core tags
- Future versions will add new tags while maintaining backward compatibility

### Data Migration

Existing unstructured tags are automatically migrated:

**Migration Process**:
1. Parse existing JSON tag data
2. Map to structured schema where possible
3. Preserve unmapped data in legacy format
4. Flag for manual review if needed

**Migration Examples**:
```
"material": "bronze" → tags.material = "bronze"
"artist": "Jane Doe" → tags.artist_name = "Jane Doe"  
"height": "5.5m" → tags.height = 5.5
```

### API Integration

Developers can interact with the tag system via API:

**Update Tags**:
```javascript
PUT /api/artworks/{id}/tags
{
  "tags": {
    "artwork_type": "statue",
    "material": "bronze",
    "height": 5.5
  }
}
```

**Validate Tags**:
```javascript
GET /api/artwork/{id}/export/osm?format=validation
```

**Export for OSM**:
```javascript
GET /api/export/osm?bounds=49.3,-123.1,49.2,-123.0
```

## Support and Resources

### Getting Help

**Documentation**:
- Tag schema reference: `/docs/tag-schema.md`  
- API documentation: `/docs/api.md`
- Contributor guidelines: `/CONTRIBUTING.md`

**Common Questions**:

**Q: What if I don't know the artist?**  
A: Use "Unknown Artist" rather than leaving blank - this indicates research was attempted.

**Q: How do I handle multiple artists?**  
A: List the primary artist, or use "Various Artists" for collaborations.

**Q: Should I include the pedestal in height measurements?**  
A: Yes, if the pedestal is integral to the artistic work.

**Q: What about temporary installations?**  
A: Tag them normally but note in the inscription if they're temporary.

**Q: How do I handle damaged/missing artworks?**  
A: Set condition to "damaged" and add details in inscription.

### Contributing Improvements

The tag system evolves based on community feedback:

**Suggest New Tags**: Open GitHub issues for missing tag types
**Report Validation Issues**: Help improve error messages and validation  
**Improve Documentation**: Submit PRs for clearer explanations
**Share Best Practices**: Document successful tagging workflows

## Conclusion

The structured tag system provides a powerful foundation for documenting public art with consistency and precision. By following these guidelines, contributors help build a comprehensive, searchable, and exportable database of cultural heritage.

Remember: **Good tags make artwork discoverable**. Take time to research and provide accurate, detailed information that helps others find and appreciate the art in their communities.