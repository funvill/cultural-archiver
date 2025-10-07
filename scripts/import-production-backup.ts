#!/usr/bin/env tsx
/**
 * Import production database backup
 * This script imports data from a SQL backup file into the production D1 database
 * using the Cloudflare API directly to work around wrangler transaction size limits
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const BATCH_SIZE = 100; // Process 100 INSERT statements at a time
const DELAY_MS = 500; // Delay between batches to avoid rate limiting

async function importBackup(): Promise<void> {
  console.log('📦 Starting production database import...\n');
  
  // Read the filtered SQL file
  const sqlFile = '_backup_database/production_import_final.sql';
  const content = readFileSync(sqlFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  console.log(`📄 Loaded ${lines.length} SQL statements from ${sqlFile}`);
  
  // Group statements into batches
  const batches: string[][] = [];
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    batches.push(lines.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`📊 Split into ${batches.length} batches of max ${BATCH_SIZE} statements each\n`);
  
  let successCount = 0;
  let failureCount = 0;
  
  // Import each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;
    
    try {
      // Create temporary file for this batch
      const batchFile = `_backup_database/temp_batch_${batchNum}.sql`;
      const batchContent = batch.join('\n');
      require('fs').writeFileSync(batchFile, batchContent, 'utf-8');
      
      // Execute the batch using wrangler
      console.log(`[${batchNum}/${batches.length}] Importing batch (${batch.length} statements)...`);
      
      const command = `npx wrangler d1 execute public-art-registry --env production --remote --config src/workers/wrangler.toml --file ${batchFile} --yes`;
      
      execSync(command, {
        env: { ...process.env, CI: 'true' },
        stdio: 'pipe',
      });
      
      successCount++;
      console.log(`  ✅ Success`);
      
      // Clean up temp file
      require('fs').unlinkSync(batchFile);
      
      // Delay between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
      
    } catch (error) {
      failureCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a duplicate key error (already imported)
      if (errorMessage.includes('UNIQUE constraint') || errorMessage.includes('already exists')) {
        console.log(`  ⏭️  Skipped (data already exists)`);
      } else {
        console.error(`  ❌ Failed: ${errorMessage.split('\n')[0]}`);
      }
    }
  }
  
  console.log(`\n📊 Import Summary:`);
  console.log(`   ✅ Successful batches: ${successCount}`);
  console.log(`   ❌ Failed batches: ${failureCount}`);
  console.log(`   📦 Total batches: ${batches.length}`);
}

importBackup().catch(console.error);
