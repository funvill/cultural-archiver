#!/usr/bin/env node
/**
 * Check what tables exist in the local development database
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';

const DB_PATH = process.env.DEV_DB_PATH || resolve('./_backup_database/dev.sqlite');

console.log('🔍 Checking database tables...');
console.log('📁 Database:', DB_PATH);

try {
  const db = new Database(DB_PATH);
  
  // Get all tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();

  console.log('\n📊 Database Tables:');
  console.log('─'.repeat(60));
  tables.forEach((table: any) => {
    console.log(`  • ${table.name}`);
  });
  console.log('─'.repeat(60));
  console.log(`Total: ${tables.length} tables\n`);

  // Check for legacy token in key tables
  const checkToken = '3db6be1e-0adb-44f5-862c-028987727018';
  console.log(`\n🔎 Searching for legacy token: ${checkToken}\n`);

  // Check user_roles table
  try {
    const userRoles = db.prepare(`
      SELECT * FROM user_roles WHERE user_token = ?
    `).all(checkToken);
    console.log(`✅ user_roles: ${userRoles.length} record(s)`);
    if (userRoles.length > 0) {
      console.log('   Permissions:', userRoles.map((r: any) => r.permission).join(', '));
    }
  } catch (e) {
    console.log('❌ user_roles: table not found or error');
  }

  // Check artwork table
  try {
    const artwork = db.prepare(`
      SELECT COUNT(*) as count FROM artwork WHERE user_token = ?
    `).get(checkToken);
    console.log(`✅ artwork: ${(artwork as any).count} record(s)`);
  } catch (e) {
    console.log('❌ artwork: table not found or error');
  }

  // Check lists table
  try {
    const lists = db.prepare(`
      SELECT COUNT(*) as count FROM lists WHERE owner_token = ?
    `).get(checkToken);
    console.log(`✅ lists: ${(lists as any).count} record(s)`);
  } catch (e) {
    console.log('❌ lists: table not found or error');
  }

  // Check photos table
  try {
    const photos = db.prepare(`
      SELECT COUNT(*) as count FROM photos WHERE uploaded_by = ?
    `).get(checkToken);
    console.log(`✅ photos: ${(photos as any).count} record(s)`);
  } catch (e) {
    console.log('❌ photos: table not found or error');
  }

  db.close();
  
} catch (error) {
  console.error('\n❌ Error:', error);
  process.exit(1);
}
