/**
 * Mass Import System - Importer Registry
 *
 * This module manages available data source importers and provides
 * a registry system for dynamic importer discovery and selection.
 */

import type { ImporterPlugin } from '../types/plugin.js';
import { osmImporter } from '../importers/osm-artwork.js';
import { artistJsonImporter } from '../importers/artist-json.js';

// ================================
// Importer Registry
// ================================

interface ImporterInfo {
  name: string;
  mapper: ImporterPlugin;
  description: string;
  supportedFileTypes: string[];
  defaultDataPath?: string;
}

/**
 * Registry of available importers
 */
export class ImporterRegistry {
  private static importers: Map<string, ImporterInfo> = new Map();
  private static initialized = false;

  /**
   * Initialize the registry with available importers
   */
  private static initialize(): void {
    if (this.initialized) return;

    // Register OSM importer (core)
    this.importers.set('osm', {
      name: 'osm',
      mapper: osmImporter,
      description: 'OpenStreetMap GeoJSON artwork data importer',
      supportedFileTypes: ['.geojson', '.json'],
      defaultDataPath: 'src/lib/data-collection/osm/output/merged/merged-artworks.geojson',
    });

    // Register generic Artist JSON importer (used by Burnaby output and similar)
    this.importers.set('artist-json', {
      name: 'artist-json',
      mapper: artistJsonImporter,
      description: 'Generic Artist JSON importer (Burnaby format)',
      supportedFileTypes: ['.json'],
      // Point at the artists.json output produced by the Burnaby scraper
      defaultDataPath: 'src/lib/data-collection/burnabyartgallery/output/artists.json',
    });

    this.initialized = true;
  }

  /**
   * Get all available importers
   */
  static getAll(): string[] {
    this.initialize();
    return Array.from(this.importers.keys());
  }

  /**
   * Get importer by name
   */
  static get(name: string): ImporterInfo | undefined {
    this.initialize();
    return this.importers.get(name);
  }

  /**
   * Check if importer exists
   */
  static has(name: string): boolean {
    this.initialize();
    return this.importers.has(name);
  }

  /**
   * Get importer mapper by name
   */
  static getMapper(name: string): ImporterPlugin | undefined {
    const importer = this.get(name);
    return importer?.mapper;
  }

  /**
   * Get detailed info about all importers
   */
  static getInfo(): ImporterInfo[] {
    this.initialize();
    return Array.from(this.importers.values());
  }

  /**
   * Register a new importer (for extensibility)
   */
  static register(name: string, info: Omit<ImporterInfo, 'name'>): void {
    this.initialize();
    this.importers.set(name, { name, ...info });
  }

  /**
   * Generate helpful error message for invalid importer
   */
  static getHelpMessage(): string {
    const available = this.getAll();
    return `Please specify an importer. Available importers: ${available.join(', ')}. Use 'all' to run all importers sequentially.`;
  }

  /**
   * Validate importer name and provide suggestions
   */
  static validateImporter(name: string): {
    valid: boolean;
    message?: string;
    suggestions?: string[];
  } {
    if (name === 'all') {
      return { valid: true };
    }

    if (this.has(name)) {
      return { valid: true };
    }

    const available = this.getAll();
    const suggestions = available.filter(imp => imp.includes(name) || name.includes(imp));

    return {
      valid: false,
      message: `Unknown importer: "${name}". ${this.getHelpMessage()}`,
      suggestions: suggestions.length > 0 ? suggestions : available,
    };
  }
}

export default ImporterRegistry;
