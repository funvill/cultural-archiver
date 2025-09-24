#!/usr/bin/env node
/**
 * Simple Plugin Creator Script
 *
 * Basic utility to create new plugins from templates by replacing placeholders.
 * Usage: node create-plugin.js <type> <name> [options]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ================================
// Utility Functions
// ================================

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function toPascalCase(str) {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, char => char.toUpperCase());
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ================================
// Plugin Creator
// ================================

async function createPlugin(type, name, options = {}) {
  console.log(`Creating ${type} plugin: ${name}`);

  // Create replacement mappings
  const kebabName = toKebabCase(name);
  const className = toPascalCase(name);
  const instanceName = toCamelCase(name);
  const dataTypeName = className + 'Record';

  const replacements = {
    '{{PLUGIN_NAME}}': name,
    '{{PLUGIN_DESCRIPTION}}': options.description || `${name} ${type}`,
    '{{DATA_SOURCE}}': options.dataSource || 'Custom Data Source',
    '{{SUPPORTED_FORMATS}}': options.formats || 'json',
    '{{SUPPORTED_FORMATS_ARRAY}}': `'${(options.formats || 'json').split(',').join("', '")}'`,
    '{{REQUIRED_FIELDS_ARRAY}}': "'id', 'coordinates'",
    '{{OPTIONAL_FIELDS_ARRAY}}': "'name', 'description'",
    '{{AUTHOR_NAME}}': options.author || 'Cultural Archiver Team',
    '{{PLUGIN_CLASS_NAME}}': className,
    '{{PLUGIN_KEBAB_NAME}}': kebabName,
    '{{PLUGIN_INSTANCE_NAME}}': instanceName,
    '{{DATA_TYPE_NAME}}': dataTypeName,
    '{{OUTPUT_FORMAT}}': options.outputFormat || 'JSON',
    '{{REQUIRES_NETWORK}}': options.requiresNetwork || 'false',
    '{{OUTPUT_TYPE}}': options.outputType || 'file',
  };

  try {
    // Read template
    const templatePath = path.join(__dirname, 'templates', type, `${type}-template.ts`);
    let templateContent = await fs.readFile(templatePath, 'utf-8');

    // Replace placeholders
    for (const [placeholder, value] of Object.entries(replacements)) {
      templateContent = templateContent.replace(
        new RegExp(placeholder.replace(/[{}]/g, '\\\\$&'), 'g'),
        value
      );
    }

    // Write plugin file
    const outputPath = path.join(__dirname, 'src', `${type}s`, `${kebabName}.ts`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, templateContent);

    console.log(`✅ Plugin created: ${outputPath}`);

    // Create config file
    const configPath = path.join(__dirname, 'configs', `${kebabName}.json`);
    const configContent = {
      [type]: {
        ...(type === 'importer' && {
          dataFile: `./data/${kebabName}-data.json`,
          processingMode: 'sequential',
        }),
        ...(type === 'exporter' && {
          verbose: true,
          outputPath: `./output/${kebabName}-export.json`,
        }),
      },
    };

    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(configContent, null, 2));

    console.log(`📄 Config created: ${configPath}`);
    console.log(`\\n🎉 Plugin '${name}' created successfully!`);
    console.log(`\\nNext steps:`);
    console.log(`1. Edit ${outputPath} to implement your logic`);
    console.log(`2. Add your plugin to src/${type}s/index.ts`);
    console.log(`3. Test with: npm run build && node dist/cli/plugin-cli.js list-plugins`);
  } catch (error) {
    console.error(`❌ Failed to create plugin:`, error.message);
    process.exit(1);
  }
}

// ================================
// CLI Interface
// ================================

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log(`Usage: node create-plugin.js <type> <name> [options]`);
  console.log(`\\nTypes: importer, exporter`);
  console.log(`\\nExamples:`);
  console.log(`  node create-plugin.js importer "Instagram Art"`);
  console.log(`  node create-plugin.js exporter "Email Notification"`);
  process.exit(1);
}

const [type, name] = args;
if (!['importer', 'exporter'].includes(type)) {
  console.error(`❌ Invalid type: ${type}. Must be 'importer' or 'exporter'`);
  process.exit(1);
}

// Parse simple options (could be enhanced)
const options = {};
createPlugin(type, name, options);
