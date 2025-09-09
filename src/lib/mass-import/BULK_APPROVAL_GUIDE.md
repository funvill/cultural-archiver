# Mass Import System - Bulk Approval Guide

## Overview

The `bulk-approve` command allows administrators to efficiently approve large numbers of pending submissions from mass import operations. This functionality integrates with the existing Cultural Archiver review system.

## Prerequisites

- Administrator or moderator permissions
- Access to the mass import token: `00000000-0000-0000-0000-000000000002`
- Valid API endpoint configuration

## Basic Usage

### Dry Run (Recommended First Step)

Always start with a dry run to see what would be approved:

```bash
# Check all pending submissions
mass-import bulk-approve --dry-run

# Check submissions from specific source
mass-import bulk-approve --source vancouver-opendata --dry-run

# Check submissions from mass import token only
mass-import bulk-approve --user-token 00000000-0000-0000-0000-000000000002 --dry-run
```

### Production Approval

After verifying with dry run:

```bash
# Approve all Vancouver Open Data submissions
mass-import bulk-approve --source vancouver-opendata

# Approve with custom batch size
mass-import bulk-approve --source vancouver-opendata --batch-size 10

# Skip confirmation prompt (use with caution)
mass-import bulk-approve --source vancouver-opendata --auto-confirm

# Limit to specific number of submissions
mass-import bulk-approve --source vancouver-opendata --max-submissions 50
```

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--source <name>` | Filter by data source name | None |
| `--batch-size <number>` | Batch size for approval processing | 25 |
| `--dry-run` | Show what would be approved without making changes | false |
| `--auto-confirm` | Skip confirmation prompts | false |
| `--user-token <token>` | Filter by user token | None |
| `--max-submissions <number>` | Maximum number of submissions to process | Unlimited |

## Safety Features

1. **Confirmation Prompt**: By default, requires typing "YES" to proceed
2. **Dry Run Mode**: Test what would be approved without making changes
3. **Batch Processing**: Processes submissions in configurable batches
4. **Error Handling**: Continues processing even if individual submissions fail
5. **Detailed Reporting**: Shows success/failure counts and error details

## Example Workflows

### Initial Import from Vancouver

```bash
# 1. First, do a dry run to see what would be approved
mass-import bulk-approve --source vancouver-opendata --dry-run

# 2. If results look good, approve with smaller batches
mass-import bulk-approve --source vancouver-opendata --batch-size 10

# 3. Check for any remaining submissions
mass-import bulk-approve --source vancouver-opendata --dry-run
```

### Troubleshooting Failed Submissions

```bash
# Check what's pending from mass import token
mass-import bulk-approve --user-token 00000000-0000-0000-0000-000000000002 --dry-run

# Approve a limited number to test
mass-import bulk-approve --user-token 00000000-0000-0000-0000-000000000002 --max-submissions 5
```

## Integration with Existing System

The bulk approval integrates with:

- **Review API**: Uses `/api/review/batch` endpoint
- **Permissions System**: Requires moderator/admin permissions
- **Audit Logging**: All approvals are logged for audit trail
- **Database**: Updates logbook entries and creates artwork records

## Error Handling

The system handles various error scenarios:

- **Network Errors**: Retries failed batches
- **Permission Errors**: Clear error messages for access issues
- **Data Validation**: Skips invalid submissions with detailed errors
- **Batch Failures**: Continues with remaining batches

## Monitoring and Logging

Each bulk approval operation provides:

- Total submissions processed
- Success/failure counts
- Detailed error messages for failed submissions
- Batch-level progress indicators
- Session IDs for tracking

## Security Considerations

- Only users with moderator/admin permissions can use bulk approval
- All operations are logged for audit purposes
- Confirmation prompts prevent accidental bulk operations
- Source filtering prevents approving unintended submissions

## Best Practices

1. **Always dry-run first** to validate what will be approved
2. **Use source filtering** to approve specific datasets
3. **Start with small batches** for initial testing
4. **Monitor error reports** and investigate failures
5. **Keep batch sizes reasonable** (10-50) for better error handling