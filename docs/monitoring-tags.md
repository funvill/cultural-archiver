# Tag System Monitoring and Error Logging Guide

This guide outlines monitoring procedures and error logging strategies for the structured tag system deployment and ongoing operations.

## Overview

The structured tag system introduces new validation, processing, and search capabilities that require comprehensive monitoring to ensure optimal performance and early detection of issues.

## Monitoring Architecture

### System Components to Monitor

1. **Tag Validation Service** (`src/workers/lib/tag-validation.ts`)
2. **Tag Editor Frontend** (`src/frontend/src/components/TagEditor.vue`)
3. **Search Integration** (`src/workers/routes/discovery.ts`)
4. **OpenStreetMap Export** (`src/workers/routes/export.ts`)
5. **Database Performance** (JSON extraction queries)

### Monitoring Stack

- **Application Metrics**: Cloudflare Workers Analytics
- **Database Monitoring**: D1 Query Performance
- **Error Tracking**: Custom logging with structured data
- **Performance Monitoring**: Response time tracking
- **User Experience**: Frontend error reporting

## Key Performance Indicators (KPIs)

### Primary Metrics

| Metric | Target | Warning Threshold | Critical Threshold |
|--------|--------|------------------|-------------------|
| Tag validation response time | <500ms | >1s | >5s |
| Tag validation success rate | >95% | <90% | <80% |
| Search query performance | <2s | >5s | >10s |
| OSM export success rate | >99% | <95% | <90% |
| Database JSON query time | <100ms | >500ms | >2s |

### Secondary Metrics

| Metric | Target | Monitoring Frequency |
|--------|--------|---------------------|
| Tag schema coverage | >80% | Daily |
| User engagement with tags | Trending up | Weekly |
| Tag data quality score | >90% | Daily |
| Export data completeness | >95% | Hourly |

## Error Classification and Logging

### Error Severity Levels

#### Level 1: Info
- Successful tag validations
- Schema migrations
- Export completions
- User tag additions

#### Level 2: Warning  
- Validation warnings (non-blocking)
- Performance degradation
- Missing optional fields
- Legacy format usage

#### Level 3: Error
- Validation failures
- Database query errors
- Export failures
- API timeout errors

#### Level 4: Critical
- System unavailability
- Data corruption
- Security vulnerabilities
- Mass validation failures

### Structured Logging Format

```typescript
interface TagSystemLog {
  timestamp: string;        // ISO 8601 format
  level: 'info' | 'warning' | 'error' | 'critical';
  component: string;        // 'validation' | 'search' | 'export' | 'editor'
  action: string;           // 'validate' | 'search' | 'export' | 'edit'
  artworkId?: string;       // Related artwork ID
  userId?: string;          // User token (anonymized)
  tagKey?: string;          // Specific tag being processed
  tagValue?: string;        // Tag value (sanitized)
  errorCode?: string;       // Specific error code
  errorMessage?: string;    // Human-readable error
  duration?: number;        // Operation duration in ms
  metadata?: object;        // Additional context
}
```

### Sample Log Entries

**Successful Validation**:
```json
{
  "timestamp": "2024-12-19T20:15:00.000Z",
  "level": "info",
  "component": "validation",
  "action": "validate",
  "artworkId": "artwork-123",
  "userId": "user-456",
  "tagKey": "height",
  "tagValue": "5.5",
  "duration": 45,
  "metadata": {
    "validationResult": "success",
    "schemaVersion": "1.0.0"
  }
}
```

**Validation Error**:
```json
{
  "timestamp": "2024-12-19T20:16:30.000Z",
  "level": "error", 
  "component": "validation",
  "action": "validate",
  "artworkId": "artwork-789",
  "userId": "user-012",
  "tagKey": "year",
  "tagValue": "3000",
  "errorCode": "INVALID_YEAR_RANGE",
  "errorMessage": "Year must be between 1000 and 2025",
  "duration": 12,
  "metadata": {
    "inputValue": "3000",
    "allowedRange": "1000-2025",
    "suggestion": "Check if this is a typo - did you mean 2000?"
  }
}
```

**Performance Warning**:
```json
{
  "timestamp": "2024-12-19T20:17:45.000Z",
  "level": "warning",
  "component": "search",
  "action": "tag_search",
  "duration": 3500,
  "errorCode": "SLOW_QUERY_WARNING",
  "errorMessage": "Tag search query exceeded 3s threshold",
  "metadata": {
    "query": "tag:artist_name:banksy",
    "resultCount": 150,
    "queryPlan": "json_extract_index_scan"
  }
}
```

## Monitoring Implementation

### Frontend Monitoring

**Tag Editor Performance**:
```typescript
// src/frontend/src/components/TagEditor.vue
const logTagValidation = (tagKey: string, value: string, result: ValidationResult, duration: number) => {
  const logEntry: TagSystemLog = {
    timestamp: new Date().toISOString(),
    level: result.valid ? 'info' : 'error',
    component: 'editor',
    action: 'validate',
    tagKey,
    tagValue: sanitizeForLogging(value),
    duration,
    errorCode: result.errors?.[0]?.code,
    errorMessage: result.errors?.[0]?.message,
    metadata: {
      validationResult: result.valid ? 'success' : 'failure',
      warningCount: result.warnings?.length || 0
    }
  };
  
  // Send to logging service
  logToMonitoring(logEntry);
};
```

**User Experience Monitoring**:
```typescript
// Track user interactions with tag system
const trackTagUsage = () => {
  // Tag selection patterns
  // Common validation errors  
  // Time to complete tag editing
  // Abandonment rates
};
```

### Backend Monitoring

**Validation Service Monitoring**:
```typescript
// src/workers/lib/tag-validation.ts
export const logValidationMetrics = (
  artworkId: string,
  tags: any,
  result: TagValidationResult,
  duration: number
) => {
  const logEntry: TagSystemLog = {
    timestamp: new Date().toISOString(),
    level: result.valid ? 'info' : 'error',
    component: 'validation',
    action: 'validate',
    artworkId,
    duration,
    metadata: {
      tagCount: Object.keys(tags.tags || {}).length,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      schemaVersion: tags.version
    }
  };
  
  if (!result.valid) {
    logEntry.errorCode = 'VALIDATION_FAILED';
    logEntry.errorMessage = `Validation failed: ${result.errors.length} errors`;
  }
  
  console.log(JSON.stringify(logEntry));
};
```

**Search Performance Monitoring**:
```typescript
// Monitor tag-based search queries
const monitorTagSearch = async (query: string, startTime: number) => {
  const duration = Date.now() - startTime;
  
  const logEntry: TagSystemLog = {
    timestamp: new Date().toISOString(), 
    level: duration > 5000 ? 'warning' : 'info',
    component: 'search',
    action: 'tag_search',
    duration,
    metadata: {
      query: sanitizeQuery(query),
      isTagQuery: query.includes('tag:'),
      queryComplexity: calculateComplexity(query)
    }
  };
  
  if (duration > 5000) {
    logEntry.errorCode = 'SLOW_QUERY_WARNING';
    logEntry.errorMessage = `Search query exceeded 5s threshold`;
  }
  
  console.log(JSON.stringify(logEntry));
};
```

### Database Monitoring

**Query Performance Tracking**:
```sql
-- Enable D1 query logging for tag-related queries
-- Monitor queries that use json_extract functions

-- Common tag queries to monitor:
-- 1. Tag type searches
EXPLAIN QUERY PLAN 
SELECT * FROM artwork WHERE json_extract(tags, '$.tags.artwork_type') = 'statue';

-- 2. Material searches  
EXPLAIN QUERY PLAN
SELECT * FROM artwork WHERE json_extract(tags, '$.tags.material') = 'bronze';

-- 3. Artist searches
EXPLAIN QUERY PLAN  
SELECT * FROM artwork WHERE json_extract(tags, '$.tags.artist_name') LIKE '%doe%';
```

**Index Usage Monitoring**:
```typescript
// Monitor index usage for tag queries
const monitorIndexUsage = async () => {
  const queries = [
    "SELECT COUNT(*) FROM artwork WHERE json_extract(tags, '$.tags.artwork_type') IS NOT NULL",
    "SELECT COUNT(*) FROM artwork WHERE json_extract(tags, '$.tags.material') IS NOT NULL",
    "SELECT COUNT(*) FROM artwork WHERE json_extract(tags, '$.tags.artist_name') IS NOT NULL"
  ];
  
  for (const query of queries) {
    const startTime = Date.now();
    await db.prepare(query).first();
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warning',
        component: 'database',
        action: 'query',
        duration,
        errorCode: 'SLOW_INDEX_QUERY',
        errorMessage: 'Tag index query exceeded 1s threshold',
        metadata: { query }
      }));
    }
  }
};
```

## Alerting Configuration

### Real-time Alerts

**Critical Alerts** (Immediate notification):
- Tag validation success rate < 80%
- Database errors > 1%
- System unavailability
- Data corruption detected

**Warning Alerts** (15-minute delay):
- Tag validation success rate < 90%
- Query performance degradation
- High error rates in specific tag types

**Info Alerts** (1-hour aggregation):
- Usage pattern changes
- Schema coverage reports
- Performance summaries

### Alert Destinations

```typescript
interface AlertConfig {
  critical: {
    channels: ['slack-critical', 'email-oncall', 'pager'];
    frequency: 'immediate';
  };
  warning: {
    channels: ['slack-alerts', 'email-dev-team'];
    frequency: '15-minute-batched';
  };
  info: {
    channels: ['slack-monitoring'];
    frequency: 'hourly-summary';
  };
}
```

## Custom Dashboards

### Operations Dashboard

**Tag System Health Overview**:
```typescript
const tagSystemDashboard = {
  title: "Tag System Health",
  panels: [
    {
      title: "Validation Success Rate",
      type: "gauge",
      target: 95,
      warning: 90,
      critical: 80
    },
    {
      title: "Average Response Time", 
      type: "line-chart",
      timespan: "24h",
      yAxis: "milliseconds"
    },
    {
      title: "Error Breakdown",
      type: "pie-chart", 
      groupBy: "errorCode"
    },
    {
      title: "Tag Usage Distribution",
      type: "bar-chart",
      groupBy: "tagKey"
    }
  ]
};
```

### Development Dashboard

**Tag Development Metrics**:
- Schema coverage by category
- Most common validation errors
- User behavior patterns
- Performance trends over time

## Error Analysis Procedures

### Daily Error Review

**Automated Reports** (Every 24 hours):
```bash
# Generate daily tag system report
npm run monitor:tags:daily-report

# Analyze validation error patterns
npm run analyze:validation:errors --since=24h

# Check performance regressions
npm run analyze:performance:trends --component=tags
```

**Manual Review Checklist**:
- [ ] Review critical and warning alerts
- [ ] Check error pattern changes
- [ ] Identify any new error types
- [ ] Assess performance trends
- [ ] Review user feedback related to tags
- [ ] Plan fixes for recurring issues

### Weekly Performance Analysis

**Performance Review Process**:
1. **Collect Metrics**: Aggregate all tag-related metrics
2. **Trend Analysis**: Compare to previous weeks
3. **Bottleneck Identification**: Find performance constraints
4. **Optimization Planning**: Plan improvements
5. **Capacity Planning**: Project future needs

**Key Questions**:
- Are validation times increasing?
- Which tag types cause most errors?
- Is search performance degrading?
- Are users successfully completing tag edits?
- What are the most common validation failures?

## Troubleshooting Guides

### Common Issues and Solutions

**High Validation Error Rate**:
1. Check for schema changes or updates
2. Review most common error codes
3. Analyze user input patterns
4. Check for data migration issues
5. Review validation logic for bugs

**Slow Query Performance**:
1. Check index usage on json_extract queries
2. Monitor database connection pool
3. Analyze query complexity trends
4. Review database statistics
5. Consider query optimization

**Export Failures**:
1. Check tag data completeness
2. Review OpenStreetMap format compliance
3. Monitor external service availability
4. Analyze export data volumes
5. Check for schema compatibility issues

### Escalation Procedures

**Level 1 - Development Team** (Response: 30 minutes):
- Validation errors and warnings
- Performance degradation
- User experience issues

**Level 2 - Operations Team** (Response: 15 minutes):
- Database errors
- System availability issues
- Critical performance problems

**Level 3 - Emergency Response** (Response: 5 minutes):
- System unavailability
- Data corruption
- Security incidents

## Monitoring Tools and Commands

### Command Line Monitoring

```bash
# Real-time error monitoring
npm run monitor:tags:errors:live

# Performance analysis  
npm run monitor:tags:performance --since=1h

# Validation error breakdown
npm run analyze:validation:errors --group-by=tagKey

# Search performance monitoring
npm run monitor:search:performance --filter=tag-queries

# Database query analysis
npm run analyze:db:queries --component=tags
```

### Log Query Examples

**Find validation errors for specific tag**:
```bash
# Search logs for height validation errors
grep "tagKey.*height.*level.*error" /var/log/cultural-archiver.log | tail -20
```

**Performance analysis**:
```bash
# Find slow validation operations
grep "duration.*[5-9][0-9][0-9][0-9]" /var/log/cultural-archiver.log | grep validation
```

**Error pattern analysis**:
```bash
# Most common error codes
grep "errorCode" /var/log/cultural-archiver.log | cut -d'"' -f4 | sort | uniq -c | sort -nr
```

## Reporting and Documentation

### Automated Reports

**Daily Health Report** (Email to dev team):
- Validation success rates
- Performance metrics summary
- Top error codes and frequencies
- User engagement metrics
- Action items from previous day

**Weekly Performance Report** (Management):
- System reliability metrics
- Performance trends
- User satisfaction indicators
- Capacity utilization
- Upcoming optimization plans

**Monthly Analytics Report** (Product team):
- Tag usage patterns
- Schema coverage analysis
- User behavior insights
- Feature adoption metrics
- Recommendations for improvements

### Issue Documentation Template

```markdown
## Tag System Issue Report

**Date**: [YYYY-MM-DD]
**Component**: [validation|search|export|editor]
**Severity**: [info|warning|error|critical]

### Issue Description
[Brief description of the issue]

### Error Details
- **Error Code**: [ERROR_CODE]
- **Error Message**: [Error message]
- **Affected Users**: [Number/percentage]
- **Duration**: [How long the issue lasted]

### Root Cause Analysis
[Detailed analysis of why the issue occurred]

### Resolution
[Steps taken to resolve the issue]

### Prevention
[Measures to prevent recurrence]

### Lessons Learned
[Key takeaways for future improvements]
```

This comprehensive monitoring and logging strategy ensures early detection of issues, quick resolution of problems, and continuous improvement of the tag system performance and reliability.