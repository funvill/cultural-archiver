# Production Migration Runbook

## Overview

This runbook provides step-by-step instructions for safely applying database migrations to the Cultural Archiver production environment using the new Wrangler-based migration system.

## Pre-Requisites

### Required Access
- [ ] Cloudflare account access with D1 permissions
- [ ] Wrangler CLI authenticated for production
- [ ] Production environment variables configured
- [ ] Team lead approval for migration

### Required Tools
- [ ] Wrangler CLI v4.33.2 or later
- [ ] Node.js 22+ for running migration scripts
- [ ] Access to production monitoring dashboard
- [ ] Communication channel for team notifications

## Pre-Migration Checklist

### 1. Code Preparation (1-2 days before)
- [ ] All migration files validated: `npm run migrate:validate`
- [ ] All tests passing: `npm run test`
- [ ] Migration tested in staging environment
- [ ] PR reviewed and approved
- [ ] Migration plan documented

### 2. Environment Verification (Day of migration)
- [ ] Production database connectivity confirmed
- [ ] Current migration status checked: `npm run migrate:status:prod`
- [ ] Recent backup verified (< 24 hours old)
- [ ] Team notified of maintenance window
- [ ] Rollback plan reviewed

## Migration Execution

### Step 1: Final Pre-Migration Backup (15 minutes)
```bash
# Create production backup with migration state
npm run backup:remote

# Verify backup completed successfully
npm run backup:validate
```

**Expected Output:**
- Backup file created in format: `backup-production-YYYY-MM-DD-HHMMSS.zip`
- No validation errors
- Migration state captured in backup metadata

**On Failure:**
- Do not proceed with migration
- Investigate backup system issues
- Contact database administrator if needed

### Step 2: Migration Status Check (5 minutes)
```bash
# Check current migration state
npm run migrate:status:prod
```

**Expected Output:**
- List of applied and pending migrations
- No migration conflicts
- Clean migration state

**On Failure:**
- Review migration conflicts
- Determine if manual intervention needed
- Document discrepancies before proceeding

### Step 3: Execute Migration (30-60 minutes)
```bash
# Run production migration with safety checks
npm run migrate:prod
```

**Interactive Prompts:**
1. **Environment Verification:** Confirm targeting production
2. **Database Connectivity:** Verify connection established  
3. **Pre-flight Checks:** All validations pass
4. **Migration Plan Review:** Confirm migrations to apply
5. **Final Confirmation:** Type 'y' to proceed

**Expected Output:**
- All pre-flight checks pass
- Migration applies successfully
- Final status shows all migrations applied
- No errors in output

**On Failure:**
- Stop migration process immediately
- Review error output carefully
- Follow rollback procedure if needed
- Document failure for post-mortem

### Step 4: Post-Migration Validation (15 minutes)
```bash
# Verify migration status
npm run migrate:status:prod

# Check application health
curl -f https://art-api.abluestar.com/health

# Verify database connectivity
npm run migrate:status:prod:json | grep '"success": true'
```

**Expected Output:**
- All migrations show as applied
- Application health check passes
- Database connections successful
- No error alerts in monitoring

**On Issues:**
- Review application logs
- Check database performance metrics  
- Prepare rollback if critical issues found

## Rollback Procedures

### Scenario 1: Migration Fails During Execution
```bash
# Stop any running migrations
Ctrl+C in terminal

# Check migration status
npm run migrate:status:prod

# Review what was applied
npm run migrate:status:prod:json > migration-failure-state.json

# Document the failure
echo "Migration failed at $(date)" >> migration-failure.log
```

**Next Steps:**
1. Contact database administrator
2. Review backup options for restoration
3. Prepare incident report

### Scenario 2: Application Issues After Migration
```bash
# Create immediate backup of current state
npm run backup:remote

# Check for database errors
# (Check application logs and monitoring dashboard)

# If critical, prepare rollback migration
npm run migrate:create "rollback_YYYY_MM_DD"
```

**Rollback Migration Template:**
- Use `DROP` statements for added tables
- Use `ALTER TABLE DROP COLUMN` for added columns
- Restore previous data where possible
- Test rollback in staging first

## Communication Protocols

### Start of Migration
```
🚀 Production Migration Starting
- Window: [TIME] - [TIME] EST  
- Migrations: [COUNT] pending
- Expected duration: [TIME]
- Status updates every 15 minutes
```

### During Migration
```
⏱️ Migration Update ([TIME])
- Status: [IN_PROGRESS/COMPLETED/FAILED]
- Current step: [DESCRIPTION]
- Next update in 15 minutes
```

### Migration Complete
```
✅ Production Migration Complete
- Duration: [ACTUAL_TIME]
- Migrations applied: [COUNT]
- Status: All systems operational
- Monitoring continues for 2 hours
```

### Emergency Alert
```
🚨 Migration Issue Detected
- Issue: [DESCRIPTION]
- Impact: [SEVERITY]
- Action: [CURRENT_RESPONSE]
- ETA for update: [TIME]
```

## Post-Migration Monitoring

### First 30 Minutes (Critical)
- [ ] Application health checks every 5 minutes
- [ ] Database error rate monitoring
- [ ] User-facing functionality spot checks
- [ ] Team available for immediate response

### First 2 Hours (High Priority)
- [ ] Monitor application performance metrics
- [ ] Check for any user-reported issues
- [ ] Verify all major features working
- [ ] Database performance within normal ranges

### First 24 Hours (Standard)
- [ ] Review error logs for anomalies
- [ ] Monitor backup system functionality
- [ ] Check migration state remains stable
- [ ] Document any observations

## Troubleshooting Guide

### Common Issues

#### "No migrations directory found"
```bash
# Ensure running from correct directory
cd src/workers
pwd  # Should show: .../cultural-archiver/src/workers

# Check wrangler.toml configuration  
grep migrations_dir wrangler.toml
```

#### "Database connection failed"
```bash
# Verify wrangler authentication
wrangler auth list

# Check database configuration
wrangler d1 info cultural-archiver --env production
```

#### "Migration validation failed"
```bash
# Run validation to see specific errors
npm run migrate:validate

# Review error output for D1 compatibility issues
# Fix migrations before proceeding
```

## Success Criteria

✅ **Migration Complete When:**
- All planned migrations applied successfully  
- Application health checks pass
- Database performance within normal ranges
- No critical errors in monitoring
- Team confirms system functionality

❌ **Consider Rollback When:**
- Application response time > 2x baseline
- Error rate > 5% increase from baseline  
- Critical functionality broken
- Database connection failures
- User-reported major issues

## Documentation Updates

After successful migration:
- [ ] Update migration status in team documentation
- [ ] Record any lessons learned
- [ ] Update runbook with improvements
- [ ] Share success metrics with team

## Emergency Contacts

- **Database Administrator:** [CONTACT_INFO]
- **Team Lead:** [CONTACT_INFO]  
- **On-Call Engineer:** [CONTACT_INFO]
- **Cloudflare Support:** [SUPPORT_LINK]

---

**Runbook Version:** 1.0  
**Last Updated:** 2025-09-05  
**Tested On:** Staging Environment  
**Next Review:** After first production use