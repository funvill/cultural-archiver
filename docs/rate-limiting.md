# Rate Limiting Configuration and Monitoring

The Cultural Archiver API implements comprehensive rate limiting to prevent
abuse while maintaining good user experience. This document covers
configuration, monitoring, and management of rate limits.

## Overview

Rate limiting is implemented using Cloudflare KV storage with per-user-token
tracking. Limits are enforced at the middleware level before request processing.

### Rate Limit Types

1. **Submission Limits**: 10 submissions per day per user token
2. **Query Limits**: 60 queries per hour per user token
3. **Magic Link Limits**: 5 requests per hour per email address

## Implementation Architecture

### Storage Strategy

Rate limits use Cloudflare KV with structured keys:

```typescript
// KV Key Patterns
const RATE_LIMIT_KEYS = {
  submissions: `rate:submit:${userToken}:${date}`, // YYYY-MM-DD format
  queries: `rate:query:${userToken}:${hour}`, // YYYY-MM-DD-HH format
  magicLinks: `rate:magic:${email}:${hour}`, // YYYY-MM-DD-HH format
};
```

### Counter Management

```typescript
interface RateLimitCounter {
  count: number;
  firstRequest: number; // Unix timestamp
  lastRequest: number; // Unix timestamp
}
```

## Configuration

### Environment Variables

```bash
# Rate limit settings (optional - defaults shown)
RATE_LIMIT_SUBMISSIONS_PER_DAY=10
RATE_LIMIT_QUERIES_PER_HOUR=60
RATE_LIMIT_MAGIC_LINKS_PER_HOUR=5

# KV namespace binding in wrangler.toml
[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "your-kv-namespace-id"
```

### Wrangler Configuration

```toml
# src/workers/wrangler.toml
[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "your-production-kv-id"
preview_id = "your-preview-kv-id"

[env.development]
[[env.development.kv_namespaces]]
binding = "RATE_LIMITS"
id = "your-dev-kv-id"
```

## Rate Limit Middleware

### Implementation

```typescript
export async function rateLimitMiddleware(
  c: Context,
  userToken: string,
  limitType: 'submission' | 'query' | 'magic-link'
): Promise<Response | void> {
  const config = getRateLimitConfig(limitType);
  const key = generateRateLimitKey(userToken, limitType);

  const current = await c.env.RATE_LIMITS.get(key);
  const counter = current ? JSON.parse(current) : { count: 0 };

  if (counter.count >= config.limit) {
    return c.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${config.limit} ${limitType}s per ${config.window}`,
          retryAfter: calculateRetryAfter(key, config),
        },
      },
      429
    );
  }

  // Increment counter
  counter.count++;
  counter.lastRequest = Date.now();
  if (!counter.firstRequest) counter.firstRequest = Date.now();

  await c.env.RATE_LIMITS.put(key, JSON.stringify(counter), {
    expirationTtl: config.ttl,
  });

  // Add rate limit headers to response
  c.header('X-RateLimit-Limit', config.limit.toString());
  c.header('X-RateLimit-Remaining', (config.limit - counter.count).toString());
  c.header('X-RateLimit-Reset', calculateResetTime(key, config).toString());
}
```

### Rate Limit Headers

All responses include rate limiting information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
X-RateLimit-Type: submission
```

## Monitoring and Analytics

### KV Storage Patterns

Monitor rate limit usage through KV storage analytics:

```bash
# List all rate limit keys
wrangler kv:key list --binding=RATE_LIMITS --prefix="rate:"

# Get specific user's limits
wrangler kv:key get "rate:submit:user-uuid:2024-01-15" --binding=RATE_LIMITS
```

### Metrics Collection

Track rate limiting metrics:

```typescript
interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  uniqueUsers: number;
  averageUsage: number;
  peakUsage: number;
}
```

### CloudFlare Analytics

Monitor through Cloudflare dashboard:

- Workers analytics for 429 response codes
- KV usage patterns and storage consumption
- Geographic distribution of rate-limited requests

## Management Operations

### Administrative Endpoints

For development and debugging:

```typescript
// Debug endpoints (development only)
app.get('/debug/rate-limits/:token', async c => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Not available in production' }, 404);
  }

  const token = c.req.param('token');
  const limits = await getAllRateLimits(c.env.RATE_LIMITS, token);
  return c.json({ token, limits });
});

app.delete('/debug/rate-limits/:token', async c => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Not available in production' }, 404);
  }

  const token = c.req.param('token');
  await clearUserRateLimits(c.env.RATE_LIMITS, token);
  return c.json({ message: 'Rate limits cleared', token });
});
```

### Manual Rate Limit Management

```bash
# Clear specific user's submission limits
wrangler kv:key delete "rate:submit:problematic-user:2024-01-15" --binding=RATE_LIMITS

# View top users by request volume
wrangler kv:key list --binding=RATE_LIMITS --prefix="rate:submit:" | head -20

# Bulk cleanup of expired keys (automated via TTL, but manual option available)
wrangler kv:bulk delete --binding=RATE_LIMITS --file=expired-keys.txt
```

## Rate Limit Bypass

### Reviewer Exemptions

Reviewers have elevated limits:

```typescript
const getEffectiveRateLimit = (
  userToken: string,
  isReviewer: boolean,
  limitType: string
) => {
  const baseLimits = {
    submission: 10,
    query: 60,
  };

  if (isReviewer) {
    return {
      submission: baseLimits.submission * 5, // 50 per day
      query: baseLimits.query * 3, // 180 per hour
    }[limitType];
  }

  return baseLimits[limitType];
};
```

### Emergency Override

For urgent situations:

```typescript
// Emergency bypass (admin only)
const EMERGENCY_BYPASS_TOKENS = new Set([
  'emergency-admin-token',
  'incident-response-token',
]);

if (EMERGENCY_BYPASS_TOKENS.has(userToken)) {
  // Skip rate limiting
  return;
}
```

## Performance Considerations

### KV Read/Write Optimization

- Use batch operations for bulk rate limit checks
- Implement local caching for frequently accessed limits
- Set appropriate TTLs to minimize storage usage

```typescript
// Batch rate limit checking
const checkMultipleRateLimits = async (
  kv: KVNamespace,
  checks: Array<{ token: string; type: string }>
) => {
  const keys = checks.map(check =>
    generateRateLimitKey(check.token, check.type)
  );
  const values = await Promise.all(keys.map(key => kv.get(key)));

  return checks.map((check, index) => ({
    ...check,
    current: values[index] ? JSON.parse(values[index]) : { count: 0 },
    allowed: values[index]
      ? JSON.parse(values[index]).count < getRateLimit(check.type)
      : true,
  }));
};
```

### Memory Usage

- Store minimal data in KV (only counters, not full request logs)
- Use efficient JSON serialization
- Clean up expired keys automatically via TTL

## Security Considerations

### Anti-Circumvention

Prevent rate limit bypass attempts:

```typescript
// Token validation
const validateUserToken = (token: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    token
  );
};

// Detect suspicious patterns
const detectAbnormalUsage = (counter: RateLimitCounter): boolean => {
  const timeWindow = counter.lastRequest - counter.firstRequest;
  const avgInterval = timeWindow / counter.count;

  // Flag if requests are too evenly spaced (bot-like behavior)
  return avgInterval < 1000 && counter.count > 5;
};
```

### IP-Based Fallback

Implement IP-based limiting as backup:

```typescript
// Secondary rate limiting by IP
const ipRateLimitKey = `rate:ip:${clientIP}:${hour}`;
const ipLimit = 1000; // Higher limit for IP-based limiting

// Apply both token and IP rate limiting
await Promise.all([checkTokenRateLimit(userToken), checkIPRateLimit(clientIP)]);
```

## Troubleshooting

### Common Issues

**High Rate Limit Rejections:**

1. Check for bot traffic patterns
2. Verify user token generation
3. Review limit configurations for appropriate levels

**KV Storage Errors:**

1. Verify KV namespace bindings in wrangler.toml
2. Check KV namespace permissions
3. Monitor KV storage quotas

**Performance Impact:**

1. Monitor request latency with rate limiting enabled
2. Optimize KV read/write patterns
3. Consider implementing request queuing for burst traffic

### Debugging Commands

```bash
# Check rate limit configuration
curl -H "Authorization: Bearer test-token" \
  http://localhost:8787/debug/rate-limits/test-token

# Test rate limit enforcement
for i in {1..15}; do
  echo "Request $i:"
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer test-token" \
    -X POST http://localhost:8787/api/logbook \
    -F "lat=49.2827" -F "lon=-123.1207" -F "note=Test"
  echo
done

# Monitor KV usage
wrangler kv:key list --binding=RATE_LIMITS | wc -l
```

## Best Practices

1. **Set Reasonable Limits**: Balance user experience with abuse prevention
2. **Provide Clear Feedback**: Include helpful error messages and retry timing
3. **Monitor Usage Patterns**: Regularly review rate limit effectiveness
4. **Plan for Growth**: Configure limits that scale with user base
5. **Document Changes**: Keep rate limit modifications in version control
6. **Test Thoroughly**: Verify rate limiting doesn't break legitimate workflows

## Future Enhancements

- **Dynamic Rate Limiting**: Adjust limits based on system load
- **User Tier System**: Different limits for verified vs anonymous users
- **Geographic Limits**: Region-specific rate limiting
- **Intelligent Rate Limiting**: ML-based abuse detection
- **Rate Limit Analytics Dashboard**: Real-time monitoring and alerting
