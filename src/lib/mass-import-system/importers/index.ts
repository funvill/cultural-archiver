/**
 * Mass Import System - Importer Plugins Index
 *
 * Central registration point for all importer plugins.
 * This file exports all available importers and provides a registration function.
 */

import { PluginRegistry } from '../lib/plugin-registry.js';
import { vancouverPublicArtImporter } from './vancouver-public-art.js';
import { osmImporter } from './osm-artwork.js';

// ================================
// Plugin Exports
// ================================

export { vancouverPublicArtImporter } from './vancouver-public-art.js';
export { osmImporter } from './osm-artwork.js';

// ================================
// Registration Helper
// ================================

/**
 * Register all core importer plugins with the registry
 */
export function registerCoreImporters(registry: PluginRegistry): void {
  // Register Vancouver Public Art importer
  registry.registerImporter(vancouverPublicArtImporter);

  // Register OSM importer
  registry.registerImporter(osmImporter);

  console.log('Registered core importer plugins:', [
    vancouverPublicArtImporter.name,
    osmImporter.name,
  ]);
}

// ================================
// Plugin List
// ================================

export const coreImporters = [vancouverPublicArtImporter, osmImporter] as const;
