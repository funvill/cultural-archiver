# Mass Import System - Troubleshooting Guide

This guide helps resolve common issues when using the Mass Import System for Cultural Archiver.

## Quick Diagnostics

**First step**: Always run the status command to check system health:
```bash
mass-import status
```

## Common Issues and Solutions

### 1. Configuration Issues

#### Problem: "Configuration file not found"
```
⚠️ Failed to load config file config.json: ENOENT: no such file or directory
```

**Solutions:**
- Check the file path is correct and file exists
- Use absolute paths or paths relative to current directory
- Use example configs: `mass-import status --config examples/config-dev.json`

#### Problem: "Invalid configuration values"
**Solutions:**
- Ensure all numeric values are valid numbers
- Check API endpoint URL format (must start with http:// or https://)
- Verify token is a valid UUID format
- Use `mass-import status --config-only` to validate configuration

### 2. API Connectivity Issues

#### Problem: "API endpoint is not accessible"
```
❌ API endpoint is not accessible: getaddrinfo ENOTFOUND art-api.abluestar.com
```

**Solutions:**
- Check internet connectivity
- Verify API endpoint URL in configuration
- Try with development endpoint: `--api-endpoint http://localhost:8787`
- Use `--config-only` flag to skip connectivity check during testing

#### Problem: "API endpoint responded with status: 401"
**Solutions:**
- Check the user token is valid
- Verify the mass import user exists in the system
- Ensure the token has proper permissions for mass import

#### Problem: "API endpoint responded with status: 429"
**Solutions:**
- Rate limiting is in effect, reduce batch size: `--batch-size 10`
- Increase retry delay: `--retry-delay 2000`
- Wait before retrying the import

### 3. Data Validation Issues

#### Problem: "Invalid records: X"
**Solutions:**
- Use Vancouver-specific command for Vancouver data: `mass-import vancouver`
- Check data format matches expected schema
- Use `mass-import validate <file>` to see detailed validation errors
- Ensure coordinates are valid (lat: -90 to 90, lon: -180 to 180)

#### Problem: "Photo not accessible" warnings
```
⚠️ Photo not accessible: https://opendata.vancouver.ca/...
```

**Solutions:**
- This is often due to network restrictions (expected in some environments)
- Photos will be processed if they become accessible later
- Use dry-run mode to test without photo processing: `--dry-run`
- Check if photo URLs are valid and publicly accessible

### 4. Import Process Issues

#### Problem: "Failed to process batch"
**Solutions:**
- Reduce batch size: `--batch-size 25`
- Enable continue-on-error (enabled by default)
- Check specific error messages in output
- Use dry-run mode first to validate data: `--dry-run`

#### Problem: "Duplicate detection issues"
**Solutions:**
- Adjust detection radius: `--duplicate-radius 100`
- Modify title similarity threshold: `--similarity-threshold 0.7`
- Check for existing external_id tags to prevent true duplicates

#### Problem: "Memory issues with large datasets"
**Solutions:**
- Use smaller batch sizes: `--batch-size 10`
- Process data in chunks: `--limit 100 --offset 0`, then `--limit 100 --offset 100`
- Monitor system memory usage

### 5. Bulk Approval Issues

#### Problem: "No pending submissions found"
```
⚠️ No pending submissions found matching criteria
```

**Solutions:**
- Check filter criteria (source, user token)
- Verify submissions exist in pending state
- Use dry-run first: `mass-import bulk-approve --dry-run`
- Check submission status in the review interface

#### Problem: "Bulk approval permission denied"
**Solutions:**
- Ensure user has admin/moderator permissions
- Check authentication token is valid
- Verify API endpoint supports bulk approval

## Performance Optimization

### Large Datasets (1000+ records)
```bash
# Use optimized settings for large imports
mass-import vancouver \
  --batch-size 100 \
  --max-retries 5 \
  --retry-delay 2000 \
  --input large-dataset.json
```

### Slow Network Connections
```bash
# Use conservative settings for unstable connections
mass-import vancouver \
  --batch-size 10 \
  --max-retries 10 \
  --retry-delay 5000 \
  --input data.json
```

### Development/Testing
```bash
# Fast iteration during development
mass-import vancouver \
  --config examples/config-dev.json \
  --limit 10 \
  --dry-run \
  --verbose \
  --input test-data.json
```

## Debugging Steps

### 1. Enable Verbose Logging
```bash
mass-import vancouver --verbose --input data.json
```

### 2. Test with Small Datasets
```bash
# Test with just a few records first
mass-import vancouver --limit 5 --dry-run --input data.json
```

### 3. Validate Configuration
```bash
mass-import status --config your-config.json
```

### 4. Check API Health
```bash
# Test API connectivity separately
curl -I https://art-api.abluestar.com/health
```

### 5. Inspect Data Format
```bash
# Validate data structure
mass-import validate data.json --limit 1 --verbose
```

## Environment-Specific Issues

### Docker/Container Environments
- Ensure network access to API endpoints
- Check DNS resolution for external services
- Verify file permissions for input/output files

### CI/CD Pipelines
- Use configuration files instead of CLI options
- Set appropriate timeouts for large datasets
- Consider using environment variables for sensitive config

### Windows Systems
- Use PowerShell instead of Command Prompt
- Use forward slashes in paths: `./examples/config-dev.json`
- Escape special characters in file paths

## Getting Help

1. **Check system status**: `mass-import status`
2. **Review this troubleshooting guide**
3. **Enable verbose logging**: `--verbose`
4. **Test with dry-run**: `--dry-run`
5. **Start with small datasets**: `--limit 10`

## Error Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | General error (configuration, API, validation) |
| 2 | Data processing error |
| 3 | Network connectivity error |

## Log Files

The system uses structured console logging. To save logs:

```bash
# Save all output to file
mass-import vancouver --input data.json > import-log.txt 2>&1

# Save only errors
mass-import vancouver --input data.json 2> error-log.txt
```

## Support Resources

- **Library Documentation**: `src/lib/mass-import/README.md`
- **API Documentation**: `/docs/api.md` 
- **Configuration Examples**: `src/lib/mass-import/examples/`
- **Bulk Approval Guide**: `src/lib/mass-import/BULK_APPROVAL_GUIDE.md`