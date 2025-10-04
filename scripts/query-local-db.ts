#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = resolve(
  __dirname,
  '..',
  'src',
  'workers',
  '.wrangler',
  'state',
  'v3',
  'd1',
  'miniflare-D1DatabaseObject',
  '4d3e137fb73a74c61b2a1f6a65612de2c11dde4bc77b3523a5ccf7e3c27f6f20.sqlite'
);

console.log('Using DB:', dbPath);
const db = new Database(dbPath, { readonly: true });

function run(query: string): void {
  try {
    const rows = db.prepare(query).all();
    console.log(JSON.stringify({ success: true, rows }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ success: false, error: String(err) }, null, 2));
  }
}

console.log('\n-- users row for admin UUID --');
run("SELECT uuid, email, status, created_at, last_login, email_verified_at FROM users WHERE uuid = '3db6be1e-0adb-44f5-862c-028987727018' LIMIT 1;");

console.log('\n-- user_roles for admin UUID --');
run("SELECT id, user_token, role, is_active, granted_at FROM user_roles WHERE user_token = '3db6be1e-0adb-44f5-862c-028987727018' AND role = 'admin';");

console.log('\n-- orphaned admin roles --');
run("SELECT ur.id, ur.user_token, ur.role, ur.is_active, ur.granted_at FROM user_roles ur LEFT JOIN users u ON ur.user_token = u.uuid WHERE ur.role = 'admin' AND ur.is_active = 1 AND u.uuid IS NULL;");

db.close();
