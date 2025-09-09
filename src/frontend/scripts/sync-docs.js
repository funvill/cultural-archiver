#!/usr/bin/env node

/**
 * Script to sync markdown documentation files to frontend public directory
 * Run this after updating terms of service or privacy policy in /docs/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File mappings - source to destination
const filesToSync = [
  {
    source: '../../../docs/terms-of-service.md',
    destination: './public/docs/terms-of-service.md',
    name: 'Terms of Service'
  },
  {
    source: '../../../docs/privacy-policy.md',
    destination: './public/docs/privacy-policy.md',
    name: 'Privacy Policy'
  }
];

console.log('🔄 Syncing legal documents to frontend...\n');

let successCount = 0;
let errorCount = 0;

filesToSync.forEach(({ source, destination, name }) => {
  try {
    const sourcePath = path.resolve(__dirname, source);
    const destPath = path.resolve(__dirname, destination);
    
    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      console.log(`❌ Source file not found: ${name} (${sourcePath})`);
      errorCount++;
      return;
    }
    
    // Create destination directory if it doesn't exist
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      console.log(`📁 Created directory: ${destDir}`);
    }
    
    // Copy the file
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Synced: ${name}`);
    successCount++;
    
  } catch (error) {
    console.log(`❌ Failed to sync ${name}: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n🎯 Sync complete: ${successCount} successful, ${errorCount} failed`);

if (successCount > 0) {
  console.log('\n💡 Remember to rebuild the frontend to include updated files:');
  console.log('   npm run build');
}

process.exit(errorCount > 0 ? 1 : 0);
