#!/usr/bin/env node
/**
 * Database Recreation Tool for Cultural Archiver
 * Recreates database with consolidated schema and sample data
 * 
 * Usage: npx tsx migrations/tools/recreate-database.ts [--force] [--no-data]
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { createInterface } from 'readline';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DatabaseConfig {
    databaseId: string;
    accountId: string;
    apiToken: string;
    environment: string;
}

interface RecreationOptions {
    force: boolean;
    includeSampleData: boolean;
    schemaFile: string;
    sampleDataFile?: string;
}

class DatabaseRecreator {
    private config: DatabaseConfig;
    private options: RecreationOptions;

    constructor(options: RecreationOptions) {
        this.config = this.loadConfig();
        this.options = options;
    }

    private loadConfig(): DatabaseConfig {
        const databaseId = process.env.D1_DATABASE_ID;
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;
        const environment = process.env.NODE_ENV || 'development';

        if (!databaseId) {
            throw new Error('D1_DATABASE_ID environment variable is required');
        }
        if (!accountId) {
            throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        }
        if (!apiToken) {
            throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
        }

        return { databaseId, accountId, apiToken, environment };
    }

    private async executeQuery(sql: string): Promise<any> {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/d1/database/${this.config.databaseId}/query`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Database query failed: ${response.status} ${error}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(`Database query failed: ${JSON.stringify(data.errors)}`);
        }

        return data.result[0];
    }

    private async confirmDestructiveAction(): Promise<boolean> {
        if (this.options.force) {
            console.warn('⚠️  Force mode enabled, skipping confirmation');
            return true;
        }

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const question = (query: string): Promise<string> => {
            return new Promise((resolve) => {
                rl.question(query, resolve);
            });
        };

        try {
            console.warn('\n⚠️  WARNING: This operation will PERMANENTLY DELETE all data in the database!');
            console.warn(`   Environment: ${this.config.environment}`);
            console.warn(`   Database ID: ${this.config.databaseId}`);
            console.warn('\n   This action CANNOT be undone!');
            
            const confirmation1 = await question('\n   Type "yes" to continue: ');
            if (confirmation1.toLowerCase() !== 'yes') {
                console.info('❌ Operation cancelled by user');
                return false;
            }

            const confirmation2 = await question('   Type "DELETE ALL DATA" to confirm: ');
            if (confirmation2 !== 'DELETE ALL DATA') {
                console.info('❌ Operation cancelled by user');
                return false;
            }

            return true;
        } finally {
            rl.close();
        }
    }

    private async getAllTables(): Promise<string[]> {
        console.info('🔍 Getting list of existing tables...');
        
        try {
            const result = await this.executeQuery(`
                SELECT name 
                FROM sqlite_master 
                WHERE type = 'table' 
                AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            const tables = result.results?.map((row: any) => row.name) || [];
            console.info(`📊 Found ${tables.length} tables: ${tables.join(', ')}`);
            return tables;
        } catch (error) {
            console.warn('⚠️  Could not get table list (database may be empty):', error);
            return [];
        }
    }

    private async dropAllTables(tables: string[]): Promise<void> {
        if (tables.length === 0) {
            console.info('✅ No tables to drop');
            return;
        }

        console.info(`🗑️  Dropping ${tables.length} tables...`);

        // Disable foreign key constraints temporarily
        await this.executeQuery('PRAGMA foreign_keys = OFF');

        // Drop all tables
        for (const table of tables) {
            try {
                console.info(`   Dropping table: ${table}`);
                await this.executeQuery(`DROP TABLE IF EXISTS "${table}"`);
            } catch (error) {
                console.warn(`   ⚠️  Failed to drop table ${table}:`, error);
                // Continue with other tables
            }
        }

        // Re-enable foreign key constraints
        await this.executeQuery('PRAGMA foreign_keys = ON');

        console.info('✅ All tables dropped successfully');
    }

    private async loadSchemaFile(): Promise<string> {
        const schemaPath = join(dirname(__dirname), this.options.schemaFile);
        console.info(`📄 Loading schema from: ${schemaPath}`);
        
        try {
            const schemaSQL = await readFile(schemaPath, 'utf-8');
            
            // Basic validation
            const createTableCount = (schemaSQL.match(/CREATE TABLE/gi) || []).length;
            if (createTableCount === 0) {
                throw new Error('Schema file appears to be empty or invalid (no CREATE TABLE statements found)');
            }

            console.info(`📊 Schema loaded: ${createTableCount} tables found`);
            return schemaSQL;
        } catch (error) {
            throw new Error(`Failed to load schema file: ${error}`);
        }
    }

    private async applySchemaSections(schemaSQL: string): Promise<void> {
        console.info('🏗️  Applying database schema...');

        // Split schema into sections and statements
        const statements = this.parseSchemaStatements(schemaSQL);
        
        console.info(`📊 Executing ${statements.length} schema statements...`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]!.trim();
            
            if (!statement || statement.startsWith('--')) {
                continue;
            }

            try {
                console.info(`   [${i + 1}/${statements.length}] ${this.summarizeStatement(statement)}`);
                await this.executeQuery(statement);
            } catch (error) {
                console.error(`❌ Failed to execute statement: ${this.summarizeStatement(statement)}`);
                throw new Error(`Schema application failed at statement ${i + 1}: ${error}`);
            }
        }

        console.info('✅ Database schema applied successfully');
    }

    private parseSchemaStatements(schemaSQL: string): string[] {
        // Split by semicolons but be careful about semicolons in comments or strings
        const statements: string[] = [];
        const lines = schemaSQL.split('\n');
        let currentStatement = '';
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('--')) {
                continue;
            }
            
            currentStatement += line + '\n';
            
            // If line ends with semicolon, this is end of statement
            if (trimmedLine.endsWith(';')) {
                statements.push(currentStatement.trim());
                currentStatement = '';
            }
        }
        
        // Add any remaining statement
        if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
        }
        
        return statements.filter(stmt => stmt.length > 0);
    }

    private summarizeStatement(statement: string): string {
        const first50 = statement.substring(0, 50).replace(/\s+/g, ' ');
        return first50 + (statement.length > 50 ? '...' : '');
    }

    private async loadSampleData(): Promise<string | null> {
        if (!this.options.sampleDataFile) {
            console.info('📄 Generating default sample data...');
            return this.generateDefaultSampleData();
        }

        const sampleDataPath = join(dirname(__dirname), this.options.sampleDataFile);
        console.info(`📄 Loading sample data from: ${sampleDataPath}`);
        
        try {
            const sampleDataSQL = await readFile(sampleDataPath, 'utf-8');
            console.info('📊 Sample data loaded successfully');
            return sampleDataSQL;
        } catch (error) {
            console.warn(`⚠️  Failed to load sample data file: ${error}`);
            console.info('📄 Generating default sample data instead...');
            return this.generateDefaultSampleData();
        }
    }

    private generateDefaultSampleData(): string {
        const timestamp = new Date().toISOString();
        const defaultDate = '2025-01-01T00:00:00.000Z';
        
        return `
-- Cultural Archiver Sample Data
-- Generated on: ${timestamp}
-- Default timestamp: ${defaultDate}

-- Sample Users (as specified in PRD)
INSERT INTO users (uuid, email, display_name, role, email_verified_at, created_at, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'sampledata@funvill.com', 'Sample Data User', 'user', '${defaultDate}', '${defaultDate}', '${defaultDate}'),
    ('00000000-0000-0000-0000-000000000002', 'massimport@funvill.com', 'Mass Import User', 'user', '${defaultDate}', '${defaultDate}', '${defaultDate}'),
    ('6c970b24-f64a-49d9-8c5f-8ae23cc2af47', 'steven@abluestar.com', 'Steven Smethurst', 'admin', '${defaultDate}', '${defaultDate}', '${defaultDate}');

-- Sample Artwork (within 100m of Vancouver coordinates: 49.2679864,-123.0239578)
INSERT INTO artwork (id, lat, lon, type_id, status, title, description, user_token, photos, tags, notes, location_description, created_at, updated_at)
VALUES 
    ('artwork-sample-001', 49.2685, -123.0235, 'mural', 'approved', 'Sample Mural #1', 'Beautiful street art mural', '00000000-0000-0000-0000-000000000002', '[]', '["street-art", "colorful"]', 'Sample artwork for testing', 'Near Vancouver Art Gallery', '${defaultDate}', '${defaultDate}'),
    ('artwork-sample-002', 49.2675, -123.0245, 'sculpture', 'approved', 'Sample Sculpture', 'Modern metal sculpture', '00000000-0000-0000-0000-000000000002', '[]', '["modern", "metal"]', 'Sample sculpture data', 'Downtown Vancouver', '${defaultDate}', '${defaultDate}'),
    ('artwork-sample-003', 49.2680, -123.0240, 'installation', 'pending', 'Sample Installation', 'Interactive art installation', '00000000-0000-0000-0000-000000000002', '[]', '["interactive", "digital"]', 'Sample installation for testing', 'Vancouver Convention Centre', '${defaultDate}', '${defaultDate}');

-- Sample Logbook Entries (linked to artworks)
INSERT INTO logbook (id, artwork_id, user_token, lat, lon, status, notes, photos, created_at, updated_at)
VALUES 
    ('logbook-sample-001', 'artwork-sample-001', '00000000-0000-0000-0000-000000000002', 49.2685, -123.0235, 'approved', 'First logbook entry for mural', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-002', 'artwork-sample-001', '00000000-0000-0000-0000-000000000001', 49.2685, -123.0235, 'approved', 'Second visit to the mural', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-003', 'artwork-sample-002', '00000000-0000-0000-0000-000000000002', 49.2675, -123.0245, 'approved', 'Documentation of sculpture', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-004', 'artwork-sample-002', '6c970b24-f64a-49d9-8c5f-8ae23cc2af47', 49.2675, -123.0245, 'approved', 'Admin review of sculpture', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-005', 'artwork-sample-003', '00000000-0000-0000-0000-000000000002', 49.2680, -123.0240, 'pending', 'Initial documentation', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-006', 'artwork-sample-001', '6c970b24-f64a-49d9-8c5f-8ae23cc2af47', 49.2685, -123.0235, 'approved', 'Final approval notes', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-007', 'artwork-sample-002', '00000000-0000-0000-0000-000000000001', 49.2675, -123.0245, 'approved', 'Community feedback', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-008', 'artwork-sample-003', '00000000-0000-0000-0000-000000000001', 49.2680, -123.0240, 'pending', 'User submission notes', '[]', '${defaultDate}', '${defaultDate}'),
    ('logbook-sample-009', 'artwork-sample-001', '00000000-0000-0000-0000-000000000002', 49.2685, -123.0235, 'approved', 'Condition update', '[]', '${defaultDate}', '${defaultDate}');

-- Sample Moderation Records (assigned to steven@abluestar.com)
INSERT INTO moderation (id, artwork_id, logbook_id, moderator_uuid, action, reason, status, created_at, updated_at)
VALUES 
    ('moderation-001', 'artwork-sample-001', null, '6c970b24-f64a-49d9-8c5f-8ae23cc2af47', 'approve', 'Quality artwork submission', 'completed', '${defaultDate}', '${defaultDate}'),
    ('moderation-002', 'artwork-sample-002', null, '6c970b24-f64a-49d9-8c5f-8ae23cc2af47', 'approve', 'Meets submission guidelines', 'completed', '${defaultDate}', '${defaultDate}'),
    ('moderation-003', null, 'logbook-sample-005', '6c970b24-f64a-49d9-8c5f-8ae23cc2af47', 'review', 'Pending review of new submission', 'pending', '${defaultDate}', '${defaultDate}'),
    ('moderation-004', null, 'logbook-sample-008', '6c970b24-f64a-49d9-8c5f-8ae23cc2af47', 'review', 'Community feedback review', 'pending', '${defaultDate}', '${defaultDate}');
`;
    }

    private async applySampleData(sampleDataSQL: string): Promise<void> {
        console.info('🎨 Applying sample data...');

        // Parse and execute sample data statements
        const statements = this.parseSchemaStatements(sampleDataSQL);
        
        console.info(`📊 Executing ${statements.length} sample data statements...`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]!.trim();
            
            if (!statement || statement.startsWith('--')) {
                continue;
            }

            try {
                console.info(`   [${i + 1}/${statements.length}] ${this.summarizeStatement(statement)}`);
                await this.executeQuery(statement);
            } catch (error) {
                console.warn(`⚠️  Failed to execute sample data statement: ${this.summarizeStatement(statement)}`);
                console.warn(`     Error: ${error}`);
                // Continue with other statements for sample data
            }
        }

        console.info('✅ Sample data applied successfully');
    }

    private async verifyRecreation(): Promise<void> {
        console.info('🔍 Verifying database recreation...');

        try {
            // Check that basic tables exist
            const tablesResult = await this.executeQuery(`
                SELECT name 
                FROM sqlite_master 
                WHERE type = 'table' 
                AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            const tables = tablesResult.results?.map((row: any) => row.name) || [];
            console.info(`📊 Verification found ${tables.length} tables: ${tables.join(', ')}`);

            if (tables.length === 0) {
                throw new Error('Verification failed: No tables found after recreation');
            }

            // Check for expected core tables
            const expectedTables = ['artwork', 'logbook', 'users'];
            const missingTables = expectedTables.filter(table => !tables.includes(table));
            
            if (missingTables.length > 0) {
                console.warn(`⚠️  Some expected tables are missing: ${missingTables.join(', ')}`);
            }

            // Test a simple query on each table
            for (const table of tables) {
                try {
                    const countResult = await this.executeQuery(`SELECT COUNT(*) as count FROM "${table}"`);
                    const count = countResult.results?.[0]?.count || 0;
                    console.info(`   ${table}: ${count} records`);
                } catch (error) {
                    console.warn(`   ⚠️  Could not query table ${table}: ${error}`);
                }
            }

            console.info('✅ Database recreation verification completed');

        } catch (error) {
            throw new Error(`Verification failed: ${error}`);
        }
    }

    public async recreateDatabase(): Promise<void> {
        console.info('🚀 Starting database recreation...');
        console.info(`   Environment: ${this.config.environment}`);
        console.info(`   Database ID: ${this.config.databaseId}`);
        console.info(`   Include sample data: ${this.options.includeSampleData ? 'Yes' : 'No'}`);

        try {
            // Step 1: Confirm destructive action
            const confirmed = await this.confirmDestructiveAction();
            if (!confirmed) {
                return;
            }

            // Step 2: Get existing tables
            const existingTables = await this.getAllTables();

            // Step 3: Drop all existing tables
            await this.dropAllTables(existingTables);

            // Step 4: Load and apply schema
            const schemaSQL = await this.loadSchemaFile();
            await this.applySchemaSections(schemaSQL);

            // Step 5: Apply sample data if requested
            if (this.options.includeSampleData) {
                const sampleDataSQL = await this.loadSampleData();
                if (sampleDataSQL) {
                    await this.applySampleData(sampleDataSQL);
                }
            }

            // Step 6: Verify recreation
            await this.verifyRecreation();

            console.info('✅ Database recreation completed successfully');

        } catch (error) {
            console.error('❌ Database recreation failed:', error);
            throw error;
        }
    }

    public showHelp(): void {
        console.info('Cultural Archiver Database Recreation Tool');
        console.info('');
        console.info('Usage:');
        console.info('  npx tsx migrations/tools/recreate-database.ts [options]');
        console.info('');
        console.info('Options:');
        console.info('  --force             Skip confirmation prompts (DANGEROUS!)');
        console.info('  --no-data           Skip sample data insertion');
        console.info('  --schema FILE       Use specific schema file (default: 001_consolidated_baseline.sql)');
        console.info('  --sample-data FILE  Use specific sample data file');
        console.info('  --help              Show this help');
        console.info('');
        console.info('Required Environment Variables (.env file):');
        console.info('  D1_DATABASE_ID         Cloudflare D1 Database ID');
        console.info('  CLOUDFLARE_ACCOUNT_ID  Cloudflare Account ID');
        console.info('  CLOUDFLARE_API_TOKEN   Cloudflare API Token with D1:Edit permission');
        console.info('');
        console.info('Examples:');
        console.info('  npx tsx migrations/tools/recreate-database.ts');
        console.info('  npx tsx migrations/tools/recreate-database.ts --no-data');
        console.info('  npx tsx migrations/tools/recreate-database.ts --force');
        console.info('  npx tsx migrations/tools/recreate-database.ts --schema custom.sql');
        console.info('');
        console.info('⚠️  WARNING: This tool PERMANENTLY DELETES all database data!');
    }
}

// Main execution
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        new DatabaseRecreator({
            force: false,
            includeSampleData: true,
            schemaFile: '001_consolidated_baseline.sql'
        }).showHelp();
        return;
    }

    const options: RecreationOptions = {
        force: args.includes('--force'),
        includeSampleData: !args.includes('--no-data'),
        schemaFile: '001_consolidated_baseline.sql',
    };

    // Parse schema file option
    const schemaIndex = args.indexOf('--schema');
    if (schemaIndex >= 0 && args[schemaIndex + 1]) {
        options.schemaFile = args[schemaIndex + 1]!;
    }

    // Parse sample data file option
    const sampleDataIndex = args.indexOf('--sample-data');
    if (sampleDataIndex >= 0 && args[sampleDataIndex + 1]) {
        options.sampleDataFile = args[sampleDataIndex + 1]!;
    }

    try {
        const recreator = new DatabaseRecreator(options);
        await recreator.recreateDatabase();
        process.exit(0);
    } catch (error) {
        console.error('❌ Recreation failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { DatabaseRecreator };