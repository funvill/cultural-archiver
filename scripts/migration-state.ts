#!/usr/bin/env node
/**
 * Migration State Reporter for Cultural Archiver
 * Provides JSON output for migration status and CI integration
 * 
 * Usage: 
 *   npm run migrate:status        # Development environment
 *   npm run migrate:status:prod   # Production environment
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const workersDir = join(projectRoot, 'src', 'workers');

interface MigrationStatus {
    environment: string;
    timestamp: string;
    migrations: Array<{
        id: string;
        name: string;
        applied_at: string | null;
        status: 'applied' | 'pending';
    }>;
    summary: {
        total: number;
        applied: number;
        pending: number;
    };
    success: boolean;
    error?: string;
}

class MigrationStateReporter {
    constructor(private environment: 'development' | 'production' = 'development') {}

    async getMigrationStatus(): Promise<MigrationStatus> {
        const result: MigrationStatus = {
            environment: this.environment,
            timestamp: new Date().toISOString(),
            migrations: [],
            summary: {
                total: 0,
                applied: 0,
                pending: 0
            },
            success: false
        };

        try {
            // Change to workers directory and run wrangler command
            const cmd = `npx wrangler d1 migrations list cultural-archiver --env ${this.environment}`;
            console.error(`🔍 Running: ${cmd}`);
            console.error(`📁 Working directory: ${workersDir}`);
            
            const { stdout, stderr } = await execAsync(cmd, {
                cwd: workersDir,
                env: { ...process.env, FORCE_COLOR: '0' }
            });

            // Parse wrangler output (format may vary)
            // For now, we'll capture raw output and try to parse it
            console.error('📄 Raw output:');
            console.error('STDOUT:', stdout);
            console.error('STDERR:', stderr);

            // Basic parsing - this will need adjustment based on actual wrangler output format
            const lines = stdout.split('\n').filter(line => line.trim());
            
            // Try to extract migration information
            // Wrangler output format may vary, so this is a best effort
            let appliedCount = 0;
            let totalCount = 0;

            for (const line of lines) {
                if (line.includes('migration') || line.match(/^\d{4}_/)) {
                    totalCount++;
                    if (line.includes('applied') || line.includes('✓')) {
                        appliedCount++;
                        result.migrations.push({
                            id: line.substring(0, 4) || `migration-${totalCount}`,
                            name: line || `Migration ${totalCount}`,
                            applied_at: new Date().toISOString(),
                            status: 'applied'
                        });
                    } else {
                        result.migrations.push({
                            id: line.substring(0, 4) || `migration-${totalCount}`,
                            name: line || `Migration ${totalCount}`,
                            applied_at: null,
                            status: 'pending'
                        });
                    }
                }
            }

            result.summary = {
                total: totalCount,
                applied: appliedCount,
                pending: totalCount - appliedCount
            };

            result.success = true;

        } catch (error: any) {
            console.error('❌ Error getting migration status:', error);
            result.error = error.message || 'Unknown error';
            result.success = false;
        }

        return result;
    }

    async generateReport(format: 'json' | 'human' = 'human'): Promise<void> {
        const status = await this.getMigrationStatus();

        if (format === 'json') {
            console.log(JSON.stringify(status, null, 2));
            return;
        }

        // Human-readable format
        console.log(`\n📊 Migration Status - ${status.environment.toUpperCase()}`);
        console.log(`🕒 Generated: ${status.timestamp}`);
        console.log('');
        
        if (!status.success) {
            console.log('❌ Failed to get migration status');
            if (status.error) {
                console.log(`Error: ${status.error}`);
            }
            process.exit(1);
        }

        console.log('📈 Summary:');
        console.log(`   Total migrations: ${status.summary.total}`);
        console.log(`   Applied: ${status.summary.applied}`);
        console.log(`   Pending: ${status.summary.pending}`);
        console.log('');

        if (status.migrations.length > 0) {
            console.log('📋 Migrations:');
            for (const migration of status.migrations) {
                const statusIcon = migration.status === 'applied' ? '✅' : '⏳';
                const appliedInfo = migration.applied_at 
                    ? ` (applied: ${migration.applied_at})`
                    : ' (pending)';
                console.log(`   ${statusIcon} ${migration.name}${appliedInfo}`);
            }
        } else {
            console.log('📋 No migrations found or migration table not initialized');
        }

        console.log('');

        if (status.summary.pending > 0) {
            console.log(`⚠️  ${status.summary.pending} pending migrations need to be applied`);
            console.log(`Run: npm run migrate:${status.environment === 'production' ? 'prod' : 'dev'}`);
        } else {
            console.log('✅ All migrations are up to date');
        }
    }

    static showHelp(): void {
        console.log('Migration State Reporter - Cultural Archiver');
        console.log('');
        console.log('Usage:');
        console.log('  npm run migrate:status              # Development environment, human format');
        console.log('  npm run migrate:status:prod         # Production environment, human format');
        console.log('');
        console.log('Options:');
        console.log('  --json                              # Output as JSON for CI');
        console.log('  --env development|production        # Specify environment');
        console.log('');
        console.log('Examples:');
        console.log('  npx tsx scripts/migration-state.ts --json');
        console.log('  npx tsx scripts/migration-state.ts --env production');
        console.log('  npx tsx scripts/migration-state.ts --env development --json');
    }
}

// Main execution
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        MigrationStateReporter.showHelp();
        return;
    }

    // Parse arguments
    let environment: 'development' | 'production' = 'development';
    let format: 'json' | 'human' = 'human';

    const envIndex = args.indexOf('--env');
    if (envIndex !== -1 && args[envIndex + 1]) {
        const envArg = args[envIndex + 1];
        if (envArg === 'development' || envArg === 'production') {
            environment = envArg;
        }
    }

    if (args.includes('--json')) {
        format = 'json';
    }

    const reporter = new MigrationStateReporter(environment);
    await reporter.generateReport(format);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export { MigrationStateReporter };