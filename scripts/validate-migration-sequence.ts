#!/usr/bin/env node
/**
 * Migration Sequence Validator for Cultural Archiver
 * Validates migration file sequencing and naming consistency
 *
 * Usage: npm run migrate:validate:sequence
 */

import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const migrationsDir = join(projectRoot, 'migrations');

interface SequenceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  migrations: MigrationFileInfo[];
}

interface MigrationFileInfo {
  filename: string;
  number: number;
  name: string;
  valid: boolean;
  issues: string[];
}

class MigrationSequenceValidator {
  async validateSequence(): Promise<SequenceValidationResult> {
    const result: SequenceValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      migrations: [],
    };

    try {
      const files = await readdir(migrationsDir);
      const migrationFiles = files.filter(file => file.match(/^\d{3,4}_.*\.sql$/)).sort();

      const migrationInfos: MigrationFileInfo[] = [];

      // Parse each migration file
      for (const file of migrationFiles) {
        const migrationInfo = this.parseMigrationFile(file);
        migrationInfos.push(migrationInfo);

        if (!migrationInfo.valid) {
          result.valid = false;
          result.errors.push(`Invalid migration file: ${file}`);
          migrationInfo.issues.forEach(issue => {
            result.errors.push(`  • ${issue}`);
          });
        }
      }

      result.migrations = migrationInfos;

      // Validate sequence continuity
      const sequenceIssues = this.validateSequenceContinuity(migrationInfos);
      result.errors.push(...sequenceIssues.errors);
      result.warnings.push(...sequenceIssues.warnings);

      if (sequenceIssues.errors.length > 0) {
        result.valid = false;
      }

      // Validate naming conventions
      const namingIssues = this.validateNamingConventions(migrationInfos);
      result.warnings.push(...namingIssues);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Failed to read migrations directory: ${error}`);
    }

    return result;
  }

  private parseMigrationFile(filename: string): MigrationFileInfo {
    const info: MigrationFileInfo = {
      filename,
      number: 0,
      name: '',
      valid: true,
      issues: [],
    };

    // Extract number and name from filename
    const match = filename.match(/^(\d{3,4})_(.*)\.sql$/);

    if (!match) {
      info.valid = false;
      info.issues.push('Invalid filename format - should be NNNN_description.sql');
      return info;
    }

    info.number = parseInt(match[1]);
    info.name = match[2];

    // Validate number format (should be 4 digits)
    if (match[1].length !== 4) {
      info.issues.push(`Migration number should be 4 digits (got ${match[1].length})`);
    }

    // Validate name format
    if (info.name.length === 0) {
      info.valid = false;
      info.issues.push('Migration name cannot be empty');
    }

    if (info.name.length > 50) {
      info.issues.push('Migration name is too long (max 50 characters)');
    }

    if (!/^[a-z0-9_]+$/.test(info.name)) {
      info.issues.push(
        'Migration name should only contain lowercase letters, numbers, and underscores'
      );
    }

    return info;
  }

  private validateSequenceContinuity(migrations: MigrationFileInfo[]): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (migrations.length === 0) {
      warnings.push('No migration files found');
      return { errors, warnings };
    }

    // Sort by number to check sequence
    const sortedMigrations = migrations
      .filter(m => m.valid && m.number > 0)
      .sort((a, b) => a.number - b.number);

    // Check for duplicates
    const numbers = sortedMigrations.map(m => m.number);
    const duplicates = numbers.filter((num, index) => numbers.indexOf(num) !== index);

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      uniqueDuplicates.forEach(num => {
        errors.push(`Duplicate migration number: ${num.toString().padStart(4, '0')}`);
      });
    }

    // Check for gaps in sequence
    if (sortedMigrations.length > 0) {
      const firstNumber = sortedMigrations[0].number;
      const lastNumber = sortedMigrations[sortedMigrations.length - 1].number;

      if (firstNumber !== 1) {
        warnings.push(
          `Migration sequence doesn't start at 0001 (starts at ${firstNumber.toString().padStart(4, '0')})`
        );
      }

      for (let expected = firstNumber; expected <= lastNumber; expected++) {
        const found = sortedMigrations.find(m => m.number === expected);
        if (!found) {
          errors.push(`Missing migration number: ${expected.toString().padStart(4, '0')}`);
        }
      }
    }

    return { errors, warnings };
  }

  private validateNamingConventions(migrations: MigrationFileInfo[]): string[] {
    const warnings: string[] = [];

    // Common naming pattern suggestions
    const goodPatterns = [
      /^create_\w+_table$/,
      /^add_\w+_to_\w+$/,
      /^drop_\w+_from_\w+$/,
      /^alter_\w+_\w+$/,
      /^fix_\w+$/,
      /^update_\w+$/,
      /^remove_\w+$/,
    ];

    migrations.forEach(migration => {
      if (!migration.valid) return;

      const hasGoodPattern = goodPatterns.some(pattern => pattern.test(migration.name));

      if (!hasGoodPattern && migration.name.length > 0) {
        // Check for common issues
        if (migration.name.includes('_and_')) {
          warnings.push(
            `${migration.filename}: Consider splitting complex migrations that do multiple things`
          );
        }

        if (!migration.name.includes('_')) {
          warnings.push(`${migration.filename}: Consider using snake_case for better readability`);
        }

        if (migration.name.toLowerCase() !== migration.name) {
          warnings.push(`${migration.filename}: Migration names should be lowercase`);
        }
      }
    });

    return warnings;
  }

  formatResults(result: SequenceValidationResult): void {
    console.log('🔢 Migration Sequence Validation Results');
    console.log('========================================\n');

    if (result.migrations.length === 0) {
      console.log('📭 No migration files found');
      return;
    }

    // Show migration list
    console.log('📋 Migration Files:');
    result.migrations.forEach((migration, index) => {
      const status = migration.valid ? '✅' : '❌';
      const number = `[${index + 1}/${result.migrations.length}]`;
      console.log(`${status} ${number} ${migration.filename}`);

      if (migration.issues.length > 0) {
        migration.issues.forEach(issue => {
          console.log(`     • ${issue}`);
        });
      }
    });

    console.log('');

    // Show errors
    if (result.errors.length > 0) {
      console.log('❌ Errors:');
      result.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
      console.log('');
    }

    // Show warnings
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
      console.log('');
    }

    // Summary
    console.log('📊 Summary:');
    console.log(`   Total migrations: ${result.migrations.length}`);
    console.log(`   Valid migrations: ${result.migrations.filter(m => m.valid).length}`);
    console.log(`   Errors: ${result.errors.length}`);
    console.log(`   Warnings: ${result.warnings.length}`);

    if (result.valid) {
      console.log('\n✅ Migration sequence is valid!');
    } else {
      console.log('\n❌ Migration sequence has errors that need to be fixed');
    }
  }

  static showHelp(): void {
    console.log('Migration Sequence Validator - Cultural Archiver');
    console.log('');
    console.log('Usage:');
    console.log('  npm run migrate:validate:sequence   # Validate migration sequence');
    console.log('  npx tsx scripts/validate-migration-sequence.ts');
    console.log('');
    console.log('Validates:');
    console.log('  • Sequential numbering (no gaps or duplicates)');
    console.log('  • Filename format (NNNN_description.sql)');
    console.log('  • Naming conventions (snake_case, descriptive)');
    console.log('  • Migration number format (4 digits)');
    console.log('');
    console.log('Best Practices:');
    console.log('  ✅ create_users_table');
    console.log('  ✅ add_email_to_users');
    console.log('  ✅ fix_user_permissions');
    console.log('  ❌ AddEmailColumn (PascalCase)');
    console.log('  ❌ create_users_and_permissions (too complex)');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    MigrationSequenceValidator.showHelp();
    return;
  }

  console.log('🚀 Starting migration sequence validation...\n');

  const validator = new MigrationSequenceValidator();
  const result = await validator.validateSequence();

  validator.formatResults(result);

  if (!result.valid) {
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

export { MigrationSequenceValidator };
