#!/usr/bin/env node
/**
 * Schema Extraction Tool for Cultural Archiver
 * Extracts current database schema from Cloudflare D1
 * 
 * Usage: npx tsx migrations/tools/extract-schema.ts [output-file]
 */

import { writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

console.info('🔧 Cultural Archiver Schema Extraction Tool Starting...');
console.info(`📍 Working directory: ${process.cwd()}`);
console.info(`🕒 Started at: ${new Date().toISOString()}`);

// Load environment variables
console.info('📄 Loading environment variables...');
try {
    const result = config();
    if (result.error) {
        console.warn(`⚠️  Warning loading .env file: ${result.error.message}`);
    } else {
        console.info(`✅ Environment variables loaded from .env`);
    }
} catch (error) {
    console.warn(`⚠️  Warning loading .env file: ${error}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DatabaseConfig {
    databaseId: string;
    accountId: string;
    apiToken: string;
}

interface TableInfo {
    name: string;
    sql: string;
}

interface IndexInfo {
    name: string;
    sql: string;
}

class SchemaExtractor {
    private config: DatabaseConfig;

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): DatabaseConfig {
        console.info('🔍 Validating database configuration...');
        
        const databaseId = process.env.D1_DATABASE_ID;
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;

        console.info(`📊 Configuration check:`);
        console.info(`  - D1_DATABASE_ID: ${databaseId ? '✅ Set' : '❌ Missing'}`);
        console.info(`  - CLOUDFLARE_ACCOUNT_ID: ${accountId ? '✅ Set' : '❌ Missing'}`);
        console.info(`  - CLOUDFLARE_API_TOKEN: ${apiToken ? '✅ Set (****)' : '❌ Missing'}`);

        if (!databaseId) {
            console.error('❌ D1_DATABASE_ID environment variable is required');
            console.error('💡 Add D1_DATABASE_ID to your .env file');
            throw new Error('D1_DATABASE_ID environment variable is required');
        }
        if (!accountId) {
            console.error('❌ CLOUDFLARE_ACCOUNT_ID environment variable is required');
            console.error('💡 Add CLOUDFLARE_ACCOUNT_ID to your .env file');
            throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        }
        if (!apiToken) {
            console.error('❌ CLOUDFLARE_API_TOKEN environment variable is required');
            console.error('💡 Add CLOUDFLARE_API_TOKEN to your .env file');
            throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
        }

        console.info('✅ Database configuration validated');
        return { databaseId, accountId, apiToken };
    }

    private async executeQuery(sql: string): Promise<any> {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/d1/database/${this.config.databaseId}/query`;
        
        console.info(`🌐 Executing query: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
        console.debug(`📡 Request URL: ${url}`);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sql }),
            });

            console.info(`📡 Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const error = await response.text();
                console.error(`❌ HTTP Error ${response.status}: ${error}`);
                throw new Error(`Database query failed: ${response.status} ${error}`);
            }

            const data = await response.json();
            console.debug(`📊 Response data keys: ${Object.keys(data).join(', ')}`);
            
            if (!data.success) {
                console.error(`❌ API Error: ${JSON.stringify(data.errors)}`);
                throw new Error(`Database query failed: ${JSON.stringify(data.errors)}`);
            }

            const resultCount = data.result?.[0]?.results?.length || 0;
            console.info(`✅ Query successful, ${resultCount} rows returned`);
            return data.result[0];
            
        } catch (error) {
            console.error('❌ Query execution failed:', error);
            if (error.cause) {
                console.error('🔍 Root cause:', error.cause);
            }
            throw error;
        }
    }

    private async getTables(): Promise<TableInfo[]> {
        console.info('🔍 Extracting table structures...');
        
        // Get all tables (excluding sqlite_* system tables)
        const tablesResult = await this.executeQuery(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type = 'table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        if (!tablesResult.results || tablesResult.results.length === 0) {
            console.warn('⚠️  No user tables found in database');
            return [];
        }

        const tables: TableInfo[] = tablesResult.results.map((row: any) => ({
            name: row.name,
            sql: row.sql,
        }));

        console.info(`📊 Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);
        return tables;
    }

    private async getIndexes(): Promise<IndexInfo[]> {
        console.info('🔍 Extracting indexes...');
        
        // Get all indexes (excluding auto-generated primary key indexes)
        const indexesResult = await this.executeQuery(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type = 'index' 
            AND sql IS NOT NULL
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        if (!indexesResult.results) {
            console.info('📊 No custom indexes found');
            return [];
        }

        const indexes: IndexInfo[] = indexesResult.results.map((row: any) => ({
            name: row.name,
            sql: row.sql,
        }));

        console.info(`📊 Found ${indexes.length} indexes: ${indexes.map(i => i.name).join(', ')}`);
        return indexes;
    }

    private async getTriggers(): Promise<IndexInfo[]> {
        console.info('🔍 Extracting triggers...');
        
        // Get all triggers
        const triggersResult = await this.executeQuery(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type = 'trigger' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        if (!triggersResult.results) {
            console.info('📊 No triggers found');
            return [];
        }

        const triggers: IndexInfo[] = triggersResult.results.map((row: any) => ({
            name: row.name,
            sql: row.sql,
        }));

        console.info(`📊 Found ${triggers.length} triggers: ${triggers.map(t => t.name).join(', ')}`);
        return triggers;
    }

    private async getSampleData(): Promise<string> {
        console.info('📄 Loading sample data...');
        
        try {
            const sampleDataPath = join(__dirname, 'sample-data.sql');
            const sampleData = await readFile(sampleDataPath, 'utf-8');
            
            console.info('✅ Sample data loaded successfully');
            return sampleData;
        } catch (error) {
            console.warn(`⚠️  Could not load sample data: ${error}`);
            return '';
        }
    }

    private generateSchemaSQL(tables: TableInfo[], indexes: IndexInfo[], triggers: IndexInfo[], sampleData: string): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const lines = [
            '-- Cultural Archiver Database Schema (Consolidated)',
            `-- Extracted on: ${new Date().toISOString()}`,
            `-- Generated by: extract-schema.ts`,
            `-- Version: consolidated-baseline-${timestamp}`,
            '',
            '-- Enable foreign key constraints',
            'PRAGMA foreign_keys = ON;',
            '',
        ];

        // Add tables
        if (tables.length > 0) {
            lines.push('-- ================================');
            lines.push('-- Tables');
            lines.push('-- ================================');
            lines.push('');

            for (const table of tables) {
                lines.push(`-- Table: ${table.name}`);
                lines.push(`${table.sql};`);
                lines.push('');
            }
        }

        // Add indexes
        if (indexes.length > 0) {
            lines.push('-- ================================');
            lines.push('-- Indexes');
            lines.push('-- ================================');
            lines.push('');

            for (const index of indexes) {
                lines.push(`-- Index: ${index.name}`);
                lines.push(`${index.sql};`);
                lines.push('');
            }
        }

        // Add triggers
        if (triggers.length > 0) {
            lines.push('-- ================================');
            lines.push('-- Triggers');
            lines.push('-- ================================');
            lines.push('');

            for (const trigger of triggers) {
                lines.push(`-- Trigger: ${trigger.name}`);
                lines.push(`${trigger.sql};`);
                lines.push('');
            }
        }

        // Add sample data if available
        if (sampleData && sampleData.trim()) {
            lines.push('-- ================================');
            lines.push('-- Sample Data');
            lines.push('-- ================================');
            lines.push('');
            lines.push(sampleData);
            lines.push('');
        }

        return lines.join('\n');
    }

    private async validateExtraction(schemaSQL: string): Promise<void> {
        console.info('🔍 Validating extracted schema...');

        // Basic validation: ensure we have CREATE TABLE statements
        const createTableCount = (schemaSQL.match(/CREATE TABLE/gi) || []).length;
        if (createTableCount === 0) {
            throw new Error('Schema validation failed: No CREATE TABLE statements found');
        }

        // Validate that the schema contains no data (INSERT/UPDATE/DELETE statements)
        const dataStatements = schemaSQL.match(/\b(INSERT|UPDATE|DELETE)\s+/gi);
        if (dataStatements) {
            console.warn(`⚠️  Found ${dataStatements.length} data manipulation statements in schema`);
            console.warn('This is unusual but may be intentional for default data');
        }

        console.info(`✅ Schema validation passed: Found ${createTableCount} tables`);
    }

    public async extractSchema(outputFile?: string): Promise<string> {
        console.info('🚀 Starting schema extraction process...');
        console.info(`📁 Target output file: ${outputFile || '001_consolidated_baseline.sql'}`);

        try {
            console.info('⚡ Extracting schema components in parallel...');
            
            // Extract all schema components
            const [tables, indexes, triggers, sampleData] = await Promise.all([
                this.getTables(),
                this.getIndexes(), 
                this.getTriggers(),
                this.getSampleData(),
            ]);

            console.info('📊 Extraction summary:');
            console.info(`  - Tables: ${tables.length}`);
            console.info(`  - Indexes: ${indexes.length}`); 
            console.info(`  - Triggers: ${triggers.length}`);
            console.info(`  - Sample data: ${sampleData && sampleData.trim() ? '✅ Loaded' : '❌ Not available'}`);

            console.info('🔨 Generating consolidated schema SQL...');
            
            // Generate SQL with sample data
            const schemaSQL = this.generateSchemaSQL(tables, indexes, triggers, sampleData);
            
            const sqlLength = schemaSQL.length;
            const lineCount = schemaSQL.split('\n').length;
            console.info(`📄 Generated SQL: ${sqlLength} characters, ${lineCount} lines`);

            // Validate extraction
            console.info('🔍 Validating generated schema...');
            await this.validateExtraction(schemaSQL);

            // Save to file (always save to file now)
            const outputPath = join(dirname(__dirname), outputFile || '001_consolidated_baseline.sql');
            console.info(`💾 Saving schema to: ${outputPath}`);
            
            await writeFile(outputPath, schemaSQL, 'utf-8');
            console.info(`✅ File written successfully (${sqlLength} bytes)`);

            console.info('🎉 Schema extraction completed successfully!');
            console.info(`📂 Final output: ${outputPath}`);
            return schemaSQL;

        } catch (error) {
            console.error('❌ Schema extraction failed with error:', error);
            
            if (error.message?.includes('ENOTFOUND')) {
                console.error('🌐 Network connectivity issue detected');
                console.error('💡 Suggestions:');
                console.error('   - Check your internet connection');
                console.error('   - Verify Cloudflare API is accessible');
                console.error('   - Try using --mock flag for offline testing');
            } else if (error.message?.includes('environment variable')) {
                console.error('🔧 Configuration issue detected');
                console.error('💡 Suggestions:');
                console.error('   - Check your .env file exists');
                console.error('   - Verify all required environment variables are set');
                console.error('   - Use --help flag to see required variables');
            }
            
            throw error;
        }
    }

    public async testConnection(): Promise<boolean> {
        try {
            console.info('🔍 Testing database connection...');
            console.info(`🌐 Testing connection to Cloudflare D1...`);
            
            await this.executeQuery('SELECT 1 as test');
            console.info('✅ Database connection successful');
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            console.error('💡 Check your environment variables and network connectivity');
            return false;
        }
    }

    public async generateMockSchema(outputFile?: string): Promise<string> {
        console.info('🧪 Generating mock schema for testing...');
        
        // Mock data that simulates the database structure
        const mockTables: TableInfo[] = [
            {
                name: 'users',
                sql: 'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
            },
            {
                name: 'submissions',
                sql: 'CREATE TABLE submissions (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, status TEXT DEFAULT "pending", FOREIGN KEY(user_id) REFERENCES users(id))'
            }
        ];

        const mockIndexes: IndexInfo[] = [
            {
                name: 'idx_submissions_user_id',
                sql: 'CREATE INDEX idx_submissions_user_id ON submissions(user_id)'
            }
        ];

        const mockTriggers: IndexInfo[] = [];

        console.info('📄 Loading sample data for mock schema...');
        const sampleData = await this.getSampleData();

        const schemaSQL = this.generateSchemaSQL(mockTables, mockIndexes, mockTriggers, sampleData);
        
        // Save to file
        const outputPath = join(dirname(__dirname), outputFile || 'mock-schema.sql');
        await writeFile(outputPath, schemaSQL, 'utf-8');
        console.info(`💾 Mock schema saved to: ${outputPath}`);
        
        console.info('✅ Mock schema generation completed successfully');
        return schemaSQL;
    }

    public showHelp(): void {
        console.info('Cultural Archiver Schema Extraction Tool');
        console.info('');
        console.info('Usage:');
        console.info('  npx tsx migrations/tools/extract-schema.ts [output-file]');
        console.info('  npx tsx migrations/tools/extract-schema.ts  # Defaults to 001_consolidated_baseline.sql');
        console.info('  npx tsx migrations/tools/extract-schema.ts custom-schema.sql');
        console.info('');
        console.info('Options:');
        console.info('  output-file    Output file path (relative to migrations/, defaults to 001_consolidated_baseline.sql)');
        console.info('  --test         Test database connection only');
        console.info('  --mock         Generate mock schema for testing (no network required)');
        console.info('  --help, -h     Show this help');
        console.info('');
        console.info('Required Environment Variables (.env file):');
        console.info('  D1_DATABASE_ID         Cloudflare D1 Database ID');
        console.info('  CLOUDFLARE_ACCOUNT_ID  Cloudflare Account ID');
        console.info('  CLOUDFLARE_API_TOKEN   Cloudflare API Token with D1:Edit permission');
        console.info('');
        console.info('Examples:');
        console.info('  npx tsx migrations/tools/extract-schema.ts  # Updates 001_consolidated_baseline.sql');
        console.info('  npx tsx migrations/tools/extract-schema.ts backup-schema.sql');
        console.info('  npx tsx migrations/tools/extract-schema.ts --test  # Test connection only');
        console.info('  npx tsx migrations/tools/extract-schema.ts --mock  # Generate test schema');
        console.info('');
        console.info('Troubleshooting:');
        console.info('  - Ensure .env file exists with required variables');
        console.info('  - Check network connectivity to api.cloudflare.com');
        console.info('  - Use --mock flag for testing without network access');
        console.info('  - Use --test flag to verify database connection');
    }
}

// Main execution
async function main(): Promise<void> {
    console.info('🚀 Processing command line arguments...');
    const args = process.argv.slice(2);
    console.info(`📋 Arguments: ${args.join(' ') || '(none)'}`);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.info('ℹ️  Showing help information...');
        const extractor = new (class {
            showHelp() {
                console.info('Cultural Archiver Schema Extraction Tool');
                console.info('');
                console.info('Usage:');
                console.info('  npx tsx migrations/tools/extract-schema.ts [output-file]');
                console.info('  npx tsx migrations/tools/extract-schema.ts  # Defaults to 001_consolidated_baseline.sql');
                console.info('  npx tsx migrations/tools/extract-schema.ts custom-schema.sql');
                console.info('');
                console.info('Options:');
                console.info('  output-file    Output file path (relative to migrations/, defaults to 001_consolidated_baseline.sql)');
                console.info('  --test         Test database connection only');
                console.info('  --mock         Generate mock schema for testing (no network required)');
                console.info('  --help, -h     Show this help');
                console.info('');
                console.info('Required Environment Variables (.env file):');
                console.info('  D1_DATABASE_ID         Cloudflare D1 Database ID');
                console.info('  CLOUDFLARE_ACCOUNT_ID  Cloudflare Account ID');
                console.info('  CLOUDFLARE_API_TOKEN   Cloudflare API Token with D1:Edit permission');
                console.info('');
                console.info('Examples:');
                console.info('  npx tsx migrations/tools/extract-schema.ts  # Updates 001_consolidated_baseline.sql');
                console.info('  npx tsx migrations/tools/extract-schema.ts backup-schema.sql');
                console.info('  npx tsx migrations/tools/extract-schema.ts --test  # Test connection only');
                console.info('  npx tsx migrations/tools/extract-schema.ts --mock  # Generate test schema');
                console.info('');
                console.info('Troubleshooting:');
                console.info('  - Ensure .env file exists with required variables');
                console.info('  - Check network connectivity to api.cloudflare.com');
                console.info('  - Use --mock flag for testing without network access');
                console.info('  - Use --test flag to verify database connection');
            }
        })();
        extractor.showHelp();
        console.info('✅ Help displayed successfully');
        if (!process.env.VITEST) return;
    }

    // Handle mock mode first (doesn't require environment variables)
    if (args.includes('--mock')) {
        console.info('🧪 Running in mock mode (no environment variables required)...');
        const outputFile = args.find(arg => !arg.startsWith('--')) || 'mock-schema.sql';
        
        try {
            // Create a mock extractor that doesn't validate config
            const mockExtractor = new (class {
                async getSampleData(): Promise<string> {
                    console.info('📄 Loading sample data for mock schema...');
                    
                    try {
                        const sampleDataPath = join(dirname(__dirname), 'tools/sample-data.sql');
                        const sampleData = await readFile(sampleDataPath, 'utf-8');
                        
                        console.info('✅ Sample data loaded successfully');
                        return sampleData;
                    } catch (error) {
                        console.warn(`⚠️  Could not load sample data: ${error}`);
                        return '-- Sample data could not be loaded\n';
                    }
                }
                
                generateSchemaSQL(tables: TableInfo[], indexes: IndexInfo[], triggers: IndexInfo[], sampleData: string): string {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const lines = [
                        '-- Cultural Archiver Database Schema (Mock)',
                        `-- Generated on: ${new Date().toISOString()}`,
                        `-- Generated by: extract-schema.ts (mock mode)`,
                        `-- Version: mock-baseline-${timestamp}`,
                        '',
                        '-- Enable foreign key constraints',
                        'PRAGMA foreign_keys = ON;',
                        '',
                    ];

                    // Add tables
                    if (tables.length > 0) {
                        lines.push('-- ================================');
                        lines.push('-- Tables');
                        lines.push('-- ================================');
                        lines.push('');

                        for (const table of tables) {
                            lines.push(`-- Table: ${table.name}`);
                            lines.push(`${table.sql};`);
                            lines.push('');
                        }
                    }

                    // Add indexes
                    if (indexes.length > 0) {
                        lines.push('-- ================================');
                        lines.push('-- Indexes');
                        lines.push('-- ================================');
                        lines.push('');

                        for (const index of indexes) {
                            lines.push(`-- Index: ${index.name}`);
                            lines.push(`${index.sql};`);
                            lines.push('');
                        }
                    }

                    // Add triggers
                    if (triggers.length > 0) {
                        lines.push('-- ================================');
                        lines.push('-- Triggers');
                        lines.push('-- ================================');
                        lines.push('');

                        for (const trigger of triggers) {
                            lines.push(`-- Trigger: ${trigger.name}`);
                            lines.push(`${trigger.sql};`);
                            lines.push('');
                        }
                    }

                    // Add sample data if available
                    if (sampleData && sampleData.trim()) {
                        lines.push('-- ================================');
                        lines.push('-- Sample Data');
                        lines.push('-- ================================');
                        lines.push('');
                        lines.push(sampleData);
                        lines.push('');
                    }

                    return lines.join('\n');
                }
                
                async generateMockSchema(outputFile?: string): Promise<string> {
                    console.info('🧪 Generating mock schema for testing...');
                    
                    // Mock data that simulates the database structure
                    const mockTables: TableInfo[] = [
                        {
                            name: 'users',
                            sql: 'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
                        },
                        {
                            name: 'submissions',
                            sql: 'CREATE TABLE submissions (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, status TEXT DEFAULT "pending", FOREIGN KEY(user_id) REFERENCES users(id))'
                        }
                    ];

                    const mockIndexes: IndexInfo[] = [
                        {
                            name: 'idx_submissions_user_id',
                            sql: 'CREATE INDEX idx_submissions_user_id ON submissions(user_id)'
                        }
                    ];

                    const mockTriggers: IndexInfo[] = [];

                    const sampleData = await this.getSampleData();

                    const schemaSQL = this.generateSchemaSQL(mockTables, mockIndexes, mockTriggers, sampleData);
                    
                    // Save to file
                    const outputPath = join(dirname(__dirname), outputFile || 'mock-schema.sql');
                    await writeFile(outputPath, schemaSQL, 'utf-8');
                    console.info(`💾 Mock schema saved to: ${outputPath}`);
                    
                    console.info('✅ Mock schema generation completed successfully');
                    return schemaSQL;
                }
            })();
            
            await mockExtractor.generateMockSchema(outputFile);
            console.info('✅ Mock schema generation completed');
            if (!process.env.VITEST) process.exit(0);
        } catch (error) {
            console.error('❌ Mock schema generation failed:', error);
            if (!process.env.VITEST) process.exit(1);
        }
        return;
    }

    console.info('🔧 Initializing SchemaExtractor...');
    let extractor: SchemaExtractor;
    
    try {
        extractor = new SchemaExtractor();
        console.info('✅ SchemaExtractor initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize SchemaExtractor:', error);
        console.error('💡 Check your .env file and environment variables');
        if (!process.env.VITEST) process.exit(1);
        return;
    }

    if (args.includes('--test')) {
        console.info('🧪 Running connection test...');
        try {
            const success = await extractor.testConnection();
            if (success) {
                console.info('✅ Connection test passed');
                if (!process.env.VITEST) process.exit(0);
            } else {
                console.error('❌ Connection test failed');
                if (!process.env.VITEST) process.exit(1);
            }
        } catch (error) {
            console.error('❌ Connection test error:', error);
            if (!process.env.VITEST) process.exit(1);
        }
        return;
    }

    console.info('🗂️  Starting schema extraction...');
    const outputFile = args.find(arg => !arg.startsWith('--')) || '001_consolidated_baseline.sql';
    console.info(`📁 Output file: ${outputFile}`);
    
    try {
        await extractor.extractSchema(outputFile);
        console.info('🎉 Schema extraction completed successfully!');
        if (!process.env.VITEST) process.exit(0);
    } catch (error) {
        console.error('❌ Schema extraction failed:', error);
        console.error('💡 Try using --test flag to check database connection');
        console.error('💡 Or use --mock flag for offline testing');
        if (!process.env.VITEST) process.exit(1);
    }
}

// Run if called directly
console.info('🔍 Checking if script is executed directly...');
console.info(`  - import.meta.url: ${import.meta.url}`);
console.info(`  - process.argv[1]: ${process.argv[1]}`);
console.info(`  - Comparison: ${import.meta.url === `file://${process.argv[1]}`}`);

// Always execute main() when this script is run, but only if not in test environment
if (import.meta.url.includes('extract-schema.ts') && !process.env.VITEST) {
    console.info('✅ Script detected as being run directly, executing main()...');
    main().catch((error) => {
        console.error('❌ Unhandled error in main():', error);
        process.exit(1);
    });
} else if (process.env.VITEST) {
    console.info('🧪 Running in test environment, skipping automatic execution');
} else {
    console.info('📦 Script loaded as module, not executing main()');
}

export { SchemaExtractor };