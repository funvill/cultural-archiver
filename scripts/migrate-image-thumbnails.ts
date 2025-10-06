/**
 * Migration Script: Generate Image Thumbnails for Existing Artwork
 * 
 * This script queries all existing artworks with photos and warms the image cache
 * by pre-generating thumbnail and medium variants for each image.
 * 
 * Usage (PowerShell):
 *   # Development database:
 *   $env:DATABASE_ID="your-dev-database-id"; $env:R2_BUCKET="your-dev-bucket"; npm run migrate:images:dev
 *   
 *   # Production database:
 *   $env:DATABASE_ID="your-prod-database-id"; $env:R2_BUCKET="your-prod-bucket"; npm run migrate:images:prod
 */

import { generateVariantKey } from '../src/workers/lib/image-processing';
import type { PhotoVariant } from '../src/shared/types';
import { PHOTO_SIZES } from '../src/shared/types';

// Import Cloudflare Workers types
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

// Environment variables (from wrangler or process.env)
interface MigrationEnv {
  DB: D1Database;
  R2_PHOTOS: R2Bucket;
}

interface ArtworkRecord {
  id: number;
  title: string;
  photos: string; // JSON string
}

interface ProgressStats {
  totalArtworks: number;
  totalPhotos: number;
  processedPhotos: number;
  successfulVariants: number;
  failedVariants: number;
  errors: Array<{ photo: string; variant: string; error: string }>;
  startTime: number;
  endTime?: number;
}

/**
 * Resize image data using the resizeImage function
 * Currently a placeholder - will return original until WebAssembly integration
 */
async function processImageVariant(
  originalData: ArrayBuffer,
  variant: PhotoVariant
): Promise<ArrayBuffer> {
  // For now, return the original
  // TODO: Replace with actual resizeImage() call when WASM library is integrated
  console.log(`  [PLACEHOLDER] Would resize to ${variant} variant`);
  return originalData;
}

/**
 * Generate and upload a single image variant
 */
async function generateVariant(
  env: MigrationEnv,
  originalKey: string,
  variant: PhotoVariant,
  stats: ProgressStats
): Promise<boolean> {
  try {
    const variantKey = generateVariantKey(originalKey, variant);
    
    // Check if variant already exists
    const existing = await env.R2_PHOTOS.head(variantKey);
    if (existing) {
      console.log(`    ✓ Variant ${variant} already exists: ${variantKey}`);
      stats.successfulVariants++;
      return true;
    }

    // Fetch original image
    const original = await env.R2_PHOTOS.get(originalKey);
    if (!original) {
      console.error(`    ✗ Original not found: ${originalKey}`);
      stats.errors.push({
        photo: originalKey,
        variant,
        error: 'Original image not found in R2',
      });
      stats.failedVariants++;
      return false;
    }

    const originalData = await original.arrayBuffer();
    
    // Process the image
    const variantData = await processImageVariant(originalData, variant);

    // Get size configuration
    const sizeConfig = PHOTO_SIZES[variant];
    if (!sizeConfig && variant !== 'original') {
      throw new Error(`Invalid variant: ${variant}`);
    }

    // Upload variant to R2
    await env.R2_PHOTOS.put(variantKey, variantData, {
      httpMetadata: {
        contentType: original.httpMetadata?.contentType || 'image/jpeg',
      },
      customMetadata: {
        'Original-Key': originalKey,
        'Variant': variant,
        'Generated-At': new Date().toISOString(),
        'Width': sizeConfig?.width.toString() || 'original',
        'Height': sizeConfig?.height.toString() || 'original',
        'Migration-Script': 'true',
      },
    });

    console.log(`    ✓ Generated ${variant}: ${variantKey}`);
    stats.successfulVariants++;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`    ✗ Failed to generate ${variant} for ${originalKey}:`, errorMessage);
    stats.errors.push({
      photo: originalKey,
      variant,
      error: errorMessage,
    });
    stats.failedVariants++;
    return false;
  }
}

/**
 * Process a single photo - generate all variants
 */
async function processPhoto(
  env: MigrationEnv,
  photoKey: string,
  stats: ProgressStats,
  variants: PhotoVariant[] = ['thumbnail', 'medium']
): Promise<void> {
  console.log(`  Processing: ${photoKey}`);
  
  for (const variant of variants) {
    await generateVariant(env, photoKey, variant, stats);
  }
  
  stats.processedPhotos++;
}

/**
 * Main migration function
 */
export async function migrateImageThumbnails(
  env: MigrationEnv,
  options: {
    batchSize?: number;
    variants?: PhotoVariant[];
    dryRun?: boolean;
  } = {}
): Promise<ProgressStats> {
  const { batchSize = 10, variants = ['thumbnail', 'medium'], dryRun = false } = options;

  const stats: ProgressStats = {
    totalArtworks: 0,
    totalPhotos: 0,
    processedPhotos: 0,
    successfulVariants: 0,
    failedVariants: 0,
    errors: [],
    startTime: Date.now(),
  };

  console.log('='.repeat(80));
  console.log('Image Thumbnail Migration Script');
  console.log('='.repeat(80));
  console.log(`Batch size: ${batchSize}`);
  console.log(`Variants to generate: ${variants.join(', ')}`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // Query all approved artworks with photos
    const query = `
      SELECT id, title, photos
      FROM artworks
      WHERE status = 'approved'
        AND photos IS NOT NULL
        AND photos != '[]'
      ORDER BY id ASC
    `;

    const result = await env.DB.prepare(query).all<ArtworkRecord>();
    
    if (!result.success || !result.results) {
      throw new Error('Failed to query artworks from database');
    }

    stats.totalArtworks = result.results.length;
    console.log(`Found ${stats.totalArtworks} artworks with photos\n`);

    // Process each artwork
    for (let i = 0; i < result.results.length; i++) {
      const artwork = result.results[i];
      
      try {
        const photos = JSON.parse(artwork.photos) as string[];
        if (!Array.isArray(photos) || photos.length === 0) {
          continue;
        }

        stats.totalPhotos += photos.length;
        console.log(`\n[${i + 1}/${stats.totalArtworks}] Artwork: ${artwork.title} (ID: ${artwork.id})`);
        console.log(`  Photos: ${photos.length}`);

        if (dryRun) {
          console.log(`  [DRY RUN] Would process ${photos.length} photos`);
          continue;
        }

        // Process photos in batches
        for (let j = 0; j < photos.length; j += batchSize) {
          const batch = photos.slice(j, Math.min(j + batchSize, photos.length));
          
          await Promise.all(
            batch.map((photoKey) => processPhoto(env, photoKey, stats, variants))
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to process artwork ${artwork.id}:`, errorMessage);
        stats.errors.push({
          photo: `artwork-${artwork.id}`,
          variant: 'all',
          error: errorMessage,
        });
      }

      // Progress update every 10 artworks
      if ((i + 1) % 10 === 0) {
        const elapsed = Date.now() - stats.startTime;
        const rate = stats.processedPhotos / (elapsed / 1000);
        console.log(`\n--- Progress: ${i + 1}/${stats.totalArtworks} artworks ---`);
        console.log(`    Processed: ${stats.processedPhotos}/${stats.totalPhotos} photos`);
        console.log(`    Successful: ${stats.successfulVariants} variants`);
        console.log(`    Failed: ${stats.failedVariants} variants`);
        console.log(`    Rate: ${rate.toFixed(2)} photos/sec`);
        console.log('');
      }
    }

    stats.endTime = Date.now();
    
    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('Migration Complete!');
    console.log('='.repeat(80));
    console.log(`Total artworks: ${stats.totalArtworks}`);
    console.log(`Total photos: ${stats.totalPhotos}`);
    console.log(`Processed photos: ${stats.processedPhotos}`);
    console.log(`Successful variants: ${stats.successfulVariants}`);
    console.log(`Failed variants: ${stats.failedVariants}`);
    console.log(`Duration: ${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s`);
    console.log('');

    if (stats.errors.length > 0) {
      console.log('Errors:');
      stats.errors.slice(0, 20).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.photo} (${err.variant}): ${err.error}`);
      });
      if (stats.errors.length > 20) {
        console.log(`  ... and ${stats.errors.length - 20} more errors`);
      }
    }

    return stats;
  } catch (error) {
    stats.endTime = Date.now();
    console.error('\nMigration failed:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('This script must be run through Wrangler:');
  console.error('  npx wrangler d1 execute <DATABASE_NAME> --remote --file=./scripts/migrate-image-thumbnails.ts');
  process.exit(1);
}
