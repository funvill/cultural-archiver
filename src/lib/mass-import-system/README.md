# Mass Import Plugin System

A modular, extensible data import and export system for the Cultural Archiver project. This system provides a plugin-based architecture for importing public art data from various sources and exporting it to different formats and destinations.

## 🎯 Overview

The Mass Import Plugin System is designed to replace the original hardcoded import system with a flexible, modular architecture that supports:

- **Plugin-based Architecture**: Easily add new importers and exporters without modifying core code
- **Type-safe Development**: Full TypeScript support with strict type checking
- **Unified Data Pipeline**: Consistent data transformation flow from any source to any destination
- **CLI Interface**: Modern command-line interface with plugin discovery and validation
- **Error Handling**: Comprehensive error tracking and reporting
- **Testing Framework**: Built-in testing tools and utilities

## 🏗️ Architecture

```text
mass-import-system/
├── 📦 Core System
│   ├── lib/               # Core library components
│   │   ├── plugin-registry.ts    # Plugin registration and management
│   │   ├── data-pipeline.ts      # Data processing pipeline
│   │   └── report-tracker.ts     # Processing reports and analytics
│   └── types/             # TypeScript type definitions
│       ├── plugin.ts      # Plugin interface definitions
│       └── index.ts       # Shared data types
│
├── 🔌 Plugins
│   ├── importers/         # Data source plugins
│   │   ├── vancouver-public-art.ts   # Vancouver Open Data
│   │   └── osm-artwork.ts            # OpenStreetMap artwork
│   └── exporters/         # Data destination plugins
│       ├── json-exporter.ts          # JSON file export
│       ├── console-exporter.ts       # Console output
│       └── api-exporter.ts           # REST API export
│
├── 🖥️ CLI Interface
│   ├── cli/               # Command-line interface
│   │   ├── plugin-cli.ts  # Modern plugin-aware CLI
│   │   └── index.ts       # Legacy CLI (compatibility)
│   └── cli.ts             # CLI entry point
│
├── 🧪 Development Tools
│   ├── templates/         # Plugin templates
│   ├── test/             # Test suite
│   └── create-plugin.js  # Plugin generator script
│
└── 📋 Documentation
    ├── README.md         # This file
    └── TESTING.md        # Testing guide
```

## 🚀 Quick Start

### Installation

```bash
cd src/lib/mass-import-system
npm install
npm run build
```

### Basic Usage

#### List Available Plugins

```bash
node dist/cli/cli-entry.js list-plugins
```

#### Import Data

```bash
# Import Vancouver public art data and export to JSON
node dist/cli/cli-entry.js import \
  --importer vancouver-public-art \
  --exporter json \
  --input vancouver-data.json \
  --output processed-art.json

# Import test data and display in console
node dist/cli/cli-entry.js import \
  --importer vancouver-public-art \
  --exporter console \
  --input test-data.json \
  --config test-config.json

# Process only first 10 records for testing
node dist/cli/cli-entry.js import \
  --importer vancouver-public-art \
  --exporter json \
  --input large-dataset.json \
  --output sample.json \
  --limit 10

# Skip first 100 records and process next 50 (pagination)
node dist/cli/cli-entry.js import \
  --importer vancouver-public-art \
  --exporter json \
  --input large-dataset.json \
  --output batch2.json \
  --offset 100 \
  --limit 50
```

#### Plugin Information

```bash
# Get detailed information about a plugin
node dist/cli/cli-entry.js plugin-info --name vancouver-public-art
```

### Programmatic Usage

```typescript
import { PluginRegistry, DataPipeline } from './dist/index.js';
import { registerCoreImporters } from './dist/importers/index.js';
import { registerCoreExporters } from './dist/exporters/index.js';

// Initialize the plugin system
const registry = new PluginRegistry();
registerCoreImporters(registry);
registerCoreExporters(registry);

// Create a data pipeline
const importer = registry.getImporter('vancouver-public-art');
const exporter = registry.getExporter('json');
const pipeline = new DataPipeline(importer, exporter);

// Process data
const result = await pipeline.process(inputData, {
  batchSize: 50,
  generateReport: true,
  outputPath: './output.json'
});
```

## 🔌 Available Plugins

### Importers

| Plugin | Description | Version | Data Source |
|--------|-------------|---------|-------------|
| `vancouver-public-art` | Vancouver Open Data public art dataset | 1.0.0 | JSON API |
| `osm-artwork` | OpenStreetMap artwork and monuments | 1.0.0 | GeoJSON |

### Exporters

| Plugin | Description | Version | Output Type |
|--------|-------------|---------|-------------|
| `json` | JSON file export with configurable formatting | 1.0.0 | File |
| `console` | Console output with table/JSON formatting | 1.0.0 | Console |
| `api` | REST API export with batch processing | 1.0.0 | HTTP API |

## 🛠️ Plugin Development

### Creating a New Importer

1. **Use the Template Generator**:

   ```bash
   node create-plugin.js --type importer --name my-data-source
   ```

2. **Manual Creation**:

   ```bash
   cp templates/importer/importer-template.ts importers/my-importer.ts
   ```

3. **Implement Required Methods**:

   ```typescript
   export const myImporter: ImporterPlugin = {
     name: 'my-data-source',
     metadata: {
       version: '1.0.0',
       description: 'Imports data from my custom source',
       author: 'Your Name'
     },
     
     async validateData(data: unknown): Promise<ValidationResult> {
       // Validate input data structure
     },
     
     async mapData(data: unknown, config: ImporterConfig): Promise<UnifiedArtwork[]> {
       // Transform data to unified format
     }
   };
   ```

4. **Register the Plugin**:

   ```typescript
   // In importers/index.ts
   import { myImporter } from './my-importer.js';
   
   export function registerCoreImporters(registry: PluginRegistry): void {
     registry.registerImporter(myImporter);
     // ... other registrations
   }
   ```

### Creating a New Exporter

1. **Use the Template Generator**:

   ```bash
   node create-plugin.js --type exporter --name my-destination
   ```

2. **Implement Required Methods**:

   ```typescript
   export const myExporter: ExporterPlugin = {
     name: 'my-destination',
     metadata: {
       version: '1.0.0',
       description: 'Exports data to my custom destination',
       author: 'Your Name'
     },
     
     async configure(options: Record<string, unknown>): Promise<void> {
       // Configure exporter
     },
     
     async exportData(data: UnifiedArtwork[], config: ExporterConfig): Promise<ExportResult> {
       // Export data to destination
     }
   };
   ```

## 📝 Configuration

### Importer Configuration

Each importer can have its own configuration file:

```json
{
  "vancouver-public-art": {
    "apiEndpoint": "https://opendata.vancouver.ca/api/records/1.0/search/",
    "dataset": "public-art",
    "fieldMappings": {
      "title": "title_of_work",
      "artist": "artist",
      "location": "civic_address"
    }
  }
}
```

### Exporter Configuration

Exporters support various configuration options:

```json
{
  "json": {
    "format": "pretty",
    "includeMetadata": true,
    "batchSize": 100
  },
  "api": {
    "endpoint": "https://art-api.abluestar.com/submissions",
    "authentication": {
      "type": "bearer",
      "token": "your-api-token"
    },
    "batchSize": 50,
    "retryAttempts": 3
  }
}
```

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run specific tests:

```bash
# Test basic functionality
npm run test:basic

# Test full integration
npm run test:integration
```

For detailed testing information, see [TESTING.md](./TESTING.md).

## 📊 CLI Commands

### Main Commands

| Command | Description | Example |
|---------|-------------|---------|
| `import` | Import data using specified plugins | `import --importer osm --exporter json` |
| `list-plugins` | List all available plugins | `list-plugins` |
| `validate-config` | Validate plugin configuration files | `validate-config --config my-config.json` |
| `plugin-info` | Show detailed plugin information | `plugin-info --plugin vancouver-public-art` |

### Import Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--importer` | Importer plugin name | Required |
| `--exporter` | Exporter plugin name | Required |
| `--input` | Input file path | stdin |
| `--output` | Output file path | stdout |
| `--config` | Configuration file | auto-detect |
| `--batch-size` | Processing batch size | 50 |
| `--limit` | Limit number of records to process | unlimited |
| `--offset` | Skip first N records before processing | 0 |
| `--dry-run` | Validate without processing | false |
| `--verbose` | Enable verbose logging | false |
| `--generate-report` | Generate processing report | false |

## 🔄 Data Flow

```mermaid
graph LR
    A[Input Data] --> B[Importer Plugin]
    B --> C[Data Validation]
    C --> D[Data Transformation]
    D --> E[Unified Format]
    E --> F[Exporter Plugin]
    F --> G[Output Destination]
    
    H[Configuration] --> B
    H --> F
    I[Report Tracker] --> J[Processing Report]
```

1. **Input**: Raw data from various sources (JSON, GeoJSON, CSV, etc.)
2. **Validation**: Importer validates data structure and content
3. **Transformation**: Data is mapped to unified `UnifiedArtwork` format
4. **Processing**: Data flows through the pipeline with error handling
5. **Export**: Exporter sends data to destination (file, API, console)
6. **Reporting**: Optional processing reports with statistics and errors

## 🔧 Development

### Building

```bash
npm run build     # Build TypeScript to JavaScript
npm run dev       # Build with watch mode
npm run clean     # Clean build artifacts
```

### Linting

```bash
npm run lint      # Run ESLint
```

### Project Structure

- **Core Library** (`lib/`): Plugin registry, data pipeline, utilities
- **Type Definitions** (`types/`): TypeScript interfaces and types
- **Plugins** (`importers/`, `exporters/`): Plugin implementations
- **CLI** (`cli/`): Command-line interface
- **Templates** (`templates/`): Plugin development templates
- **Tests** (`test/`): Test suites and utilities

## 🤝 Contributing

1. **Create a Plugin**: Use templates to create new importers/exporters
2. **Follow Types**: Use TypeScript interfaces for type safety
3. **Add Tests**: Include tests for new functionality
4. **Update Documentation**: Update README and inline docs
5. **Register Plugins**: Add new plugins to the registration functions

## 📋 Roadmap

- [ ] **More Importers**: Additional data source plugins (Wikidata, government APIs)
- [ ] **Advanced Exporters**: Database exporters, cloud storage integration
- [ ] **Data Validation**: Enhanced validation with schema checking
- [ ] **Performance Optimization**: Streaming processing for large datasets
- [ ] **Plugin Marketplace**: Discoverable plugin ecosystem
- [ ] **GUI Interface**: Web-based configuration and monitoring
- [ ] **Incremental Updates**: Delta imports and change detection

## 📄 License

MIT License - see the main project LICENSE file for details.

## 🔗 Related

- **Original System**: `src/lib/mass-import/` (legacy compatibility)
- **Cultural Archiver**: Main project documentation
- **API Documentation**: `docs/api.md`
- **Database Schema**: `docs/database.md`

---

**Cultural Archiver Mass Import Plugin System** - Making public art data accessible through modular, extensible import and export tools.
