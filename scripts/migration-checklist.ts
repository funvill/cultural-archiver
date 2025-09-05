#!/usr/bin/env node
/**
 * Migration Checklist Tool for Cultural Archiver
 * Runs comprehensive validation checks before migration deployment
 *
 * Usage: npm run migrate:checklist
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

class MigrationChecklist {
  async runAllChecks(): Promise<CheckResult[]> {
    const checks = [
      this.checkD1Compatibility(),
      this.checkSequenceValidity(),
      this.checkCodeFormatting(),
      this.checkTypeScriptCompilation(),
      this.checkLintingIssues(),
      this.checkTestSuite(),
    ];

    console.log('🔍 Running Migration Pre-deployment Checklist...\n');

    const results = await Promise.all(checks);
    return results;
  }

  private async checkD1Compatibility(): Promise<CheckResult> {
    console.log('🔧 Checking D1 compatibility...');
    try {
      const { stdout, stderr } = await execAsync('npm run migrate:validate');

      if (stderr && stderr.includes('❌')) {
        return {
          name: 'D1 Compatibility',
          passed: false,
          message: 'D1 compatibility issues found',
          details: stderr,
        };
      }

      return {
        name: 'D1 Compatibility',
        passed: true,
        message: 'All migrations are D1 compatible',
      };
    } catch (error) {
      return {
        name: 'D1 Compatibility',
        passed: false,
        message: 'D1 compatibility check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkSequenceValidity(): Promise<CheckResult> {
    console.log('🔢 Checking migration sequence...');
    try {
      await execAsync('npm run migrate:validate:sequence');
      return {
        name: 'Migration Sequence',
        passed: true,
        message: 'Migration sequence is valid',
      };
    } catch (error) {
      return {
        name: 'Migration Sequence',
        passed: false,
        message: 'Migration sequence has issues',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkCodeFormatting(): Promise<CheckResult> {
    console.log('📝 Checking code formatting...');
    try {
      await execAsync('npm run format:check');
      return {
        name: 'Code Formatting',
        passed: true,
        message: 'Code is properly formatted',
      };
    } catch (error) {
      return {
        name: 'Code Formatting',
        passed: false,
        message: 'Code formatting issues found',
        details: 'Run: npm run format',
      };
    }
  }

  private async checkTypeScriptCompilation(): Promise<CheckResult> {
    console.log('🔍 Checking TypeScript compilation...');
    try {
      await execAsync('npm run type-check');
      return {
        name: 'TypeScript Compilation',
        passed: true,
        message: 'TypeScript compiles without errors',
      };
    } catch (error) {
      return {
        name: 'TypeScript Compilation',
        passed: false,
        message: 'TypeScript compilation errors found',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkLintingIssues(): Promise<CheckResult> {
    console.log('🔧 Checking linting issues...');
    try {
      const { stdout } = await execAsync('npm run lint 2>&1');

      // Check if there are any errors (not just warnings)
      const errorCount = (stdout.match(/error/gi) || []).length;

      if (errorCount > 0) {
        return {
          name: 'Linting',
          passed: false,
          message: `${errorCount} linting errors found`,
          details: 'Run: npm run lint:fix',
        };
      }

      return {
        name: 'Linting',
        passed: true,
        message: 'No critical linting errors',
      };
    } catch (error) {
      // ESLint exits with non-zero when errors are found
      return {
        name: 'Linting',
        passed: false,
        message: 'Linting issues found',
        details: 'Run: npm run lint for details',
      };
    }
  }

  private async checkTestSuite(): Promise<CheckResult> {
    console.log('🧪 Checking test suite...');
    try {
      await execAsync('npm run test', { timeout: 120000 });
      return {
        name: 'Test Suite',
        passed: true,
        message: 'All tests pass',
      };
    } catch (error) {
      return {
        name: 'Test Suite',
        passed: false,
        message: 'Some tests are failing',
        details: 'Run: npm run test for details',
      };
    }
  }

  formatResults(results: CheckResult[]): void {
    console.log('\n📋 Migration Pre-deployment Checklist Results');
    console.log('==============================================\n');

    let allPassed = true;

    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.message}`);

      if (!result.passed) {
        allPassed = false;
        if (result.details) {
          console.log(`   💡 ${result.details}`);
        }
      }
    });

    console.log('\n📊 Summary');
    console.log('===========');
    const passedCount = results.filter(r => r.passed).length;
    console.log(`Checks passed: ${passedCount}/${results.length}`);

    if (allPassed) {
      console.log('\n🎉 All checks passed! Ready for migration deployment');
      console.log('\n📋 Next steps:');
      console.log('   • Review migration changes one final time');
      console.log('   • Ensure backup is recent');
      console.log('   • For production: npm run migrate:prod');
      console.log('   • For development: npm run migrate:dev');
    } else {
      console.log('\n⚠️  Some checks failed. Please fix issues before deploying migrations');
      console.log('\n🛠️  Common fixes:');
      console.log('   • Format code: npm run format');
      console.log('   • Fix linting: npm run lint:fix');
      console.log('   • Fix tests: npm run test');
    }
  }

  static showHelp(): void {
    console.log('Migration Pre-deployment Checklist - Cultural Archiver');
    console.log('');
    console.log('Usage:');
    console.log('  npm run migrate:checklist  # Run all pre-deployment checks');
    console.log('');
    console.log('Checks performed:');
    console.log('  • D1 compatibility validation');
    console.log('  • Migration sequence validation');
    console.log('  • Code formatting');
    console.log('  • TypeScript compilation');
    console.log('  • Linting issues');
    console.log('  • Test suite execution');
    console.log('');
    console.log('This tool helps ensure migrations are ready for deployment');
    console.log('by catching common issues before they reach production.');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    MigrationChecklist.showHelp();
    return;
  }

  const checklist = new MigrationChecklist();
  const results = await checklist.runAllChecks();

  checklist.formatResults(results);

  // Exit with error if any checks failed
  const allPassed = results.every(result => result.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { MigrationChecklist };
