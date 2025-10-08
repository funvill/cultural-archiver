/**
 * Mass Import System - Importer Plugins Index
 *
 * Central registration point for all importer plugins.
 * This file exports all available importers and provides a registration function.
 */

import { PluginRegistry } from '../lib/plugin-registry.js';
import { osmImporter } from './osm-artwork.js';
import { artistJsonImporter } from './artist-json.js';

// ================================
// Plugin Exports
// ================================

export { osmImporter } from './osm-artwork.js';
export { artistJsonImporter } from './artist-json.js';

// ================================
// Registration Helper
// ================================

/**
 * Register all core importer plugins with the registry
 */
export function registerCoreImporters(registry: PluginRegistry): void {
    // Register OSM importer
  registry.registerImporter(osmImporter);

  // Register Artist JSON importer
  registry.registerImporter(artistJsonImporter);

  console.log('Registered core importer plugins:', [
    osmImporter.name,
    artistJsonImporter.name,
  ]);
}

// ================================
// Plugin List
// ================================

export const coreImporters = [
  osmImporter,
  artistJsonImporter,
] as const;
