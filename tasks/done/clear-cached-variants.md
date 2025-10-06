# Clear Cached Image Variants Script

## Overview

This script clears all cached image variants (thumbnail, medium, large) from R2 storage while keeping original images intact. This is useful when you need to force regeneration of all image variants, such as after changing the image processing implementation.

## Use Cases

- **After updating image resizing code** - Force regeneration with new resizing algorithm
- **After changing variant sizes** - Regenerate all variants with new dimensions
- **After fixing image quality issues** - Regenerate with corrected quality settings
- **Storage cleanup** - Remove old variants that don't match current specifications

## How It Works

The script:
1. Lists all objects in the R2 bucket
2. Identifies variants by the `__WIDTHxHEIGHT` pattern in filenames
3. Optionally deletes variants while preserving originals
4. Provides statistics on space freed and items processed

### Variant Detection

Variants are identified by filename pattern:
- **Original**: `20251005-225315-ce7400e9-1000020874.jpg`
- **Variant**: `20251005-225315-ce7400e9-1000020874__1024x1024.jpg`

The pattern `__\d+x\d+\.(jpg|jpeg|png|webp|avif)` identifies:
- `__400x400.jpg` - thumbnail variant
- `__800x800.jpg` - old medium variant  
- `__1024x1024.jpg` - new medium variant
- `__1200x1200.jpg` - large variant

## Usage

### Show Help

```powershell
npm run clear-variants -- --help
```

### Preview Deletions (Dry Run)

**Development environment:**
```powershell
npm run clear-variants -- --dry-run
```

**Production environment:**
```powershell
npm run clear-variants -- --env=production --dry-run
# OR use the shortcut:
npm run clear-variants:prod
```

### Actually Delete Variants

**Development environment:**
```powershell
npm run clear-variants -- --confirm
```

**Production environment:**
```powershell
npm run clear-variants -- --env=production --confirm
# OR use the shortcut:
npm run clear-variants:prod:confirm
```

## Safety Features

### Dry Run by Default
The script defaults to dry-run mode (`--dry-run` is the default). You must explicitly use `--confirm` to actually delete files.

### Production Warning
When targeting production with `--confirm`, the script:
- Shows a warning message
- Waits 5 seconds before proceeding
- Allows you to press Ctrl+C to cancel

### Sample Preview
Shows the first 10 variants that will be deleted so you can verify the selection.

### No Original Deletion
The script **never** deletes original images - only variants with the `__WIDTHxHEIGHT` pattern.

## Output Example

```
🗑️  Clear Cached Image Variants Script
═══════════════════════════════════════
Environment: production
Mode: 🔍 DRY RUN (preview only)
═══════════════════════════════════════

📋 Listing all objects in R2 bucket (production)...

📊 Scan Results:
   Total objects: 450
   Original images: 150
   Cached variants: 300
   Variants total size: 45.23 MB

📝 Sample variants to be deleted (first 10):
   - artworks/2025/10/05/image1__400x400.jpg (45.12 KB)
   - artworks/2025/10/05/image1__800x800.jpg (123.45 KB)
   - artworks/2025/10/05/image1__1024x1024.jpg (198.76 KB)
   - artworks/2025/10/05/image1__1200x1200.jpg (287.34 KB)
   ... and 296 more

🔍 DRY RUN MODE - No files were deleted
   Run with --confirm to actually delete these variants
   Command: npm run clear-variants -- --env=production --confirm
```

## After Running

Once variants are deleted:
1. **Automatic Regeneration**: Variants are regenerated on-demand when requested
2. **New Implementation**: Uses the updated WASM image resizing code
3. **Correct Sizes**: Generates variants with current size specifications
4. **Better Quality**: Uses current quality settings

## Common Workflows

### After Updating Image Sizes

```powershell
# 1. Update PHOTO_SIZES in src/shared/types.ts
# 2. Deploy backend worker
cd src/workers
npx wrangler deploy --env production

# 3. Preview what will be deleted
npm run clear-variants:prod

# 4. Actually delete old variants
npm run clear-variants:prod:confirm

# 5. Test regeneration
# Visit a few artwork pages to trigger variant generation
```

### After Changing Image Quality

```powershell
# 1. Update PHOTO_QUALITY in src/shared/types.ts
# 2. Deploy backend
# 3. Clear variants as above
npm run clear-variants:prod:confirm
```

### Local Development Testing

```powershell
# Test with local R2 storage
npm run clear-variants -- --dry-run
npm run clear-variants -- --confirm
```

## Troubleshooting

### "No cached variants found"
- R2 bucket may be empty or contain only originals
- Check that variants were actually generated before

### "Failed to list objects"
- Verify Wrangler is logged in: `npx wrangler login`
- Check R2 bucket name matches in wrangler.toml
- Ensure you have permissions for the environment

### "Failed to delete" errors
- Check network connection
- Verify R2 bucket permissions
- Some files may be locked or in use

## Script Location

**File**: `scripts/clear-cached-variants.ts`

**Dependencies**:
- `node:util` - parseArgs for CLI arguments
- `node:child_process` - execSync for running wrangler commands

## NPM Scripts

Defined in root `package.json`:

```json
{
  "scripts": {
    "clear-variants": "tsx scripts/clear-cached-variants.ts",
    "clear-variants:prod": "tsx scripts/clear-cached-variants.ts --env production",
    "clear-variants:prod:confirm": "tsx scripts/clear-cached-variants.ts --env production --confirm"
  }
}
```

## Related Documentation

- [Image Processing](./photo-processing.md) - Image resizing implementation
- [R2 Storage](./deployment.md#r2-storage) - R2 bucket configuration
- [Database Schema](./database.md) - Photo metadata storage
