/**
 * Clear Cached Image Variants
 * 
 * This script deletes all cached image variants (thumbnail, medium, large) from R2,
 * keeping only the original images. This forces regeneration of variants with the
 * new WASM image resizing implementation.
 * 
 * Variant files are identified by the pattern: filename__WIDTHxHEIGHT.ext
 * Example: 20251005-225315-ce7400e9-1000020874__1024x1024.jpg
 * 
 * Usage:
 *   npm run clear-variants -- --env=production --dry-run
 *   npm run clear-variants -- --env=production --confirm
 */

import { parseArgs } from 'node:util';

interface DeleteStats {
  scanned: number;
  variants: number;
  originals: number;
  deleted: number;
  failed: number;
  bytes: number;
}

/**
 * Check if a key is a variant (contains __WIDTHxHEIGHT pattern)
 */
function isVariant(key: string): boolean {
  // Match pattern: filename__400x400.jpg or filename__1024x1024.png etc
  const variantPattern = /__\d+x\d+\.(jpg|jpeg|png|webp|avif)$/i;
  return variantPattern.test(key);
}

/**
 * List all objects in R2 bucket
 */
async function listAllObjects(env: string): Promise<Array<{ key: string; size: number }>> {
  console.log(`\n📋 Listing all objects in R2 bucket (${env})...`);
  
  const command = env === 'production' 
    ? 'npx wrangler r2 object list public-art-registry-photos --remote --env production'
    : 'npx wrangler r2 object list public-art-registry-photos --local';
  
  // Use dynamic import for node:child_process
  const { execSync } = await import('node:child_process');
  
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true' }
    });
    
    // Parse the JSON output from wrangler
    const lines = output.split('\n');
    const objects: Array<{ key: string; size: number }> = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(line);
          if (Array.isArray(parsed)) {
            objects.push(...parsed.map((obj: { key: string; size?: number }) => ({
              key: obj.key,
              size: obj.size || 0
            })));
          } else if (parsed.objects) {
            objects.push(...parsed.objects.map((obj: { key: string; size?: number }) => ({
              key: obj.key,
              size: obj.size || 0
            })));
          }
        } catch {
          // Skip lines that aren't JSON
        }
      }
    }
    
    return objects;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to list objects:', message);
    throw error;
  }
}

/**
 * Delete a single object from R2
 */
async function deleteObject(key: string, env: string): Promise<boolean> {
  const bucketPath = `public-art-registry-photos/${key}`;
  const command = env === 'production'
    ? `npx wrangler r2 object delete "${bucketPath}" --remote --env production`
    : `npx wrangler r2 object delete "${bucketPath}" --local`;
  
  const { execSync } = await import('node:child_process');
  
  try {
    execSync(command, { 
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env, CI: 'true' }
    });
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to delete ${key}`);
    return false;
  }
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      env: { type: 'string', default: 'development' },
      'dry-run': { type: 'boolean', default: true },
      confirm: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(`
Clear Cached Image Variants Script

This script deletes all cached image variants from R2, keeping only originals.

Usage:
  npm run clear-variants -- --env=production --dry-run     # Preview what will be deleted
  npm run clear-variants -- --env=production --confirm      # Actually delete variants

Options:
  --env=<environment>    Target environment (development|production) [default: development]
  --dry-run              Preview mode - don't actually delete [default: true]
  --confirm              Actually delete variants (disables dry-run)
  --help                 Show this help message

Examples:
  # Preview deletions for production
  npm run clear-variants -- --env=production --dry-run

  # Actually delete variants in production
  npm run clear-variants -- --env=production --confirm

  # Preview deletions for local development
  npm run clear-variants -- --dry-run
    `);
    return;
  }

  const env = values.env as string;
  const dryRun = !values.confirm;

  console.log('\n🗑️  Clear Cached Image Variants Script');
  console.log('═══════════════════════════════════════');
  console.log(`Environment: ${env}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚠️  CONFIRM (will delete)'}`);
  console.log('═══════════════════════════════════════\n');

  if (!dryRun && env === 'production') {
    console.log('⚠️  WARNING: You are about to delete variants in PRODUCTION!');
    console.log('⚠️  This will force regeneration of all image variants.');
    console.log('⚠️  Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const stats: DeleteStats = {
    scanned: 0,
    variants: 0,
    originals: 0,
    deleted: 0,
    failed: 0,
    bytes: 0,
  };

  // List all objects
  const objects = await listAllObjects(env);
  stats.scanned = objects.length;
  
  console.log(`\n📊 Scan Results:`);
  console.log(`   Total objects: ${objects.length}`);
  
  // Identify variants
  const variants = objects.filter(obj => isVariant(obj.key));
  const originals = objects.filter(obj => !isVariant(obj.key));
  
  stats.variants = variants.length;
  stats.originals = originals.length;
  stats.bytes = variants.reduce((sum, obj) => sum + obj.size, 0);
  
  console.log(`   Original images: ${originals.length}`);
  console.log(`   Cached variants: ${variants.length}`);
  console.log(`   Variants total size: ${formatBytes(stats.bytes)}`);
  
  if (variants.length === 0) {
    console.log('\n✅ No cached variants found. Nothing to delete.');
    return;
  }

  // Show sample of variants to be deleted
  console.log(`\n📝 Sample variants to ${dryRun ? 'be deleted' : 'delete'} (first 10):`);
  variants.slice(0, 10).forEach(obj => {
    console.log(`   - ${obj.key} (${formatBytes(obj.size)})`);
  });
  
  if (variants.length > 10) {
    console.log(`   ... and ${variants.length - 10} more`);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No files were deleted');
    console.log('   Run with --confirm to actually delete these variants');
    console.log(`   Command: npm run clear-variants -- --env=${env} --confirm`);
    return;
  }

  // Actually delete variants
  console.log(`\n🗑️  Deleting ${variants.length} variants...`);
  
  let progress = 0;
  for (const obj of variants) {
    progress++;
    
    if (progress % 10 === 0 || progress === variants.length) {
      process.stdout.write(`\r   Progress: ${progress}/${variants.length} (${Math.round(progress / variants.length * 100)}%)`);
    }
    
    const success = await deleteObject(obj.key, env);
    if (success) {
      stats.deleted++;
    } else {
      stats.failed++;
    }
  }
  
  console.log('\n');
  
  // Final summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 Final Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Objects scanned:    ${stats.scanned}`);
  console.log(`Originals kept:     ${stats.originals}`);
  console.log(`Variants found:     ${stats.variants}`);
  console.log(`Successfully deleted: ${stats.deleted}`);
  console.log(`Failed:             ${stats.failed}`);
  console.log(`Space freed:        ${formatBytes(stats.bytes)}`);
  console.log('═══════════════════════════════════════\n');
  
  if (stats.deleted > 0) {
    console.log('✅ Cached variants cleared successfully!');
    console.log('ℹ️  Variants will be regenerated on-demand with the new WASM resizing.');
  }
  
  if (stats.failed > 0) {
    console.log(`\n⚠️  ${stats.failed} deletions failed. Check logs above for details.`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
