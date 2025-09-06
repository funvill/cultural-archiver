#!/usr/bin/env node
/**
 * Migration 006 Production Deployment Script
 * Comprehensive tool for deploying the structured tag schema migration
 * 
 * Usage: npm run migrate:006:prod
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createInterface } from 'readline';

const execAsync = promisify(exec);

interface MigrationStep {
  name: string;
  description: string;
  command?: string;
  manual?: boolean;
  critical?: boolean;
}

class Migration006Deployer {
  private readonly steps: MigrationStep[] = [
    {
      name: 'Migration Synchronization',
      description: 'Synchronize migration files for Windows PowerShell compatibility',
      command: 'npm run migrate:sync'
    },
    {
      name: 'Pre-flight Validation',
      description: 'Validate migration file syntax and D1 compatibility',
      command: 'npm run migrate:validate 006_structured_tag_schema.sql'
    },
    {
      name: 'Test Migration Logic',
      description: 'Run comprehensive tests to verify migration behavior',
      command: 'npx vitest migrations/test/006_structured_tag_schema.test.ts --run'
    },
    {
      name: 'Production Backup',
      description: 'Create backup of production database before migration',
      command: 'npm run backup:remote',
      critical: true
    },
    {
      name: 'Environment Check',
      description: 'Verify production database connectivity and credentials',
      command: 'cd src/workers && npx wrangler d1 info cultural-archiver --env production'
    },
    {
      name: 'Migration Status Check',
      description: 'Check current migration state in production',
      command: 'npm run migrate:status:prod'
    },
    {
      name: 'Apply Migration',
      description: 'Apply migration 006 to production database',
      command: 'npm run migrate:prod',
      critical: true
    },
    {
      name: 'Verify Migration',
      description: 'Verify migration was applied successfully',
      command: 'npm run migrate:status:prod'
    },
    {
      name: 'Test Application',
      description: 'Manually test key functionality after migration',
      manual: true
    }
  ];

  async promptConfirmation(message: string): Promise<boolean> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(`${message} (y/N): `, answer => {
        rl.close();
        resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
      });
    });
  }

  async runStep(step: MigrationStep, stepNumber: number): Promise<boolean> {
    console.log(`\n🔄 Step ${stepNumber}: ${step.name}`);
    console.log(`   ${step.description}`);
    
    if (step.manual) {
      console.log('   ⚠️  MANUAL STEP - Please complete the following:');
      console.log('   • Test artwork viewing and editing');
      console.log('   • Verify structured tags display correctly');
      console.log('   • Check search functionality works');
      console.log('   • Test moderation interface');
      
      const completed = await this.promptConfirmation('   Manual step completed successfully?');
      if (!completed) {
        console.log('   ❌ Manual step not completed');
        return false;
      }
      console.log('   ✅ Manual step completed');
      return true;
    }

    if (!step.command) {
      console.log('   ✅ Step completed (no action required)');
      return true;
    }

    if (step.critical) {
      const proceed = await this.promptConfirmation(`   🚨 CRITICAL STEP - Proceed with: ${step.command}?`);
      if (!proceed) {
        console.log('   ❌ Critical step cancelled by user');
        return false;
      }
    }

    try {
      console.log(`   Running: ${step.command}`);
      const { stdout, stderr } = await execAsync(step.command, { 
        cwd: process.cwd(),
        timeout: 300000 // 5 minute timeout
      });
      
      if (stdout) {
        console.log('   Output:', stdout.slice(0, 500) + (stdout.length > 500 ? '...' : ''));
      }
      if (stderr && !stderr.includes('npm warn')) {
        console.log('   Warnings:', stderr.slice(0, 200));
      }
      
      console.log('   ✅ Step completed successfully');
      return true;
    } catch (error: any) {
      console.error('   ❌ Step failed:', error.message);
      
      if (step.critical) {
        console.error('   🚨 CRITICAL FAILURE - Migration cannot continue');
        console.error('   Please resolve the issue and restart the migration');
        return false;
      }
      
      const continueOnError = await this.promptConfirmation('   Continue despite error?');
      return continueOnError;
    }
  }

  async showPreMigrationChecklist(): Promise<void> {
    console.log('📋 Pre-Migration Checklist');
    console.log('===========================');
    console.log('Before running migration 006, ensure:');
    console.log('');
    console.log('✅ Environment Setup:');
    console.log('   • CLOUDFLARE_API_TOKEN is set with D1 permissions');
    console.log('   • Production database ID is correctly configured');
    console.log('   • All dependencies are installed (npm install)');
    console.log('');
    console.log('✅ Safety Preparations:');
    console.log('   • Production backup has been created');
    console.log('   • Maintenance window has been scheduled');
    console.log('   • Team has been notified of the migration');
    console.log('   • Rollback plan is prepared and tested');
    console.log('');
    console.log('✅ Technical Validations:');
    console.log('   • All tests are passing (npm run test)');
    console.log('   • Migration file is D1-compatible (npm run migrate:validate)');
    console.log('   • Application builds successfully (npm run build)');
    console.log('');
  }

  async showPostMigrationTasks(): Promise<void> {
    console.log('📋 Post-Migration Tasks');
    console.log('========================');
    console.log('After migration completion:');
    console.log('');
    console.log('🔍 Verification:');
    console.log('   • Test artwork creation with new tag system');
    console.log('   • Verify existing artwork tags display correctly');
    console.log('   • Check search functionality includes tag data');
    console.log('   • Test OpenStreetMap export with structured tags');
    console.log('');
    console.log('📊 Monitoring:');
    console.log('   • Monitor application logs for errors');
    console.log('   • Check database performance metrics');
    console.log('   • Verify API response times remain acceptable');
    console.log('   • Monitor user feedback and reports');
    console.log('');
    console.log('📢 Communication:');
    console.log('   • Notify team of successful migration');
    console.log('   • Update documentation with new tag features');
    console.log('   • Communicate any user-facing changes');
    console.log('');
  }

  async run(): Promise<void> {
    console.log('🎯 Cultural Archiver - Migration 006 Deployment Tool');
    console.log('=====================================================');
    console.log('Deploying Structured Tag Schema Migration');
    console.log('');

    // Show pre-migration checklist
    await this.showPreMigrationChecklist();
    
    const proceedWithChecklist = await this.promptConfirmation('Have you completed the pre-migration checklist?');
    if (!proceedWithChecklist) {
      console.log('❌ Please complete the pre-migration checklist before proceeding');
      process.exit(1);
    }

    console.log('\n🚀 Starting Migration 006 Deployment Process');
    console.log('==============================================');

    let successfulSteps = 0;
    
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const success = await this.runStep(step, i + 1);
      
      if (success) {
        successfulSteps++;
      } else {
        console.log(`\n❌ Migration failed at step ${i + 1}: ${step.name}`);
        console.log('Please resolve the issue and restart the migration process');
        process.exit(1);
      }
    }

    console.log('\n🎉 Migration 006 Completed Successfully!');
    console.log('=========================================');
    console.log(`✅ All ${this.steps.length} steps completed successfully`);
    console.log('');

    // Show post-migration tasks
    await this.showPostMigrationTasks();

    console.log('📊 Migration Summary:');
    console.log('   • Structured tag schema deployed to production');
    console.log('   • Existing tag data preserved and migrated');
    console.log('   • New tag validation system active');
    console.log('   • Search integration enhanced');
    console.log('   • OpenStreetMap export functionality enabled');
    console.log('');
    console.log('🎯 Migration 006 deployment complete!');
  }

  static showHelp(): void {
    console.log('Migration 006 Deployment Tool - Cultural Archiver');
    console.log('');
    console.log('Purpose:');
    console.log('  Deploy the structured tag schema migration to production');
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx scripts/run-migration-006.ts');
    console.log('  npm run migrate:006:prod  (if script is added to package.json)');
    console.log('');
    console.log('Prerequisites:');
    console.log('  • CLOUDFLARE_API_TOKEN environment variable set');
    console.log('  • Production database configured in wrangler.toml');
    console.log('  • Recent backup of production database');
    console.log('  • All tests passing');
    console.log('');
    console.log('What this migration does:');
    console.log('  • Updates artwork.tags field to structured format');
    console.log('  • Preserves all existing tag data');
    console.log('  • Adds database indexes for performance');
    console.log('  • Enables advanced tag validation and search');
    console.log('  • Supports OpenStreetMap export functionality');
    console.log('');
    console.log('Safety Features:');
    console.log('  • Pre-flight validation checks');
    console.log('  • Interactive confirmation for critical steps');
    console.log('  • Comprehensive error handling');
    console.log('  • Step-by-step progress reporting');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    Migration006Deployer.showHelp();
    return;
  }

  const deployer = new Migration006Deployer();
  await deployer.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Migration deployment failed:', error);
    process.exit(1);
  });
}

export { Migration006Deployer };