# Rollback Plan: Structured Tag System Deployment

This document outlines procedures for rolling back the structured tag system deployment in case of critical issues during or after deployment.

## Overview

The structured tag system (Migration 006) includes comprehensive rollback procedures designed to preserve all data and restore previous functionality with minimal downtime.

### Rollback Scenarios

1. **Database Migration Issues**: Problems during the migration process
2. **Application Errors**: Critical bugs in the new tag validation or editing system
3. **Performance Issues**: Unacceptable performance degradation
4. **Data Integrity Problems**: Tag data corruption or validation failures

## Pre-Deployment Safety Measures

### Automated Backups

Before any production deployment:

```bash
# 1. Create full database backup
npm run backup:prod

# 2. Verify backup integrity
npm run backup:verify

# 3. Create rollback point snapshot
npm run migrate:snapshot:prod
```

### Rollback Testing

Test rollback procedures in staging environment:

```bash
# 1. Apply structured tag migration to staging
npm run migrate:dev 

# 2. Add test data with new tag format
# 3. Execute rollback procedures
npm run migrate:rollback

# 4. Verify data integrity
npm run test:data:integrity
```

## Rollback Procedures

### Level 1: Application Rollback (Code Only)

**When to Use**: Application bugs, validation issues, UI problems
**Downtime**: < 5 minutes
**Data Impact**: None

**Steps**:

1. **Revert Application Code**:
```bash
# Revert to previous stable version
git checkout previous-stable-tag

# Redeploy workers and frontend
npm run deploy:workers:rollback
npm run deploy:frontend:rollback
```

2. **Verify Rollback**:
```bash
# Check application is responding
curl https://art-api.abluestar.com/api/health

# Verify tag editing still works with legacy system
npm run test:integration:tags:legacy
```

3. **Monitor**:
- Watch error rates and response times
- Check tag editing functionality
- Monitor user feedback

**Recovery Time**: 2-5 minutes

### Level 2: Database Migration Rollback

**When to Use**: Database corruption, migration failures, performance issues
**Downtime**: 5-15 minutes  
**Data Impact**: Reverts to pre-migration tag format

**Steps**:

1. **Enable Maintenance Mode**:
```bash
# Set maintenance mode in workers
npm run maintenance:enable
```

2. **Rollback Database Migration**:
```bash
# Rollback migration 006 (structured tags)
npm run migrate:rollback:prod

# Verify rollback completed successfully
npm run migrate:status:prod
```

3. **Verify Data Integrity**:
```bash
# Check all artwork records are intact
npm run verify:artwork:integrity

# Verify tag data preserved in legacy format
npm run verify:tags:legacy
```

4. **Restart Applications**:
```bash
# Deploy previous application version
git checkout previous-stable-tag
npm run deploy

# Disable maintenance mode  
npm run maintenance:disable
```

5. **Post-Rollback Verification**:
- Verify artwork search functionality
- Test tag editing with legacy system
- Check photo uploads and moderation
- Monitor error rates and performance

**Recovery Time**: 10-15 minutes

### Level 3: Full System Restoration

**When to Use**: Catastrophic failure, data corruption, multiple system failures
**Downtime**: 15-30 minutes
**Data Impact**: Restore from backup (potential data loss)

**Steps**:

1. **Emergency Response**:
```bash
# Enable maintenance mode immediately
npm run maintenance:enable

# Alert operations team
npm run alert:operations:critical
```

2. **Restore from Backup**:
```bash
# List available backups
npm run backup:list:prod

# Restore from most recent clean backup
npm run backup:restore:prod --backup-id=YYYY-MM-DD-HHMMSS

# Verify restore completed successfully
npm run backup:verify:restore
```

3. **Rollback Application Code**:
```bash
# Revert to known stable version
git checkout stable-pre-tags-v1.0.0

# Clear all caches and rebuild
npm run clean && npm run build

# Deploy stable version
npm run deploy
```

4. **Data Recovery**:
```bash
# Recover any submissions since backup
npm run recover:submissions:since --backup-date=YYYY-MM-DD

# Manually verify critical data
npm run verify:critical:data
```

5. **System Restart**:
```bash
# Restart all services
npm run restart:all

# Disable maintenance mode
npm run maintenance:disable

# Monitor system health
npm run monitor:health:critical
```

**Recovery Time**: 20-30 minutes

## Rollback Decision Matrix

| Issue Type | Severity | Rollback Level | Max Downtime |
|------------|----------|----------------|--------------|
| UI/UX bugs | Low | Level 1 | 5 min |
| Validation errors | Medium | Level 1 | 5 min |
| Performance degradation | Medium | Level 2 | 15 min |
| Data corruption | High | Level 3 | 30 min |
| Database failure | Critical | Level 3 | 30 min |
| Security vulnerability | Critical | Level 1 | 5 min |

## Monitoring and Detection

### Automated Monitoring

**Health Checks**:
```javascript
// Tag system health check
{
  endpoint: '/api/health/tags',
  interval: '30s',
  alertThreshold: 3,
  rollbackTrigger: 'auto-level-1'
}
```

**Performance Monitoring**:
- Tag validation response time > 5s → Alert
- Tag search queries > 10s → Alert  
- Database JSON extraction errors → Alert
- Memory usage > 80% → Alert

**Error Rate Thresholds**:
- Tag validation errors > 10% → Level 1 rollback
- Database errors > 5% → Level 2 rollback
- System errors > 1% → Level 3 rollback

### Manual Monitoring Checklist

**Post-Deployment (First 30 minutes)**:
- [ ] Tag editing functionality works
- [ ] Tag validation provides helpful errors
- [ ] Search with new tag syntax works
- [ ] OpenStreetMap export generates correctly
- [ ] Legacy tag format still supported
- [ ] Performance metrics within normal range

**Ongoing Monitoring (First 24 hours)**:
- [ ] Error rates below threshold
- [ ] User feedback positive
- [ ] Database performance stable
- [ ] No data integrity issues reported
- [ ] Search relevance improved as expected

## Communication Plan

### Internal Communication

**Rollback Initiation**:
1. Notify development team immediately
2. Update status page: "Investigating tag system issues"
3. Alert operations and support teams
4. Document rollback reason and timeline

**During Rollback**:
1. Provide updates every 5 minutes
2. Coordinate between dev and ops teams
3. Monitor user feedback channels
4. Document all actions taken

**Post-Rollback**:
1. Conduct post-mortem meeting
2. Document lessons learned
3. Plan remediation for identified issues
4. Schedule re-deployment timeline

### External Communication

**User Notification Templates**:

**Maintenance Mode**:
```
🔧 Brief maintenance in progress
We're making some improvements to our artwork tagging system. 
Expected duration: 15 minutes
Status: [status-page-link]
```

**Rollback Complete**:
```
✅ Maintenance complete
The artwork database is back online. Thank you for your patience.
All artwork submissions and searches are working normally.
```

**Extended Issues**:
```
⚠️ Extended maintenance
We're working to resolve an issue with our new tagging system.
Estimated completion: [time]
Current functionality: Search and viewing work normally
Affected: Tag editing temporarily limited
```

## Data Preservation

### Backup Verification

**Pre-Rollback Backup**:
```sql
-- Verify all artwork records intact
SELECT COUNT(*) FROM artwork WHERE id IS NOT NULL;

-- Verify tag data completeness  
SELECT COUNT(*) FROM artwork WHERE tags IS NOT NULL;

-- Check for any corrupted JSON
SELECT COUNT(*) FROM artwork WHERE tags IS NOT NULL 
AND json_valid(tags) = 0;
```

**Post-Rollback Verification**:
```sql
-- Verify tag format reverted correctly
SELECT tags FROM artwork WHERE tags IS NOT NULL LIMIT 5;

-- Check search functionality still works
SELECT * FROM artwork WHERE json_extract(tags, '$.material') = 'bronze';

-- Verify no data loss occurred
SELECT COUNT(*) FROM artwork;
```

### Data Migration Logs

**Migration Tracking**:
```bash
# Enable detailed migration logging
export MIGRATION_LOG_LEVEL=debug

# Log all tag transformations
export MIGRATION_TRACK_CHANGES=true

# Save migration backup points
export MIGRATION_CREATE_SNAPSHOTS=true
```

**Log Analysis**:
```bash
# Analyze migration logs for issues
npm run analyze:migration:logs --migration=006

# Check for data transformation errors
npm run check:migration:errors --type=tags

# Verify migration completeness
npm run verify:migration:complete --migration=006
```

## Post-Rollback Procedures

### Issue Analysis

**Immediate Actions (First Hour)**:
1. Collect error logs and stack traces
2. Identify root cause of rollback
3. Assess impact on user data
4. Estimate fix complexity and timeline
5. Plan communication to stakeholders

**Detailed Analysis (First Day)**:
1. Review all system metrics during deployment
2. Analyze user feedback and support tickets
3. Identify any data inconsistencies
4. Document all contributing factors
5. Create detailed incident report

### Recovery Planning

**Short-term (1-7 days)**:
- Fix identified critical issues
- Enhance testing procedures
- Update rollback procedures based on lessons learned
- Prepare improved deployment plan

**Long-term (1-4 weeks)**:
- Comprehensive testing in staging environment
- Additional monitoring and alerting
- Gradual rollout strategy (if applicable)
- Documentation updates

### Re-deployment Preparation

**Prerequisites for Re-deployment**:
- [ ] Root cause identified and fixed
- [ ] Comprehensive testing completed
- [ ] Enhanced monitoring in place
- [ ] Rollback procedures tested and updated
- [ ] Stakeholder approval obtained
- [ ] Communication plan prepared

**Enhanced Deployment Strategy**:
1. **Staged Rollout**: Deploy to small percentage of users first
2. **Feature Flags**: Enable structured tags gradually
3. **A/B Testing**: Compare old vs new system performance
4. **Monitoring**: Enhanced real-time monitoring during deployment
5. **Quick Rollback**: Sub-5-minute rollback capability ready

## Testing Rollback Procedures

### Staging Environment Testing

**Monthly Rollback Drills**:
```bash
# Schedule: First Monday of each month
# Duration: 30 minutes
# Team: Dev + Ops

# 1. Apply latest migrations to staging
npm run migrate:staging:latest

# 2. Generate test data with new format
npm run test:generate:structured:tags

# 3. Execute rollback procedures
npm run test:rollback:full --level=2

# 4. Verify data integrity
npm run test:verify:rollback:success

# 5. Document any issues or improvements
npm run test:rollback:report
```

**Rollback Performance Benchmarks**:
- Level 1 rollback: < 5 minutes
- Level 2 rollback: < 15 minutes  
- Level 3 rollback: < 30 minutes
- Data integrity: 100% preserved
- Service availability: 95%+ during rollback

### Production Readiness Checklist

Before any production deployment:

- [ ] Rollback procedures tested in staging
- [ ] Backup systems verified and functional
- [ ] Monitoring and alerting configured
- [ ] Communication templates prepared
- [ ] On-call team briefed and available
- [ ] Rollback decision tree reviewed
- [ ] Emergency contact list updated

## Contact Information

### Emergency Contacts

**Development Team**:
- Primary: [dev-lead-email]
- Secondary: [senior-dev-email]
- Escalation: [tech-lead-email]

**Operations Team**:
- Primary: [ops-lead-email]
- Database Admin: [dba-email]
- Infrastructure: [infra-email]

**Management**:
- Engineering Manager: [eng-manager-email]
- Product Manager: [product-manager-email]

### Communication Channels

- **Immediate Issues**: #alerts-critical
- **Coordination**: #deployment-ops
- **User Communication**: #customer-updates
- **Post-mortem**: #incident-review

## Appendix

### Quick Reference Commands

```bash
# Emergency rollback (Level 1)
npm run rollback:emergency:level1

# Database rollback (Level 2)  
npm run rollback:emergency:level2

# Full system restore (Level 3)
npm run rollback:emergency:level3

# Health checks
npm run health:check:all
npm run health:check:tags
npm run health:check:database

# Monitoring
npm run monitor:errors:real-time
npm run monitor:performance:tags
npm run monitor:database:locks
```

### Recovery Time Objectives

- **RTO (Recovery Time Objective)**: 30 minutes maximum
- **RPO (Recovery Point Objective)**: 1 hour maximum
- **MTTR (Mean Time To Recovery)**: 15 minutes target
- **Data Loss Tolerance**: Zero for approved artworks

This rollback plan ensures that any deployment issues can be quickly resolved while preserving all user data and maintaining system availability.