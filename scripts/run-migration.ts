#!/usr/bin/env node
/**
 * Run SQL migration file on local development database
 * Usage: npx tsx scripts/run-migration.ts <migration-file.sql>
 * Example: npx tsx scripts/run-migration.ts src/workers/migrations/000X_reassign_user_token.sql
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Get migration file path from command line
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Usage: npx tsx scripts/run-migration.ts <migration-file.sql>');
  console.error('❌ Example: npx tsx scripts/run-migration.ts src/workers/migrations/000X_reassign_user_token.sql');
  process.exit(1);
}

// Database path
const DB_PATH = process.env.DEV_DB_PATH || resolve('./_backup_database/dev.sqlite');

console.log('🔧 Running SQL migration...');
console.log('📁 Database:', DB_PATH);
console.log('📄 Migration file:', migrationFile);

try {
  // Read migration file
  const sqlContent = readFileSync(migrationFile, 'utf-8');
  console.log('\n📝 Migration SQL:');
  console.log('─'.repeat(60));
  console.log(sqlContent);
  console.log('─'.repeat(60));

  // Open database
  const db = new Database(DB_PATH);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Split SQL into individual statements (handle multi-statement files)
  const statements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  console.log(`\n🚀 Executing ${statements.length} SQL statement(s)...`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing...`);
    console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
    
    try {
      const result = db.prepare(statement).run();
      console.log(`✅ Success - Changes: ${result.changes}`);
    } catch (error) {
      console.error(`❌ Error executing statement ${i + 1}:`, error);
      throw error;
    }
  }

  db.close();
  console.log('\n✅ Migration completed successfully!');
  
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}
