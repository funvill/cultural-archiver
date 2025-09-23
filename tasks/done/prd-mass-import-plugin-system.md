# PRD: Mass-Import Plugin System

**Version:** 1.0  
**Date:** September 13, 2025  
**Status:** Draft

## Executive Summary

Replace the existing mass-import CLI tool's hardcoded importer logic with a modular plugin-based architecture featuring separate importer and exporter modules. This system will simplify adding new data source importers and output destinations, with all mass-imported content being auto-approved.

## Problem Statement

Currently, adding new data source importers to the mass-import CLI tool requires modifying core CLI logic and creating separate command structures. The output destinations are also hardcoded into the system. Each new data source (Vancouver, OSM, etc.) and output method requires:

1. **Hardcoded CLI commands** - Each importer needs its own command (`vancouver`, `osm`)
2. **Scattered importer logic** - Importers exist in different locations with inconsistent interfaces
3. **Hardcoded output methods** - API and file output logic is embedded in core system
4. **Complex development workflow** - Adding new importers or exporters requires understanding core CLI architecture
5. **Limited debugging capabilities** - No unified way to output data for debugging without API submission

This complexity makes it difficult for developers to quickly add new import formatters for different data sources or modify output destinations.

## Goals & Objectives

### Primary Goals

- **Simplify importer development** - Reduce complexity of adding new data source importers
- **Modular exporter system** - Separate output handling into dedicated exporter plugins
- **Unified CLI interface** - Replace multiple hardcoded commands with a plugin system
- **Debugging support** - Enable JSON file output for development and testing
- **Maintain existing functionality** - Preserve current import capabilities and performance

### Success Metrics

- New importer creation time reduced from hours to minutes
- New exporter creation time under 15 minutes
- Single CLI command interface replaces multiple hardcoded commands
- Modular input/output architecture supports easy extension
- Zero breaking changes to existing mass-import API endpoint

## Scope

### In Scope

- Replace hardcoded CLI commands with a manual plugin registry system (no automatic directory scanning)
- Create standardized exporter interface with separate modules for output handling
- Support modular input (importer plugins) and output (exporter plugins) architecture
- Template directories and documentation for rapid development of both importers and exporters (no generator CLI)
- Configuration file support for importer-specific settings
- Migration of existing Vancouver and OSM importers to plugin format
- Initial OSM and Vancouver Open Data focus

### Out of Scope

- Changes to existing mass-import API endpoint `/api/mass-import`
- Backward compatibility with existing CLI commands
- Dynamic plugin loading (plugins are statically registered)
- External npm package plugins (TypeScript files only)
- Modification of bulk approval system
- Support for data sources other than OSM and Vancouver Open Data initially

## Requirements

### Functional Requirements

#### FR1: Modular Plugin Architecture

- **FR1.1** - Importer plugins are TypeScript files in `src/lib/mass-import/src/importers/` directory
- **FR1.2** - Exporter plugins are TypeScript files in `src/lib/mass-import/src/exporters/` directory
- **FR1.3** - Importers implement standardized `ImporterInterface` with required methods:
  - `mapData()` - Transform source data to unified format
  - `validateData()` - Validate source data structure
  - `generateImportId()` - Create unique identifier for records
- **FR1.4** - Exporters implement standardized `ExporterInterface` with required methods:
  - `export()` - Handle output of processed data
  - `configure()` - Set up exporter with configuration
  - `validate()` - Validate export configuration

- **FR1.6** - Importer-specific configuration via JSON files in importers directory
- **FR1.7** - Secrets and credentials are read from environment variables; do not commit secrets to config files

#### FR2: CLI Interface

- **FR2.1** - Single `import` command replaces existing hardcoded commands
- **FR2.2** - `--importer <name>` flag specifies which importer to use
- **FR2.3** - `--exporter <name>` flag specifies which exporter to use (required; omit to fail with a helpful error listing available exporters)
- **FR2.4** - `--importer all` runs all available importers sequentially
- **FR2.5** - If a specified plugin is not found, fail with an error listing all available importers/exporters
- **FR2.6** - No default exporter; if `--exporter` is omitted, the command fails and lists available exporters
- **FR2.7** - Console output is minimal by default (suitable for unit tests); add `--verbose` for detailed logs

#### FR3: Exporter Modules

- **FR3.1** - **API Exporter** - Submit to existing `/api/mass-import` endpoint (current behavior)
- **FR3.2** - **JSON Exporter** - Output full submission payload to filesystem for debugging
- **FR3.3** - **Console Exporter** - Output data to console/stdout for unit testing and development
- **FR3.4** - Exporters receive unified data format from importers
- **FR3.5** - Each exporter handles its own configuration and validation
- **FR3.6** - Exporters are responsible only for data transmission to the destination; they must not transform records
- **FR3.7** - On exporter failure mid-process, the system halts the export, saves progress, and reports which records succeeded vs failed
- **FR3.8** - Conflict handling (duplicates, updates) is delegated to the mass-import API endpoint; exporters always transmit the provided record

#### FR4: Plugin Development

- **FR4.1** - Provide well-documented template directories (checked into the repo) for both importers and exporters (no CLI generator)
- **FR4.2** - Configuration schema validation for importer config files
- **FR4.3** - Plugin test suite integration with existing test framework
- **FR4.4** - Separate configuration files for importers (exporters use CLI parameters or built-in config)
- **FR4.5** - Each plugin directory must include a `README.md` covering purpose, configuration, and data source
- **FR4.6** - All plugin code must pass repository ESLint/Prettier checks; tests are encouraged but not mandatory

#### FR5: Universal Reporting System

- **FR5.1** - Generate comprehensive reports for all mass-import operations regardless of importer/exporter combination
- **FR5.2** - Track individual record status: successful, failed, skipped, or other with detailed reasons
- **FR5.3** - Include execution parameters (importer, exporter, configuration, CLI flags) in report
- **FR5.4** - Provide at-a-glance statistics summary (totals, success rates, performance metrics)
- **FR5.5** - Support JSON report format only (machine-readable, structured data)
- **FR5.6** - Include timestamps, duration, and performance data
- **FR5.7** - A JSON report is generated automatically for every run and saved to `./reports/` with a timestamped filename; an optional `--report-path` can override the location

### Non-Functional Requirements

#### NFR1: Performance

- Plugin discovery and registration completed at CLI startup (< 500ms)
- No performance degradation compared to existing hardcoded system
- Memory usage remains consistent with current implementation

#### NFR2: Developer Experience

- New plugin creation time reduced by 80% (from 2+ hours to < 30 minutes)
- Clear error messages for plugin development issues
- Comprehensive documentation with examples

#### NFR3: Reliability

- Plugin validation prevents invalid plugins from being registered
- Graceful error handling for plugin failures
- Consistent behavior between API and JSON output modes

## Technical Specification

### Architecture Overview

```text
src/lib/mass-import/
├── src/
│   ├── cli/
│   │   └── index.ts              # Updated CLI with modular plugin system

│   ├── importers/
│   │   ├── vancouver.ts          # Migrated Vancouver importer plugin
│   │   ├── vancouver-config.json # Vancouver-specific configuration
│   │   ├── osm.ts               # Migrated OSM importer plugin
│   │   ├── osm-config.json      # OSM-specific configuration

│   │   └── template.ts          # Importer template generator
│   ├── exporters/
│   │   ├── api.ts               # API exporter (submit to mass-import endpoint)
│   │   ├── json.ts              # JSON file exporter (debugging)

│   │   ├── console.ts           # Console output exporter (unit testing)
│   │   └── template.ts          # Exporter template generator
│   ├── lib/
│   │   ├── plugin-registry.ts   # Plugin discovery and registration

│   │   ├── importer-interface.ts# Standardized importer interface
│   │   ├── exporter-interface.ts# Standardized exporter interface
│   │   └── data-pipeline.ts     # Orchestrates importer → exporter flow
│   └── types/
│       └── plugin.ts            # Plugin-related TypeScript types
```

### Plugin Interface Definitions

```typescript
interface ImporterPlugin {
  name: string;
  description: string;
  configSchema: object;

  mapData(sourceData: unknown, config: ImporterConfig): Promise<UnifiedImportData[]>;
  validateData(sourceData: unknown): Promise<ValidationResult>;
  generateImportId(record: unknown): string;
  getDefaultDataPath?(): string;

  // Plugin metadata
  supportedFormats: string[];
  requiredFields: string[];
  optionalFields: string[];
}

interface ExporterPlugin {
  name: string;
  description: string;

  export(data: UnifiedImportData[], config: ExporterConfig): Promise<ExportResult>;
  configure(options: ExporterOptions): Promise<void>;
  validate(config: ExporterConfig): Promise<ValidationResult>;

  // Plugin metadata
  supportedFormats: string[];
  requiresNetwork: boolean;
  outputType: 'file' | 'api' | 'stream' | 'console';
}

interface ImporterConfig {
  // Unique to each importer - defined in importer-config.json files
  [key: string]: unknown;
}

interface ExporterConfig {
  // Common exporter configuration (API endpoints, file paths, etc.)
  outputPath?: string;
  apiEndpoint?: string;
  batchSize?: number;
  [key: string]: unknown;
}

interface UnifiedImportData {
  // Existing RawImportData structure
  lat: number;
  lon: number;
  title: string;
  description?: string;
  artist?: string;
  photos?: PhotoInfo[];
  tags?: Record<string, unknown>;
  source: string;
  externalId: string;
  // ... other fields
}
```

### CLI Command Structure

```bash
# Modular import with specific importer and exporter
mass-import import --importer vancouver --exporter api data.json
mass-import import --importer osm --exporter json merged-artworks.geojson
mass-import import --importer vancouver --exporter json data.json

# Default exporter (api) when not specified
mass-import import --importer vancouver data.json

# Generate reports during import
mass-import import --importer vancouver --exporter api data.json --generate-report
mass-import import --importer osm --exporter json data.json --generate-report --report-path ./reports/

# Console exporter for unit testing and development
mass-import import --importer vancouver --exporter console data.json

# Plugin development and management
mass-import create-importer --name "new-source" --template basic
mass-import create-exporter --name "custom-output" --template file
mass-import validate-plugin --importer new-source
mass-import validate-plugin --exporter custom-output
# Lists the importers and exporters
mass-import list
```

### Plugin Registry System

```typescript
// src/lib/mass-import/src/lib/plugin-registry.ts
class PluginRegistry {
  private importers = new Map<string, ImporterPlugin>();
  private exporters = new Map<string, ExporterPlugin>();

  static async initialize(): Promise<PluginRegistry> {
    const registry = new PluginRegistry();
    await registry.discoverPlugins();
    return registry;
  }

  private async discoverPlugins(): Promise<void> {
    // Scan importers directory for .ts files
    // Scan exporters directory for .ts files
    // Dynamically import and validate each plugin
    // Register plugins that pass validation
  }

  getImporter(name: string): ImporterPlugin | undefined;
  getExporter(name: string): ExporterPlugin | undefined;
  listImporters(): string[];
  listExporters(): string[];
  validateImporter(plugin: ImporterPlugin): ValidationResult;
  validateExporter(plugin: ExporterPlugin): ValidationResult;
}
```

### Data Pipeline Flow

```typescript
// src/lib/mass-import/src/lib/data-pipeline.ts
class DataPipeline {
  constructor(
    private importer: ImporterPlugin,
    private exporter: ExporterPlugin
  ) {}

  async process(inputData: unknown, options: ProcessingOptions): Promise<PipelineResult> {
    // 1. Load importer-specific configuration
    const importerConfig = await this.loadImporterConfig();

    // 2. Initialize report tracker
    const reportTracker = new ReportTracker(options.generateReport);
    reportTracker.startOperation({
      importer: this.importer.name,
      exporter: this.exporter.name,
      inputFile: options.inputFile,
      parameters: options,
    });

    // 3. Validate input data with importer
    const validation = await this.importer.validateData(inputData);
    if (!validation.isValid) {
      reportTracker.recordFailure('validation', 'Input data validation failed', validation.errors);
      throw new Error('Invalid input data');
    }

    // 4. Transform data using importer
    const unifiedData = await this.importer.mapData(inputData, importerConfig);
    reportTracker.recordProcessedRecords(unifiedData.length);

    // 5. Configure exporter
    await this.exporter.configure(options.exporterOptions);

    // 6. Export processed data with detailed tracking
    const result = await this.exportWithTracking(unifiedData, options.exporterConfig, reportTracker);

    // 7. Generate final report if requested
    if (options.generateReport) {
      const report = await reportTracker.generateReport();
      await this.saveReport(report, options.reportPath);
    }

    return {
      importedCount: unifiedData.length,
      exportResult: result,
      summary: this.generateSummary(unifiedData, result),
      report: reportTracker.getReport(),
    };
  }

  private async exportWithTracking(data: UnifiedImportData[], config: ExporterConfig, tracker: ReportTracker): Promise<ExportResult> {
    const results: ExportResult[] = [];

    for (const record of data) {
      try {
        const result = await this.exporter.export([record], config);
        if (result.success) {
          tracker.recordSuccess(record.externalId, 'exported', record);
        } else {
          tracker.recordFailure(record.externalId, 'export_failed', result.error, record);
        }
        results.push(result);
      } catch (error) {
        tracker.recordFailure(record.externalId, 'export_error', error, record);
      }
    }

    return this.aggregateResults(results);
  }
}
```

### Configuration Management

Each importer has an associated JSON configuration file unique to its requirements:

```json
// src/lib/mass-import/src/importers/vancouver-config.json
{
  "name": "vancouver",
  "description": "Vancouver Open Data public art importer",
  "defaultDataPath": "./tasks/public-art.json",
  "validation": {
    "requiredFields": ["registryid", "title_of_work", "geo_point_2d"],
    "coordinateBounds": {
      "north": 49.3157,
      "south": 49.1951,
      "east": -123.0236,
      "west": -123.2734
    }
  },
  "mapping": {
    "titleField": "title_of_work",
    "artistField": "artists",
    "coordinateFields": {
      "lat": "geo_point_2d.lat",
      "lon": "geo_point_2d.lon"
    }
  }
}
```

```json
// src/lib/mass-import/src/importers/osm-config.json
{
  "name": "osm",
  "description": "OpenStreetMap GeoJSON artwork importer",
  "defaultDataPath": "./src/data-collection/osm/output/merged/merged-artworks.geojson",
  "validation": {
    "requiredFields": ["properties.name", "geometry.coordinates"],
    "presets": {
      "default": { "duplicateThreshold": 0.7 },
      "vancouver": { "duplicateThreshold": 0.8 },
      "strict": { "duplicateThreshold": 0.9 },
      "permissive": { "duplicateThreshold": 0.5 }
    }
  },
  "mapping": {
    "titleField": "properties.name",
    "artistField": "properties.artist_name",
    "coordinateFields": {
      "lat": "geometry.coordinates[1]",
      "lon": "geometry.coordinates[0]"
    }
  }
}
```

### Reporting System Architecture

```typescript
// src/lib/mass-import/src/lib/report-tracker.ts
interface ReportRecord {
  id: string;
  externalId: string;
  status: 'successful' | 'failed' | 'skipped' | 'other';
  reason?: string;
  error?: unknown;
  data?: UnifiedImportData;
  timestamp: string;
  processingTime?: number;
}

interface ReportSummary {
  totalRecords: number;
  successful: number;
  failed: number;
  skipped: number;
  other: number;
  successRate: number;
  processingTime: number;
  averageRecordTime: number;
}

interface ReportMetadata {
  operation: {
    importer: string;
    exporter: string;
    inputFile: string;
    startTime: string;
    endTime: string;
    duration: number;
  };
  parameters: {
    cliFlags: string[];
    importerConfig: object;
    exporterConfig: object;
    batchSize?: number;
    dryRun?: boolean;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    timestamp: string;
  };
}

interface MassImportReport {
  metadata: ReportMetadata;
  summary: ReportSummary;
  records: ReportRecord[];
  errors: ReportError[];
}

class ReportTracker {
  private records: ReportRecord[] = [];
  private metadata: ReportMetadata;
  private startTime: Date;

  constructor(private enabled: boolean) {
    this.startTime = new Date();
  }

  startOperation(params: OperationParams): void {
    this.metadata = this.buildMetadata(params);
  }

  recordSuccess(externalId: string, reason: string, data?: UnifiedImportData): void {
    if (!this.enabled) return;
    this.records.push({
      id: generateId(),
      externalId,
      status: 'successful',
      reason,
      data,
      timestamp: new Date().toISOString(),
      processingTime: this.calculateRecordTime(),
    });
  }

  recordFailure(externalId: string, reason: string, error?: unknown, data?: UnifiedImportData): void {
    if (!this.enabled) return;
    this.records.push({
      id: generateId(),
      externalId,
      status: 'failed',
      reason,
      error,
      data,
      timestamp: new Date().toISOString(),
      processingTime: this.calculateRecordTime(),
    });
  }

  recordSkipped(externalId: string, reason: string, data?: UnifiedImportData): void {
    if (!this.enabled) return;
    this.records.push({
      id: generateId(),
      externalId,
      status: 'skipped',
      reason,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async generateReport(): Promise<MassImportReport> {
    const summary = this.calculateSummary();
    return {
      metadata: this.metadata,
      summary,
      records: this.records,
      errors: this.extractErrors(),
    };
  }

  private calculateSummary(): ReportSummary {
    const total = this.records.length;
    const successful = this.records.filter(r => r.status === 'successful').length;
    const failed = this.records.filter(r => r.status === 'failed').length;
    const skipped = this.records.filter(r => r.status === 'skipped').length;
    const other = this.records.filter(r => r.status === 'other').length;

    return {
      totalRecords: total,
      successful,
      failed,
      skipped,
      other,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      processingTime: Date.now() - this.startTime.getTime(),
      averageRecordTime: this.calculateAverageProcessingTime(),
    };
  }
}
```

### Report Output Formats

**JSON Format (Machine-Readable):**

```json
{
  "metadata": {
    "operation": {
      "importer": "vancouver",
      "exporter": "api",
      "inputFile": "public-art.json",
      "startTime": "2025-09-13T10:30:00Z",
      "endTime": "2025-09-13T10:35:30Z",
      "duration": 330000
    },
    "parameters": {
      "cliFlags": ["--importer", "vancouver", "--exporter", "api", "--generate-report"],
      "importerConfig": { "duplicateThreshold": 0.8 },
      "exporterConfig": { "batchSize": 50 },
      "dryRun": false
    }
  },
  "summary": {
    "totalRecords": 1250,
    "successful": 1180,
    "failed": 45,
    "skipped": 25,
    "other": 0,
    "successRate": 94.4,
    "processingTime": 330000,
    "averageRecordTime": 264
  },
  "records": [
    {
      "id": "rec_001",
      "externalId": "vancouver_12345",
      "status": "successful",
      "reason": "exported",
      "timestamp": "2025-09-13T10:30:15Z",
      "processingTime": 250
    },
    {
      "id": "rec_002",
      "externalId": "vancouver_12346",
      "status": "failed",
      "reason": "duplicate_detected",
      "error": "Record already exists within 50m radius",
      "timestamp": "2025-09-13T10:30:18Z"
    }
  ]
}
```

## Implementation Plan

### Phase 1: Core Plugin System (Week 1)

1. Create importer and exporter plugin interfaces and registry system
2. Update CLI to use modular plugin system instead of hardcoded commands
3. Implement core exporters (API and JSON)
4. Create plugin template generators for both importers and exporters
5. **Implement universal reporting system with ReportTracker class**
6. **Add CLI report generation flags and output format options**

### Phase 2: Plugin Migration (Week 2)

1. Migrate existing Vancouver importer to plugin format
2. Migrate existing OSM importer to plugin format
3. Create importer-specific configuration files (vancouver-config.json, osm-config.json)
4. Update configuration files and move to importers directory
5. Comprehensive testing of migrated plugins
6. **Integration testing of reporting system with all importer/exporter combinations**

### Phase 3: Developer Tools & Reporting (Week 3)

1. Enhanced error reporting and validation for both importers and exporters
2. Plugin development documentation for both module types
3. Integration with existing test framework
4. Performance optimization and refinement
5. **Documentation for JSON report interpretation and troubleshooting**

## Migration Strategy

### Existing Importer Conversion

**Vancouver Importer (`src/lib/mass-import/src/importers/vancouver.ts`)**

- Already exists - update to implement new interface
- Move configuration to `vancouver-config.json`
- Preserve existing field mapping and validation logic

**OSM Importer (`src/lib/mass-import/src/importers/osm.ts`)**

- Already exists - update to implement new interface
- Move `src/config/osm-import-config.json` to `src/lib/mass-import/src/importers/osm-config.json`
- Maintain existing GeoJSON processing capabilities

### New Exporter Creation

**API Exporter (`src/lib/mass-import/src/exporters/api.ts`)**

- Extract existing API submission logic from current system
- Implement standardized exporter interface
- Maintain compatibility with existing `/api/mass-import` endpoint

**JSON Exporter (`src/lib/mass-import/src/exporters/json.ts`)**

- Create new module for filesystem output
- Support configurable output paths and formatting
- Include full submission payload structure for debugging

**Console Exporter (`src/lib/mass-import/src/exporters/console.ts`)**

- Create new module for stdout/console output
- Support structured logging for unit test verification
- Include summary statistics and record counts
- Useful for automated testing and CI/CD pipelines

### Breaking Changes

- Remove hardcoded CLI commands: `mass-import vancouver`, `mass-import osm`
- Replace with: `mass-import import --importer vancouver --exporter api`, `mass-import import --importer osm --exporter json`
- No backward compatibility required per project requirements

## Testing Strategy

### Unit Tests

- Importer and exporter interface validation
- Registry discovery and registration for both plugin types
- Configuration schema validation for importers
- Template generator functionality

### Integration Tests

- End-to-end plugin loading and execution
- Importer → exporter data flow validation
- Error handling and recovery scenarios
- Performance regression testing

### Plugin-Specific Tests

- Each importer and exporter maintains its own test suite
- Standardized test structure using existing test framework
- Data transformation accuracy validation
- Export format verification

## Documentation

### Developer Documentation

- Plugin development guide with step-by-step examples for both importers and exporters
- API reference for importer and exporter interfaces
- Configuration schema documentation (importer-specific)
- Troubleshooting guide for common plugin development issues

### User Documentation

- Updated CLI command reference with modular approach
- Migration guide for users of existing commands
- Configuration management best practices for importers

## Success Criteria

### Technical Success

- ✅ Modular CLI interface with separate importer and exporter plugins replaces hardcoded commands
- ✅ Plugin system supports both API submission and JSON file debugging output
- ✅ New importer creation time reduced by 80%
- ✅ New exporter creation time under 15 minutes
- ✅ Zero performance degradation from existing system
- ✅ All existing importers (Vancouver, OSM) migrated successfully with dedicated configurations
- ✅ **Universal reporting system provides comprehensive tracking across all plugin combinations**
- ✅ **Report generation supports JSON format for structured, machine-readable output**

### Business Success

- ✅ Developer productivity improvement measured
- ✅ Reduced support requests for importer development
- ✅ Faster integration of new data sources (focus on OSM and Vancouver initially)
- ✅ Improved debugging capabilities for development team
- ✅ Simplified output destination management
- ✅ **Enhanced troubleshooting with detailed import operation reports**
- ✅ **Better visibility into mass-import success rates and failure patterns**

## Risks & Mitigation

### Technical Risks

- **Plugin validation complexity** - Mitigation: Comprehensive schema validation and error reporting
- **Performance impact of plugin discovery** - Mitigation: Caching and lazy loading strategies
- **Configuration management complexity** - Mitigation: JSON schema validation and clear documentation for importers
- **Importer-exporter interface complexity** - Mitigation: Standardized data pipeline with comprehensive testing

### Development Risks

- **Migration complexity for existing importers** - Mitigation: Gradual migration with thorough testing
- **Developer adoption of modular approach** - Mitigation: Clear documentation and template generators
- **Testing coverage across modules** - Mitigation: Standardized test framework integration for both importers and exporters

## Future Considerations

### Potential Enhancements (Out of Current Scope)

- Dynamic plugin loading from external packages
- Visual plugin configuration editor for importers
- Plugin marketplace or sharing system
- Auto-discovery of data source formats
- Plugin performance monitoring and analytics
- Additional exporter types (database, webhook, structured logging)

### Extensibility

- Plugin interfaces designed to support future data source types
- Configuration system supports complex field mapping scenarios for importers
- Registry system can be extended for additional plugin metadata
- Template system supports multiple plugin archetypes for both importers and exporters
- Exporter system designed to support various output destinations and formats

---

**Next Steps:**

1. Review and refine requirements with development team
2. Validate technical approach with existing codebase constraints
3. Confirm scope and timeline alignment with project priorities
4. Begin Phase 1 implementation upon approval
