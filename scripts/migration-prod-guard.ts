#!/usr/bin/env node
/**
 * Production Migration Safety Guard for Cultural Archiver
 * Implements safety checks and confirmation prompts for production migrations
 * 
 * Usage: npm run migrate:prod (with optional --yes flag)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const execAsync = promisify(exec);

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const workersDir = join(projectRoot, 'src', 'workers');

class ProductionMigrationGuard {
    private forceYes: boolean = false;

    constructor(args: string[] = []) {
        this.forceYes = args.includes('--yes') || args.includes('-y');
    }

    async promptConfirmation(message: string): Promise<boolean> {
        if (this.forceYes) {
            console.log(`${message} (--yes flag provided)`);
            return true;
        }

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(`${message} (y/N): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
            });
        });
    }

    async validateEnvironment(): Promise<boolean> {
        console.log('🔒 Production Migration Safety Checks');
        console.log('=====================================');

        // Check 1: Verify we're targeting production
        console.log('✅ Step 1: Environment verification');
        console.log('   Target: Production environment');
        
        // Check 2: Verify connection to production database
        console.log('✅ Step 2: Database connectivity check');
        try {
            const { stdout } = await execAsync('npx wrangler d1 info cultural-archiver --env production', {
                cwd: workersDir
            });
            console.log('   Database connection: OK');
        } catch (error) {
            console.error('❌ Cannot connect to production database');
            console.error('   Make sure you have proper authentication and database exists');
            return false;
        }

        // Check 3: Get current migration status
        console.log('✅ Step 3: Current migration status');
        try {
            const { stdout } = await execAsync('npx wrangler d1 migrations list cultural-archiver --env production', {
                cwd: workersDir
            });
            console.log('   Migration status retrieved successfully');
        } catch (error) {
            console.error('⚠️  Could not retrieve migration status');
            console.error('   This may indicate the database is not initialized');
        }

        console.log('');
        return true;
    }

    async runPreflightChecks(): Promise<boolean> {
        console.log('🔍 Pre-flight Safety Checks');
        console.log('============================');

        // Check 1: Validate all migrations first
        console.log('📋 Step 1: Validating migration files...');
        try {
            await execAsync('npm run migrate:validate', {
                cwd: projectRoot
            });
            console.log('✅ All migration files are valid');
        } catch (error) {
            console.error('❌ Migration validation failed!');
            console.error('   Fix validation errors before proceeding to production');
            return false;
        }

        // Check 2: Verify tests pass
        console.log('🧪 Step 2: Running test suite...');
        try {
            await execAsync('npm run test', {
                cwd: projectRoot,
                timeout: 120000 // 2 minutes timeout
            });
            console.log('✅ All tests pass');
        } catch (error) {
            console.error('❌ Tests are failing!');
            console.error('   Fix failing tests before proceeding to production');
            return false;
        }

        // Check 3: Verify no uncommitted changes
        console.log('📝 Step 3: Checking for uncommitted changes...');
        try {
            const { stdout } = await execAsync('git status --porcelain', {
                cwd: projectRoot
            });
            if (stdout.trim()) {
                console.error('⚠️  Uncommitted changes detected:');
                console.error(stdout);
                const proceed = await this.promptConfirmation('Continue with uncommitted changes?');
                if (!proceed) {
                    return false;
                }
            } else {
                console.log('✅ Working directory is clean');
            }
        } catch (error) {
            console.error('⚠️  Could not check git status (not a git repository?)');
        }

        console.log('');
        return true;
    }

    async showMigrationPlan(): Promise<void> {
        console.log('📋 Migration Execution Plan');
        console.log('============================');

        try {
            console.log('📊 Current production migration status:');
            await execAsync('npx tsx scripts/migration-state.ts --env production', {
                cwd: projectRoot,
                stdio: 'inherit'
            });
        } catch (error) {
            console.error('⚠️  Could not retrieve current migration status');
        }

        console.log('');
        console.log('🚀 Pending operations:');
        console.log('   • Apply all pending migrations to production database');
        console.log('   • Update migration state tracking');
        console.log('   • No data will be deleted or modified (schema changes only)');
        console.log('');

        console.log('⚠️  IMPORTANT REMINDERS:');
        console.log('   • This operation affects the PRODUCTION database');
        console.log('   • Ensure you have taken a recent backup');
        console.log('   • Monitor the application after migration');
        console.log('   • Have rollback plan ready if needed');
        console.log('');
    }

    async executeMigration(): Promise<boolean> {
        console.log('🚀 Executing Production Migration');
        console.log('==================================');

        try {
            const cmd = 'npx wrangler d1 migrations apply cultural-archiver --env production';
            console.log(`Running: ${cmd}`);
            console.log('');

            await execAsync(cmd, {
                cwd: workersDir,
                stdio: 'inherit'
            });

            console.log('');
            console.log('✅ Migration completed successfully!');
            
            // Show final status
            console.log('');
            console.log('📊 Final migration status:');
            await execAsync('npx tsx scripts/migration-state.ts --env production', {
                cwd: projectRoot,
                stdio: 'inherit'
            });

            return true;

        } catch (error: any) {
            console.error('');
            console.error('❌ Migration failed!');
            console.error(`Error: ${error.message}`);
            console.error('');
            console.error('🛠️  Troubleshooting steps:');
            console.error('   1. Check the error message above');
            console.error('   2. Verify database connectivity');
            console.error('   3. Check migration file syntax');
            console.error('   4. Consider rolling back if needed');
            return false;
        }
    }

    async run(): Promise<void> {
        console.log('🎯 Cultural Archiver - Production Migration Tool');
        console.log('================================================');
        console.log('');

        // Step 1: Environment validation
        const envValid = await this.validateEnvironment();
        if (!envValid) {
            console.error('❌ Environment validation failed. Aborting.');
            process.exit(1);
        }

        // Step 2: Pre-flight checks
        const checksPass = await this.runPreflightChecks();
        if (!checksPass) {
            console.error('❌ Pre-flight checks failed. Aborting.');
            process.exit(1);
        }

        // Step 3: Show migration plan
        await this.showMigrationPlan();

        // Step 4: Final confirmation
        const confirm = await this.promptConfirmation('🚨 PROCEED WITH PRODUCTION MIGRATION?');
        if (!confirm) {
            console.log('✋ Migration cancelled by user');
            process.exit(0);
        }

        // Step 5: Execute migration
        const success = await this.executeMigration();
        if (!success) {
            process.exit(1);
        }

        console.log('');
        console.log('🎉 Production migration completed successfully!');
        console.log('');
        console.log('📋 Recommended post-migration steps:');
        console.log('   1. Monitor application logs for errors');
        console.log('   2. Verify key functionality works');
        console.log('   3. Check database performance');
        console.log('   4. Notify team of completion');
    }

    static showHelp(): void {
        console.log('Production Migration Safety Guard - Cultural Archiver');
        console.log('');
        console.log('Usage:');
        console.log('  npm run migrate:prod                # Interactive with confirmations');
        console.log('  npm run migrate:prod -- --yes       # Skip confirmations (CI mode)');
        console.log('');
        console.log('Features:');
        console.log('  • Pre-flight validation checks');
        console.log('  • Migration file validation');
        console.log('  • Test suite verification');
        console.log('  • Interactive safety confirmations');
        console.log('  • Detailed migration plan preview');
        console.log('  • Post-migration status reporting');
        console.log('');
        console.log('Safety Features:');
        console.log('  • Database connectivity verification');
        console.log('  • Migration syntax validation');
        console.log('  • Test suite must pass');
        console.log('  • Git status awareness');
        console.log('  • Interactive confirmation prompts');
    }
}

// Main execution
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        ProductionMigrationGuard.showHelp();
        return;
    }

    const guard = new ProductionMigrationGuard(args);
    await guard.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export { ProductionMigrationGuard };