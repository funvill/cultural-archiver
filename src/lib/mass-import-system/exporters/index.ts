/**
 * Mass Import Plugin System - Core Exporters
 *
 * This module exports all the core exporter plugins for easy registration
 * and use within the mass import plugin system.
 */

import { JsonExporter } from './json-exporter.js';
import { ConsoleExporter } from './console-exporter.js';
import { ApiExporter } from './api-exporter.js';
import type { PluginRegistry } from '../lib/plugin-registry.js';

// Re-export the classes
export { JsonExporter, ConsoleExporter, ApiExporter };

// Export configuration types for convenience
export type { JsonExporterConfig, JsonExporterOptions } from './json-exporter.js';
export type { ConsoleExporterConfig, ConsoleExporterOptions } from './console-exporter.js';
export type { ApiExporterConfig, ApiExporterOptions } from './api-exporter.js';

// Core exporter plugin instances for easy registration
export const CoreExporters = {
  json: new JsonExporter(),
  console: new ConsoleExporter(),
  api: new ApiExporter(),
} as const;

// Helper function to register all core exporters
export function registerCoreExporters(registry: PluginRegistry): void {
  Object.values(CoreExporters).forEach(exporter => {
    registry.registerExporter(exporter);
  });
}
