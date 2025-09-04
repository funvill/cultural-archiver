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

// Load environment variables
config();

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
        const databaseId = process.env.D1_DATABASE_ID;
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;

        if (!databaseId) {
            throw new Error('D1_DATABASE_ID environment variable is required');
        }
        if (!accountId) {
            throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        }
        if (!apiToken) {
            throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
        }

        return { databaseId, accountId, apiToken };
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
        if (sampleData.trim()) {
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
        console.info('🚀 Starting schema extraction...');

        try {
            // Extract all schema components
            const [tables, indexes, triggers, sampleData] = await Promise.all([
                this.getTables(),
                this.getIndexes(),
                this.getTriggers(),
                this.getSampleData(),
            ]);

            // Generate SQL with sample data
            const schemaSQL = this.generateSchemaSQL(tables, indexes, triggers, sampleData);

            // Validate extraction
            await this.validateExtraction(schemaSQL);

            // Save to file (always save to file now)
            const outputPath = join(dirname(__dirname), outputFile || '001_consolidated_baseline.sql');
            await writeFile(outputPath, schemaSQL, 'utf-8');
            console.info(`💾 Schema saved to: ${outputPath}`);

            console.info('✅ Schema extraction completed successfully');
            return schemaSQL;

        } catch (error) {
            console.error('❌ Schema extraction failed:', error);
            throw error;
        }
    }

    public async testConnection(): Promise<boolean> {
        try {
            console.info('🔍 Testing database connection...');
            await this.executeQuery('SELECT 1 as test');
            console.info('✅ Database connection successful');
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            return false;
        }
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
        console.info('  --help         Show this help');
        console.info('');
        console.info('Required Environment Variables (.env file):');
        console.info('  D1_DATABASE_ID         Cloudflare D1 Database ID');
        console.info('  CLOUDFLARE_ACCOUNT_ID  Cloudflare Account ID');
        console.info('  CLOUDFLARE_API_TOKEN   Cloudflare API Token with D1:Edit permission');
        console.info('');
        console.info('Examples:');
        console.info('  npx tsx migrations/tools/extract-schema.ts  # Updates 001_consolidated_baseline.sql');
        console.info('  npx tsx migrations/tools/extract-schema.ts backup-schema.sql');
        console.info('  npx tsx migrations/tools/extract-schema.ts --test');
    }
}

// Main execution
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
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
                console.info('  --help         Show this help');
                console.info('');
                console.info('Required Environment Variables (.env file):');
                console.info('  D1_DATABASE_ID         Cloudflare D1 Database ID');
                console.info('  CLOUDFLARE_ACCOUNT_ID  Cloudflare Account ID');
                console.info('  CLOUDFLARE_API_TOKEN   Cloudflare API Token with D1:Edit permission');
                console.info('');
                console.info('Examples:');
                console.info('  npx tsx migrations/tools/extract-schema.ts  # Updates 001_consolidated_baseline.sql');
                console.info('  npx tsx migrations/tools/extract-schema.ts backup-schema.sql');
                console.info('  npx tsx migrations/tools/extract-schema.ts --test');
            }
        })();
        extractor.showHelp();
        return;
    }

    const extractor = new SchemaExtractor();

    if (args.includes('--test')) {
        const success = await extractor.testConnection();
        process.exit(success ? 0 : 1);
        return;
    }

    const outputFile = args[0] || '001_consolidated_baseline.sql';
    try {
        await extractor.extractSchema(outputFile);
        process.exit(0);
    } catch (error) {
        console.error('❌ Extraction failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { SchemaExtractor };