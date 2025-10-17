/**
 * Mass Import Plugin System - Plugin Registry
 *
 * This module provides plugin discovery, registration, and validation functionality
 * for the modular mass import system.
 */

import type {
  ImporterPlugin,
  ExporterPlugin,
  PluginRegistryEntry,
  PluginValidationResult,
  ValidationError,
} from '../types/plugin.js';

// ================================
// Plugin Registry Class
// ================================

export class PluginRegistry {
  private importers = new Map<string, PluginRegistryEntry<ImporterPlugin>>();
  private exporters = new Map<string, PluginRegistryEntry<ExporterPlugin>>();
  private isInitialized = false;

  // ================================
  // Initialization
  // ================================

  /**
   * Create and initialize a new plugin registry
   */
  static async initialize(): Promise<PluginRegistry> {
    const registry = new PluginRegistry();
    await registry.discoverPlugins();
    return registry;
  }

  /**
   * Discover and register all available plugins
   */
  private async discoverPlugins(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // For now, we'll use static registration
      // In the future, this could scan directories for .ts files
      await this.registerStaticPlugins();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to discover plugins:', error);
      throw new Error('Plugin discovery failed');
    }
  }

  /**
   * Register plugins statically (no directory scanning)
   * This will be replaced with actual plugin imports once they're implemented
   */
  private async registerStaticPlugins(): Promise<void> {
    // TODO: Register actual plugins once they're migrated to the new format
    // For now, this is a placeholder that will be implemented in Phase 2
    console.log('Plugin registry initialized (static registration mode)');
  }

  // ================================
  // Importer Management
  // ================================

  /**
   * Register an importer plugin
   */
  registerImporter(plugin: ImporterPlugin, configPath?: string): void {
    const validation = this.validateImporter(plugin);

    const entry: PluginRegistryEntry<ImporterPlugin> = {
      name: plugin.name,
      plugin,
      ...(configPath && { configPath }),
      isValid: validation.isValid,
      validationErrors: validation.errors,
    };

    this.importers.set(plugin.name, entry);
  }

  /**
   * Get an importer plugin by name
   */
  getImporter(name: string): ImporterPlugin | undefined {
    const entry = this.importers.get(name);
    return entry?.isValid ? entry.plugin : undefined;
  }

  /**
   * Get all available importer names
   */
  listImporters(): string[] {
    return Array.from(this.importers.keys()).filter(name => this.importers.get(name)?.isValid);
  }

  /**
   * Check if an importer exists and is valid
   */
  hasImporter(name: string): boolean {
    const entry = this.importers.get(name);
    return entry?.isValid ?? false;
  }

  /**
   * Get importer registry entry (includes validation info)
   */
  getImporterEntry(name: string): PluginRegistryEntry<ImporterPlugin> | undefined {
    return this.importers.get(name);
  }

  /**
   * Get all valid importer plugins
   */
  getAllImporters(): ImporterPlugin[] {
    return Array.from(this.importers.values())
      .filter(entry => entry.isValid)
      .map(entry => entry.plugin);
  }

  // ================================
  // Exporter Management
  // ================================

  /**
   * Register an exporter plugin
   */
  registerExporter(plugin: ExporterPlugin): void {
    const validation = this.validateExporter(plugin);

    const entry: PluginRegistryEntry<ExporterPlugin> = {
      name: plugin.name,
      plugin,
      isValid: validation.isValid,
      validationErrors: validation.errors,
    };

    this.exporters.set(plugin.name, entry);
  }

  /**
   * Get an exporter plugin by name
   */
  getExporter(name: string): ExporterPlugin | undefined {
    const entry = this.exporters.get(name);
    return entry?.isValid ? entry.plugin : undefined;
  }

  /**
   * Get all available exporter names
   */
  listExporters(): string[] {
    return Array.from(this.exporters.keys()).filter(name => this.exporters.get(name)?.isValid);
  }

  /**
   * Check if an exporter exists and is valid
   */
  hasExporter(name: string): boolean {
    const entry = this.exporters.get(name);
    return entry?.isValid ?? false;
  }

  /**
   * Get exporter registry entry (includes validation info)
   */
  getExporterEntry(name: string): PluginRegistryEntry<ExporterPlugin> | undefined {
    return this.exporters.get(name);
  }

  /**
   * Get all valid exporter plugins
   */
  getAllExporters(): ExporterPlugin[] {
    return Array.from(this.exporters.values())
      .filter(entry => entry.isValid)
      .map(entry => entry.plugin);
  }

  // ================================
  // Plugin Validation
  // ================================

  /**
   * Validate an importer plugin
   */
  validateImporter(plugin: ImporterPlugin): PluginValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields validation
    if (!plugin.name || typeof plugin.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Plugin name is required and must be a string',
        severity: 'error',
        code: 'MISSING_NAME',
      });
    }

    if (!plugin.description || typeof plugin.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Plugin description is required and must be a string',
        severity: 'error',
        code: 'MISSING_DESCRIPTION',
      });
    }

    // Method validation
    if (typeof plugin.mapData !== 'function') {
      errors.push({
        field: 'mapData',
        message: 'mapData method is required',
        severity: 'error',
        code: 'MISSING_METHOD',
      });
    }

    if (typeof plugin.validateData !== 'function') {
      errors.push({
        field: 'validateData',
        message: 'validateData method is required',
        severity: 'error',
        code: 'MISSING_METHOD',
      });
    }

    if (typeof plugin.generateImportId !== 'function') {
      errors.push({
        field: 'generateImportId',
        message: 'generateImportId method is required',
        severity: 'error',
        code: 'MISSING_METHOD',
      });
    }

    // Array validation
    if (!Array.isArray(plugin.supportedFormats)) {
      errors.push({
        field: 'supportedFormats',
        message: 'supportedFormats must be an array',
        severity: 'error',
        code: 'INVALID_TYPE',
      });
    }

    if (!Array.isArray(plugin.requiredFields)) {
      errors.push({
        field: 'requiredFields',
        message: 'requiredFields must be an array',
        severity: 'error',
        code: 'INVALID_TYPE',
      });
    }

    // Warnings for best practices
    if (!plugin.metadata) {
      warnings.push({
        field: 'metadata',
        message: 'Plugin metadata is recommended for better documentation',
        severity: 'warning',
        code: 'MISSING_METADATA',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate an exporter plugin
   */
  validateExporter(plugin: ExporterPlugin): PluginValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields validation
    if (!plugin.name || typeof plugin.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Plugin name is required and must be a string',
        severity: 'error',
        code: 'MISSING_NAME',
      });
    }

    if (!plugin.description || typeof plugin.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Plugin description is required and must be a string',
        severity: 'error',
        code: 'MISSING_DESCRIPTION',
      });
    }

    // Method validation
    if (typeof plugin.export !== 'function') {
      errors.push({
        field: 'export',
        message: 'export method is required',
        severity: 'error',
        code: 'MISSING_METHOD',
      });
    }

    if (typeof plugin.configure !== 'function') {
      errors.push({
        field: 'configure',
        message: 'configure method is required',
        severity: 'error',
        code: 'MISSING_METHOD',
      });
    }

    if (typeof plugin.validate !== 'function') {
      errors.push({
        field: 'validate',
        message: 'validate method is required',
        severity: 'error',
        code: 'MISSING_METHOD',
      });
    }

    // Type validation
    if (!plugin.outputType || !['file', 'api', 'stream', 'console'].includes(plugin.outputType)) {
      errors.push({
        field: 'outputType',
        message: 'outputType must be one of: file, api, stream, console',
        severity: 'error',
        code: 'INVALID_OUTPUT_TYPE',
      });
    }

    if (typeof plugin.requiresNetwork !== 'boolean') {
      errors.push({
        field: 'requiresNetwork',
        message: 'requiresNetwork must be a boolean',
        severity: 'error',
        code: 'INVALID_TYPE',
      });
    }

    // Array validation
    if (!Array.isArray(plugin.supportedFormats)) {
      errors.push({
        field: 'supportedFormats',
        message: 'supportedFormats must be an array',
        severity: 'error',
        code: 'INVALID_TYPE',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ================================
  // Helper Methods
  // ================================

  /**
   * Get help message for importer selection
   */
  getImporterHelpMessage(): string {
    const available = this.listImporters();
    if (available.length === 0) {
      return 'No importers are currently available.';
    }
    return `Available importers: ${available.join(', ')}. Use 'all' to run all importers sequentially.`;
  }

  /**
   * Get help message for exporter selection
   */
  getExporterHelpMessage(): string {
    const available = this.listExporters();
    if (available.length === 0) {
      return 'No exporters are currently available.';
    }
    return `Available exporters: ${available.join(', ')}.`;
  }

  /**
   * Validate importer/exporter name and provide suggestions
   */
  validatePluginName(
    name: string,
    type: 'importer' | 'exporter'
  ): {
    valid: boolean;
    message?: string;
    suggestions?: string[];
  } {
    if (type === 'importer') {
      if (name === 'all') {
        return { valid: true };
      }

      if (this.hasImporter(name)) {
        return { valid: true };
      }

      const available = this.listImporters();
      const suggestions = available.filter(imp => imp.includes(name) || name.includes(imp));

      return {
        valid: false,
        message: `Unknown importer: "${name}". ${this.getImporterHelpMessage()}`,
        suggestions: suggestions.length > 0 ? suggestions : available,
      };
    } else {
      if (this.hasExporter(name)) {
        return { valid: true };
      }

      const available = this.listExporters();
      const suggestions = available.filter(exp => exp.includes(name) || name.includes(exp));

      return {
        valid: false,
        message: `Unknown exporter: "${name}". ${this.getExporterHelpMessage()}`,
        suggestions: suggestions.length > 0 ? suggestions : available,
      };
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    importers: { total: number; valid: number; invalid: number };
    exporters: { total: number; valid: number; invalid: number };
  } {
    const importerEntries = Array.from(this.importers.values());
    const exporterEntries = Array.from(this.exporters.values());

    return {
      importers: {
        total: importerEntries.length,
        valid: importerEntries.filter(e => e.isValid).length,
        invalid: importerEntries.filter(e => !e.isValid).length,
      },
      exporters: {
        total: exporterEntries.length,
        valid: exporterEntries.filter(e => e.isValid).length,
        invalid: exporterEntries.filter(e => !e.isValid).length,
      },
    };
  }
}

export default PluginRegistry;
