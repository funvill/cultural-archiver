# Plugin Templates and Development Tools

This directory contains templates and tools for rapid development of importer and exporter plugins for the Mass Import system.

## 📁 Directory Structure

```
templates/
├── importer/
│   └── importer-template.ts    # Template for creating new importer plugins
├── exporter/
│   └── exporter-template.ts    # Template for creating new exporter plugins
└── README.md                   # This file
```

## 🚀 Quick Start Guide

### Creating a New Importer Plugin

1. **Copy the template:**

   ```bash
   cp templates/importer/importer-template.ts src/importers/my-new-importer.ts
   ```

2. **Replace placeholders** in the copied file:
   - `{{PLUGIN_NAME}}` → Human-readable name (e.g., "Instagram Art Posts")
   - `{{PLUGIN_DESCRIPTION}}` → Brief description of what the plugin does
   - `{{DATA_SOURCE}}` → Where the data comes from (e.g., "Instagram API")
   - `{{SUPPORTED_FORMATS}}` → Comma-separated list (e.g., "json, csv")
   - `{{SUPPORTED_FORMATS_ARRAY}}` → TypeScript array (e.g., "'json', 'csv'")
   - `{{REQUIRED_FIELDS_ARRAY}}` → Required fields (e.g., "'id', 'coordinates'")
   - `{{OPTIONAL_FIELDS_ARRAY}}` → Optional fields (e.g., "'name', 'description'")
   - `{{AUTHOR_NAME}}` → Your name or organization
   - `{{PLUGIN_CLASS_NAME}}` → PascalCase class name (e.g., "InstagramArtImporter")
   - `{{PLUGIN_KEBAB_NAME}}` → kebab-case name (e.g., "instagram-art")
   - `{{PLUGIN_INSTANCE_NAME}}` → camelCase instance name (e.g., "instagramArtImporter")
   - `{{DATA_TYPE_NAME}}` → TypeScript interface name (e.g., "InstagramPost")

3. **Implement the core methods:**
   - `mapData()` - Transform source data to RawImportData format
   - `validateData()` - Validate source data structure
   - `generateImportId()` - Create unique IDs for records
   - Helper methods for field mapping and data transformation

4. **Create a configuration file:**

   ```bash
   cp configs/vancouver-public-art.json configs/my-new-importer.json
   ```

   Update the configuration to match your data source requirements.

5. **Register the plugin:** Add your plugin to `src/importers/index.ts`:

   ```typescript
   import { myNewImporter } from './my-new-importer.js';

   export function registerCoreImporters(registry: PluginRegistry): void {
     // ... existing registrations
     registry.registerImporter(myNewImporter);
   }
   ```

### Creating a New Exporter Plugin

1. **Copy the template:**

   ```bash
   cp templates/exporter/exporter-template.ts src/exporters/my-new-exporter.ts
   ```

2. **Replace placeholders** (similar to importer, plus):
   - `{{OUTPUT_FORMAT}}` → Output format description
   - `{{REQUIRES_NETWORK}}` → `true` or `false`
   - `{{OUTPUT_TYPE}}` → `'file'`, `'api'`, `'stream'`, or `'console'`

3. **Implement the core methods:**
   - `export()` - Process and export data to destination
   - `configure()` - Set up exporter with options
   - `validate()` - Validate exporter configuration
   - Helper methods for data transformation and output

4. **Register the plugin:** Add your plugin to `src/exporters/index.ts`

## 🧪 Testing Your Plugin

1. **Build the project:**

   ```bash
   npm run build
   ```

2. **Test with the CLI:**

   ```bash
   # Test importer
   node dist/cli/plugin-cli.js import \\
     --importer my-new-importer \\
     --exporter console \\
     --config configs/my-new-importer.json \\
     --input ./data/sample-data.json

   # List all plugins
   node dist/cli/plugin-cli.js list-plugins
   ```

3. **Validate configuration:**
   ```bash
   node dist/cli/plugin-cli.js validate-config \\
     --importer my-new-importer \\
     --config configs/my-new-importer.json
   ```

## 📝 Plugin Development Best Practices

### Data Validation

- Always validate input data structure in `validateData()`
- Provide clear error messages with field names
- Use TypeScript interfaces for type safety
- Handle edge cases gracefully

### Error Handling

- Wrap risky operations in try-catch blocks
- Log warnings for recoverable errors
- Skip invalid records rather than failing completely
- Provide detailed error context

### Performance

- Process data in batches when possible
- Use streaming for large datasets
- Implement proper memory management
- Add progress indicators for long operations

### Configuration

- Use JSON Schema for configuration validation
- Provide sensible defaults
- Document all configuration options
- Support both file and environment-based config

### Testing

- Create sample data files for testing
- Test with malformed/invalid data
- Verify coordinate validation
- Test configuration edge cases

## 🔧 Plugin Interface Reference

### Importer Interface

```typescript
interface ImporterPlugin {
  name: string;
  description: string;
  metadata: PluginMetadata;
  configSchema: object;
  supportedFormats: string[];
  requiredFields: string[];
  optionalFields: string[];

  mapData(sourceData: unknown, config: ImporterConfig): Promise<RawImportData[]>;
  validateData(sourceData: unknown): Promise<ValidationResult>;
  generateImportId(record: unknown): string;
  getDefaultDataPath?(): string;
}
```

### Exporter Interface

```typescript
interface ExporterPlugin {
  name: string;
  description: string;
  metadata: PluginMetadata;
  supportedFormats: string[];
  requiresNetwork: boolean;
  outputType: 'file' | 'api' | 'stream' | 'console';

  export(data: RawImportData[], config: ExporterConfig): Promise<ExportResult>;
  configure(options: ExporterOptions): Promise<void>;
  validate(config: ExporterConfig): Promise<ValidationResult>;
}
```

## 📚 Example Implementations

Look at the existing plugins for reference:

- **Vancouver Public Art Importer** (`src/importers/vancouver-public-art.ts`)
  - JSON data processing
  - Complex field mapping
  - Tag transformation
  - Coordinate validation

- **OSM Artwork Importer** (`src/importers/osm-artwork.ts`)
  - GeoJSON processing
  - Feature filtering
  - Multiple data sources
  - Flexible tag mapping

- **JSON File Exporter** (`src/exporters/json-exporter.ts`)
  - File output handling
  - Multiple format options
  - Batch processing
  - Error recovery

- **API REST Exporter** (`src/exporters/api-exporter.ts`)
  - HTTP API integration
  - Authentication handling
  - Retry logic
  - Rate limiting

## 🐛 Troubleshooting

### Common Issues

1. **TypeScript compilation errors:**
   - Ensure all placeholder tokens are replaced
   - Check import paths are correct
   - Verify interface implementations

2. **Plugin not found:**
   - Check plugin is registered in index.ts
   - Verify export statement is correct
   - Ensure build completed successfully

3. **Configuration validation fails:**
   - Check JSON syntax in config file
   - Verify all required fields are present
   - Test with sample configuration

4. **Data mapping errors:**
   - Add logging to identify problematic records
   - Check coordinate validation logic
   - Verify field path extraction

## 🤝 Contributing

When creating plugins for the core system:

1. Follow existing naming conventions
2. Include comprehensive error handling
3. Add TypeScript type annotations
4. Document configuration options
5. Provide sample data and configs
6. Add unit tests (see Task 8)

## 📖 Next Steps

After creating your plugin:

1. **Add Unit Tests** - Create test files following the patterns in the test suite
2. **Update Documentation** - Add your plugin to the main documentation
3. **Create Sample Data** - Provide example data files for testing
4. **Performance Testing** - Test with realistic data volumes
5. **Integration Testing** - Verify compatibility with existing exporters/importers
