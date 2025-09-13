# PRD: Mass Import Plugin System

## Executive Summary

This PRD outlines the evolution of the existing Cultural Archiver mass import system from a hardcoded importer registry to a flexible plugin architecture. The current system already has many plugin-like features through the `ImporterRegistry` class and `DataSourceMapper` interface, but lacks external plugin loading, dynamic discovery, and proper lifecycle management.

## Problem Statement

The current mass import system has importers (Vancouver, OSM) hardcoded into the registry initialization. While functional, this approach:

- **Limits Extensibility**: Adding new data sources requires code changes to the core system
- **Tight Coupling**: Importers are tightly coupled to the main codebase
- **No External Plugins**: Cannot load plugins from external packages or files
- **Limited Discovery**: No mechanism to discover available plugins dynamically
- **No Versioning**: No plugin versioning or dependency management
- **Maintenance Burden**: Each new data source increases core system complexity

## Goals

### Primary Goals
1. **Plugin Architecture**: Convert the existing importer system to a true plugin architecture
2. **External Plugin Support**: Enable loading plugins from external npm packages and local files
3. **Dynamic Discovery**: Implement automatic plugin discovery mechanisms
4. **Backwards Compatibility**: Maintain full compatibility with existing Vancouver and OSM importers
5. **Developer Experience**: Provide clear APIs and documentation for plugin development

### Secondary Goals
1. **Plugin Marketplace**: Enable community-contributed plugins
2. **Configuration Management**: Advanced plugin configuration and validation
3. **Performance Optimization**: Plugin lazy loading and caching
4. **Security**: Plugin sandboxing and permission management

## Success Metrics

1. **Backwards Compatibility**: 100% of existing CLI commands and API endpoints continue to work
2. **Plugin Development**: External developers can create and distribute plugins within 1 hour
3. **Plugin Loading**: External plugins load in <500ms
4. **Discovery Performance**: Plugin discovery completes in <100ms
5. **Documentation**: Complete plugin development guide with examples

## Current System Analysis

### Existing Plugin-Like Features ✅
- `ImporterRegistry` class manages available importers
- `DataSourceMapper` interface standardizes importer behavior
- CLI supports `--importer` flag and "all" importers mode
- Dynamic importer selection and validation
- Per-importer configuration support

### Existing Importers
1. **Vancouver Importer** (`vancouver.ts`)
   - Maps Vancouver Open Data to internal format
   - Handles artist ID resolution from external JSON
   - Comprehensive field mapping and validation

2. **OSM Importer** (`osm.ts`)
   - Processes OpenStreetMap GeoJSON data
   - Handles multiple geometry types
   - Tag processing and coordinate extraction

### Current Architecture
```
├── ImporterRegistry (manages importers)
│   ├── VancouverMapper (DataSourceMapper)
│   └── OSMMapper (DataSourceMapper)
├── CLI Tool (mass-import command)
└── HTTP Endpoints (/api/mass-import)
```

## Plugin System Architecture

### Core Components

#### 1. Plugin Manager (`PluginManager`)
**Responsibilities:**
- Plugin discovery and loading
- Lifecycle management (load, unload, reload)
- Dependency resolution
- Configuration validation
- Plugin registry maintenance

```typescript
interface PluginManager {
  discover(): Promise<PluginManifest[]>;
  load(pluginId: string): Promise<void>;
  unload(pluginId: string): Promise<void>;
  reload(pluginId: string): Promise<void>;
  getPlugin(pluginId: string): ImporterPlugin | undefined;
  listPlugins(): PluginInfo[];
  validateConfig(pluginId: string, config: unknown): ValidationResult;
}
```

#### 2. Plugin Interface (`ImporterPlugin`)
**Extends existing `DataSourceMapper` with plugin metadata:**

```typescript
interface ImporterPlugin extends DataSourceMapper {
  // Existing DataSourceMapper properties
  name: string;
  version: string;
  mapData(data: unknown): ValidationResult;
  generateImportId?(data: unknown): string;
  validateBounds?(lat: number, lon: number): boolean;

  // New plugin properties
  manifest: PluginManifest;
  initialize?(config: PluginConfig): Promise<void>;
  cleanup?(): Promise<void>;
  getConfigSchema?(): JSONSchema;
  getDefaultConfig?(): PluginConfig;
}
```

#### 3. Plugin Manifest (`PluginManifest`)
**Plugin metadata and capabilities:**

```typescript
interface PluginManifest {
  // Core identification
  id: string; // e.g., "@cultural-archiver/vancouver-importer"
  name: string; // Human-readable name
  version: string; // Semantic version
  description: string;
  
  // Compatibility
  apiVersion: string; // Compatible API version
  engineVersion: string; // Required engine version
  
  // Functionality
  dataFormats: string[]; // Supported file formats
  defaultDataPath?: string;
  configSchema?: JSONSchema;
  
  // Distribution
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  
  // Runtime
  main: string; // Entry point file
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}
```

### Plugin Discovery Mechanisms

#### 1. Built-in Plugins (Backwards Compatibility)
- Convert existing Vancouver and OSM importers to plugin format
- Bundle with core system for zero-config experience
- Auto-register on system startup

#### 2. npm Package Plugins
- Discover plugins by package name patterns (`@cultural-archiver/*-importer`)
- Load from `node_modules` directory
- Support scoped and unscoped packages

#### 3. Local File Plugins
- Scan designated plugin directories
- Support both TypeScript and JavaScript plugins
- Hot-reload during development

#### 4. Configuration-based Plugins
- Register plugins via configuration files
- Support for custom plugin locations
- Environment-specific plugin sets

### Plugin Loading Strategies

#### 1. Static Loading (Default)
```typescript
// Load all plugins at startup
await pluginManager.loadAll();
```

#### 2. Lazy Loading
```typescript
// Load plugins on first use
const plugin = await pluginManager.loadOnDemand('vancouver');
```

#### 3. Hot Reloading (Development)
```typescript
// Watch plugin files and reload on changes
pluginManager.enableHotReload();
```

## Enhanced CLI Interface

### Current CLI Support ✅
```bash
# Existing functionality (maintained)
mass-import --importer vancouver --input data.json --dry-run
mass-import --importer osm --input data.geojson
mass-import --importer all --input data.json
```

### New Plugin Commands

#### Plugin Management
```bash
# List available plugins
mass-import plugins list

# Install plugin from npm
mass-import plugins install @community/toronto-opendata-importer

# Install plugin from local file
mass-import plugins install ./custom-importer.js

# Update plugin
mass-import plugins update vancouver

# Remove plugin
mass-import plugins remove @community/toronto-opendata-importer

# Show plugin info
mass-import plugins info vancouver
```

#### Plugin Development
```bash
# Create new plugin template
mass-import plugins create my-importer

# Validate plugin
mass-import plugins validate ./my-importer

# Test plugin
mass-import plugins test ./my-importer --input sample.json

# Package plugin for distribution
mass-import plugins package ./my-importer
```

## Enhanced HTTP API

### Current API Support ✅
```
POST /api/mass-import
```

### New Plugin Endpoints

#### Plugin Management
```
GET    /api/plugins              # List available plugins
GET    /api/plugins/{id}         # Get plugin info
POST   /api/plugins/{id}/reload  # Reload plugin (dev only)
GET    /api/plugins/{id}/config  # Get plugin config schema
POST   /api/plugins/{id}/validate # Validate plugin config
```

#### Import with Plugin Selection
```
POST   /api/mass-import/{pluginId}  # Import using specific plugin
```

## Plugin Configuration System

### Plugin-Specific Configuration
```json
{
  "plugins": {
    "vancouver": {
      "enabled": true,
      "config": {
        "artistDataPath": "./vancouver-artists.json",
        "duplicateThreshold": 0.8,
        "coordinateBounds": {
          "north": 49.3,
          "south": 49.2,
          "east": -123.0,
          "west": -123.3
        }
      }
    },
    "osm": {
      "enabled": true,
      "config": {
        "defaultRadius": 10000,
        "geometryTypes": ["Point", "Polygon"],
        "requiredTags": ["tourism=artwork"]
      }
    }
  }
}
```

### Global Plugin Settings
```json
{
  "pluginSystem": {
    "autoDiscover": true,
    "pluginPaths": [
      "./plugins",
      "../custom-importers"
    ],
    "npmScope": "@cultural-archiver",
    "hotReload": false,
    "maxLoadTime": 5000,
    "security": {
      "allowFileSystem": false,
      "allowNetwork": true,
      "sandbox": true
    }
  }
}
```

## Example Plugin Implementation

### Simple Data Source Plugin
```typescript
// toronto-opendata-importer.ts
import { ImporterPlugin, PluginManifest } from '@cultural-archiver/plugin-api';

export const manifest: PluginManifest = {
  id: '@community/toronto-opendata-importer',
  name: 'Toronto Open Data Importer',
  version: '1.0.0',
  description: 'Import public art data from Toronto Open Data portal',
  apiVersion: '1.0.0',
  engineVersion: '>=1.0.0',
  dataFormats: ['.json', '.csv'],
  author: 'Community Contributor',
  license: 'MIT',
  main: './index.js'
};

export class TorontoImporter implements ImporterPlugin {
  manifest = manifest;

  async initialize(config: any): Promise<void> {
    // Plugin initialization
  }

  mapData(data: any): ValidationResult {
    // Transform Toronto data to internal format
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  generateImportId(data: any): string {
    return `toronto_${data.id}`;
  }

  validateBounds(lat: number, lon: number): boolean {
    // Toronto coordinate bounds
    return lat >= 43.5 && lat <= 43.9 && lon >= -79.7 && lon <= -79.1;
  }
}

export default TorontoImporter;
```

### Advanced Plugin with Custom Configuration
```typescript
// advanced-csv-importer.ts
export class AdvancedCSVImporter implements ImporterPlugin {
  manifest = {
    id: '@community/advanced-csv-importer',
    name: 'Advanced CSV Importer',
    version: '1.2.0',
    description: 'Import data from CSV files with custom field mapping',
    configSchema: {
      type: 'object',
      properties: {
        fieldMapping: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            latitude: { type: 'string' },
            longitude: { type: 'string' },
            artist: { type: 'string' }
          },
          required: ['title', 'latitude', 'longitude']
        },
        delimiter: { type: 'string', default: ',' },
        encoding: { type: 'string', default: 'utf-8' }
      }
    }
  };

  getDefaultConfig() {
    return {
      fieldMapping: {
        title: 'Name',
        latitude: 'Lat',
        longitude: 'Lng',
        artist: 'Artist'
      },
      delimiter: ',',
      encoding: 'utf-8'
    };
  }
}
```

## Migration Strategy

### Phase 1: Core Plugin Infrastructure (4 weeks)
1. **Plugin Manager Implementation**
   - Create `PluginManager` class
   - Implement plugin loading mechanisms
   - Add configuration system

2. **Plugin Interface Definition**
   - Extend `DataSourceMapper` to `ImporterPlugin`
   - Define `PluginManifest` structure
   - Create plugin validation

3. **Discovery Mechanisms**
   - Built-in plugin registration
   - npm package discovery
   - Local file scanning

### Phase 2: Existing Importer Migration (2 weeks)
1. **Convert Vancouver Importer**
   - Add plugin manifest
   - Implement plugin interface
   - Maintain backward compatibility

2. **Convert OSM Importer**
   - Add plugin manifest
   - Implement plugin interface
   - Test configuration schema

3. **Registry Integration**
   - Update `ImporterRegistry` to use `PluginManager`
   - Maintain existing CLI compatibility
   - Add plugin validation

### Phase 3: Enhanced CLI and API (3 weeks)
1. **CLI Plugin Commands**
   - Add plugin management commands
   - Implement plugin validation
   - Create plugin templates

2. **HTTP API Extensions**
   - Add plugin endpoints
   - Implement plugin reload
   - Add configuration validation

3. **Testing and Documentation**
   - Comprehensive test suite
   - Plugin development guide
   - API documentation

### Phase 4: External Plugin Support (3 weeks)
1. **npm Package Loading**
   - Implement package discovery
   - Add dependency resolution
   - Handle plugin security

2. **Hot Reloading**
   - File system watching
   - Plugin reload mechanisms
   - Development workflow

3. **Plugin Marketplace Preparation**
   - Plugin packaging tools
   - Distribution guidelines
   - Quality assurance

## Implementation Details

### Backwards Compatibility Strategy
1. **Zero-Config Migration**: Existing commands work without changes
2. **Automatic Plugin Detection**: Built-in plugins register automatically
3. **Legacy Support**: Deprecated features supported with warnings
4. **Gradual Migration**: Optional adoption of new plugin features

### Security Considerations
1. **Plugin Sandboxing**: Isolate plugin execution context
2. **Permission System**: Control plugin access to system resources
3. **Code Validation**: Static analysis for security vulnerabilities
4. **Trusted Sources**: Verified plugin repositories

### Performance Optimization
1. **Lazy Loading**: Load plugins only when needed
2. **Caching**: Cache plugin discovery and configuration
3. **Parallel Loading**: Load multiple plugins concurrently
4. **Memory Management**: Unload unused plugins

## Testing Strategy

### Unit Tests
- Plugin loading and unloading
- Configuration validation
- Discovery mechanisms
- Error handling

### Integration Tests
- End-to-end plugin workflows
- CLI command compatibility
- HTTP API functionality
- Multi-plugin scenarios

### Plugin Validation Tests
- Plugin interface compliance
- Configuration schema validation
- Data transformation accuracy
- Performance benchmarks

## Documentation Requirements

### Plugin Developer Guide
1. **Getting Started**: Plugin creation tutorial
2. **API Reference**: Complete interface documentation
3. **Best Practices**: Performance and security guidelines
4. **Examples**: Sample plugin implementations

### User Documentation
1. **Plugin Management**: Installing and configuring plugins
2. **CLI Reference**: Updated command documentation
3. **API Reference**: New endpoint documentation
4. **Troubleshooting**: Common issues and solutions

## Risk Assessment

### High Risk
- **Breaking Changes**: Potential compatibility issues during migration
- **Performance Impact**: Plugin loading overhead
- **Security Vulnerabilities**: External code execution risks

### Medium Risk
- **Complexity**: Increased system complexity
- **Dependencies**: External plugin dependencies
- **Maintenance**: Supporting multiple plugin versions

### Low Risk
- **Developer Adoption**: Plugin development learning curve
- **Documentation**: Keeping documentation current

## Success Criteria

### Technical Success
- [ ] All existing importers work as plugins
- [ ] External plugins can be loaded and executed
- [ ] Plugin discovery works across all mechanisms
- [ ] Configuration system validates plugin settings
- [ ] CLI and API maintain backwards compatibility

### User Experience Success
- [ ] Zero-config upgrade for existing users
- [ ] Plugin installation takes <2 minutes
- [ ] Clear error messages for plugin issues
- [ ] Comprehensive documentation available

### Community Success
- [ ] External developers create plugins
- [ ] Plugin marketplace has >5 community plugins
- [ ] Plugin development guide has >90% satisfaction
- [ ] Support tickets for plugins <10% of total

## Future Enhancements

### Plugin Marketplace
- Centralized plugin repository
- Plugin ratings and reviews
- Automated security scanning
- Version management

### Advanced Features
- Plugin composition and pipelines
- Real-time plugin updates
- Plugin analytics and monitoring
- Multi-tenant plugin isolation

### Developer Tools
- Plugin debugging tools
- Performance profiling
- Visual plugin builder
- Automated testing framework

## Conclusion

The mass import plugin system builds on the strong foundation of the existing `ImporterRegistry` and `DataSourceMapper` architecture. By evolving this system into a true plugin architecture, we enable:

1. **Community Contributions**: External developers can create and share plugins
2. **Rapid Expansion**: New data sources can be added without core system changes
3. **Maintainability**: Cleaner separation of concerns and modular architecture
4. **Backwards Compatibility**: Existing functionality remains unchanged

The phased implementation approach ensures minimal disruption while delivering significant value to both developers and users.

## TODOs and Next Steps

### Immediate Actions
- [ ] Review and approve this PRD
- [ ] Create detailed technical specifications
- [ ] Set up plugin development environment
- [ ] Begin Phase 1 implementation

### Recommendations
1. **Start with Built-in Plugins**: Convert existing importers first
2. **Focus on Developer Experience**: Prioritize plugin development tools
3. **Community Engagement**: Involve community in plugin standards
4. **Performance Monitoring**: Track plugin system performance impact

### Suggestions for Implementation
1. **Use TypeScript**: Leverage existing TypeScript infrastructure
2. **Follow Node.js Standards**: Use standard module loading patterns
3. **Implement Graceful Degradation**: Fall back to built-in plugins on errors
4. **Add Comprehensive Logging**: Enable debugging of plugin issues

This PRD provides a roadmap for evolving the Cultural Archiver mass import system into a flexible, extensible plugin architecture while maintaining the stability and functionality that users depend on.