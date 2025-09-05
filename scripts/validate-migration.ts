#!/usr/bin/env node
/**
 * Migration Validation Tool for Cultural Archiver
 * Validates SQL migration files for D1 compatibility
 *
 * Usage: npm run migrate:validate
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const migrationsDir = join(projectRoot, 'migrations');

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  line: number;
  issue: string;
  pattern: string;
  severity: 'error' | 'warning';
}

interface ValidationWarning {
  line: number;
  issue: string;
  suggestion: string;
}

interface ValidationPattern {
  pattern: RegExp;
  message: string;
  suggestion: string;
}

type ExecResult = {
  stdout: string;
  stderr: string;
};

class MigrationValidator {
  // D1 prohibited patterns with explanations
  private readonly prohibitedPatterns: ValidationPattern[] = [
    {
      pattern: /PRAGMA\s+/gi,
      message: 'PRAGMA statements are not supported in Cloudflare D1',
      suggestion: 'Remove PRAGMA statements - D1 handles configuration automatically',
    },
    {
      pattern: /WITHOUT\s+ROWID/gi,
      message: 'WITHOUT ROWID tables are not supported in D1',
      suggestion: 'Remove WITHOUT ROWID clause - use standard rowid tables',
    },
    {
      pattern: /\bAUTOINCREMENT\b/gi,
      message: 'AUTOINCREMENT is not supported in D1',
      suggestion: 'Use INTEGER PRIMARY KEY or TEXT PRIMARY KEY with UUIDs instead',
    },
    {
      pattern: /\bATTACH\s+/gi,
      message: 'ATTACH DATABASE is not supported in D1',
      suggestion: 'D1 operates on single database instances only',
    },
    {
      pattern: /\bDETACH\s+/gi,
      message: 'DETACH DATABASE is not supported in D1',
      suggestion: 'D1 operates on single database instances only',
    },
    {
      pattern: /length\s*\(/gi,
      message: 'length() function in CHECK constraints may not be supported reliably',
      suggestion: "Use simple CHECK constraints: CHECK (status IN ('active', 'inactive'))",
    },
    {
      pattern: /CREATE\s+(TEMP|TEMPORARY)\s+/gi,
      message: 'Temporary tables are not supported in D1',
      suggestion: 'Use regular tables or consider alternative approaches',
    },
    {
      pattern: /CREATE\s+VIEW\s+/gi,
      message: 'Views are not supported in D1',
      suggestion: 'Use application-level queries instead of database views',
    },
    {
      pattern: /CREATE\s+TRIGGER\s+/gi,
      message: 'Triggers are not supported in D1',
      suggestion: 'Handle logic in application code instead of database triggers',
    },
    {
      pattern: /\bBEGIN\s+(TRANSACTION|IMMEDIATE|EXCLUSIVE)/gi,
      message: 'Explicit transactions may not be supported in D1',
      suggestion: 'D1 handles transactions automatically for single migrations',
    },
  ];

  // Warning patterns for potentially problematic code
  private readonly warningPatterns: ValidationPattern[] = [
    {
      pattern: /CHECK\s*\([^)]{50,}\)/gi,
      message: 'Complex CHECK constraints may not be fully supported',
      suggestion: 'Use simple CHECK constraints with basic comparisons',
    },
    {
      pattern: /COLLATE\s+\w+/gi,
      message: 'Custom collation sequences may not be supported',
      suggestion: 'Use default collation or handle sorting in application code',
    },
    {
      pattern: /\bRECURSIVE\b/gi,
      message: 'Recursive CTEs may not be supported in D1',
      suggestion: 'Consider iterative approaches in application code',
    },
    {
      pattern: /\bFULLTEXT\b/gi,
      message: 'Full-text search indexes may not be supported in D1',
      suggestion: 'Use LIKE queries or external search services',
    },
    {
      pattern: /\bPARTITION\s+BY\b/gi,
      message: 'Table partitioning is not supported in D1',
      suggestion: 'Use application-level data organization strategies',
    },
    {
      pattern: /\bCONCAT_WS\s*\(|GROUP_CONCAT\s*\(/gi,
      message: 'Some string aggregation functions may not be supported',
      suggestion: 'Test carefully and consider application-level concatenation',
    },
  ];

  async validateFile(filePath: string): Promise<ValidationResult> {
    const filename = filePath.split('/').pop() || filePath;

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Check each line for prohibited patterns
      lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Skip comments (but still check for patterns in commented code)
        const trimmedLine = line.trim();
        if (
          trimmedLine.startsWith('--') &&
          !trimmedLine.includes('TODO') &&
          !trimmedLine.includes('FIXME')
        ) {
          return;
        }

        // Check for prohibited patterns
        this.prohibitedPatterns.forEach(({ pattern, message, suggestion }) => {
          if (pattern.test(line)) {
            errors.push({
              line: lineNumber,
              issue: message,
              pattern: pattern.source,
              severity: 'error',
            });
          }
        });

        // Check for warning patterns
        this.warningPatterns.forEach(({ pattern, message, suggestion }) => {
          if (pattern.test(line)) {
            warnings.push({
              line: lineNumber,
              issue: message,
              suggestion: suggestion,
            });
          }
        });
      });

      return {
        file: filename,
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        file: filename,
        valid: false,
        errors: [
          {
            line: 0,
            issue: `Failed to read file: ${error}`,
            pattern: '',
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }
  }

  async validateMigrations(specificFile?: string): Promise<ValidationResult[]> {
    try {
      let filesToCheck: string[];

      if (specificFile) {
        const filePath = specificFile.startsWith('/')
          ? specificFile
          : join(migrationsDir, specificFile);
        filesToCheck = [filePath];
      } else {
        const files = await readdir(migrationsDir);
        const migrationFiles = files.filter(file => file.match(/^\d{3,4}_.*\.sql$/)).sort();
        filesToCheck = migrationFiles.map(file => join(migrationsDir, file));
      }

      const results = await Promise.all(filesToCheck.map(file => this.validateFile(file)));

      return results;
    } catch (error) {
      console.error('❌ Error reading migrations directory:', error);
      return [];
    }
  }

  formatResults(results: ValidationResult[]): void {
    let totalErrors = 0;
    let totalWarnings = 0;
    let validFiles = 0;

    console.log('🔍 D1 Migration Validation Results');
    console.log('==================================\n');

    // Show progress
    console.log(
      `📊 Processed ${results.length} migration file${results.length !== 1 ? 's' : ''}\n`
    );

    results.forEach((result, index) => {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      const fileNumber = `[${index + 1}/${results.length}]`;

      if (result.valid && result.warnings.length === 0) {
        validFiles++;
        console.log(`✅ ${fileNumber} ${result.file} - Valid`);
      } else {
        console.log(`${result.valid ? '⚠️' : '❌'} ${fileNumber} ${result.file}`);

        if (result.errors.length > 0) {
          console.log('   🚨 Errors:');
          result.errors.forEach(error => {
            console.log(`      • Line ${error.line}: ${error.issue}`);
          });
        }

        if (result.warnings.length > 0) {
          console.log('   ⚠️  Warnings:');
          result.warnings.forEach(warning => {
            console.log(`      • Line ${warning.line}: ${warning.issue}`);
            console.log(`        💡 Suggestion: ${warning.suggestion}`);
          });
        }
        console.log();
      }
    });

    console.log('\n📊 Summary');
    console.log('===========');
    console.log(`Files validated: ${results.length}`);
    console.log(`Valid files: ${validFiles}`);
    console.log(`Files with errors: ${results.filter(r => !r.valid).length}`);
    console.log(`Files with warnings: ${results.filter(r => r.warnings.length > 0).length}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Total warnings: ${totalWarnings}`);

    if (totalErrors > 0) {
      console.log('\n❌ Validation failed - migrations contain D1 compatibility issues');
      console.log(
        'See https://developers.cloudflare.com/d1/reference/sql-compatibility/ for details'
      );
      process.exit(1);
    } else if (totalWarnings > 0) {
      console.log('\n⚠️  Validation passed with warnings - review suggested changes');
    } else {
      console.log('\n✅ All migrations are D1 compatible!');
    }
  }

  showHelp(): void {
    console.log('Migration Validation Tool - Cultural Archiver');
    console.log('');
    console.log('Usage:');
    console.log('  npm run migrate:validate           # Validate all migrations');
    console.log('  npm run migrate:validate file.sql  # Validate specific file');
    console.log('  npx tsx scripts/validate-migration.ts');
    console.log('');
    console.log('Features:');
    console.log('  • Validates D1 SQL compatibility');
    console.log('  • Detects prohibited patterns (PRAGMA, WITHOUT ROWID, etc.)');
    console.log('  • Provides specific suggestions for fixes');
    console.log('  • Returns non-zero exit code for CI integration');
    console.log('');
    console.log('Common D1 Issues:');
    console.log('  ❌ PRAGMA statements - not supported');
    console.log('  ❌ WITHOUT ROWID tables - not supported');
    console.log('  ❌ AUTOINCREMENT - use TEXT PRIMARY KEY with UUIDs');
    console.log('  ❌ Complex CHECK constraints - use simple comparisons');
    console.log('  ❌ Views, triggers, temporary tables - not supported');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    const validator = new MigrationValidator();
    validator.showHelp();
    return;
  }

  const specificFile = args.find(arg => !arg.startsWith('--')) || undefined;

  console.log('🚀 Starting D1 migration validation...\n');

  const validator = new MigrationValidator();
  const results = await validator.validateMigrations(specificFile);

  if (results.length === 0) {
    console.log('❌ No migration files found to validate');
    if (specificFile) {
      console.log(`Looked for: ${specificFile}`);
    }
    process.exit(1);
  }

  validator.formatResults(results);
}

// Run if called directly
// Check if this file is being run directly (works with tsx and various environments)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('validate-migration.ts') ||
  process.argv[1].endsWith('validate-migration.js') ||
  import.meta.url === `file://${process.argv[1]}`
);

if (isMainModule) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { MigrationValidator };
