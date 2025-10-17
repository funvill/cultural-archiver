# Mass Import v3 Performance Optimization Plan

## Current Performance Analysis

### Database Query Patterns

**Artwork Import Flow:**
1. Auth query: `SELECT id FROM users WHERE user_token = ?`
2. Role check: `SELECT role FROM user_roles WHERE user_id = ? AND role = ?`
3. For each artist name:
   - Artist lookup: `SELECT id, name FROM artists WHERE name = ?`
   - Possible insert: `INSERT INTO artists (...)`
4. Artwork insert: `INSERT INTO artwork (...)`
5. For each artist: `INSERT INTO artwork_artists (...)`

**Total queries per artwork:** 2 (auth) + N*2 (artists) + 1 (artwork) + N (links) = **3 + 3N queries**

**Artist Import Flow:**
1. Auth query (2 queries)
2. Duplicate check: `SELECT id FROM artists WHERE name = ?`
3. Artist insert: `INSERT INTO artists (...)`

**Total queries per artist:** 2 (auth) + 1 (dup) + 1 (insert) = **4 queries**

### Optimization Opportunities

#### 🎯 High Impact
1. **Batch database operations** - Use D1 batch API for multiple inserts
2. **Reuse auth context** - Authenticate once per session, not per request
3. **Parallel artist lookups** - Query all artists at once with IN clause
4. **Transaction optimization** - Minimize transaction scope

#### 🔧 Medium Impact
5. **Prepared statement caching** - Cache frequently used queries
6. **Index verification** - Ensure optimal indexes on lookup fields
7. **JSON string caching** - Pre-compute JSON strings where possible

#### 📊 Low Impact (Future)
8. **Connection pooling** - D1 handles this automatically
9. **Query result caching** - For frequently accessed read-only data

## Implementation Plan

### Phase 7.1: Batch Operations ✅
**Goal:** Reduce query count from 3+3N to 3+2 queries

**Changes:**
- Use D1 batch API for multiple artist inserts
- Use D1 batch API for artwork_artists links
- Parallel artist lookups with IN clause

**Expected improvement:** 50-70% reduction in query count for multi-artist artworks

### Phase 7.2: Statement Preparation
**Goal:** Improve query execution time

**Changes:**
- Cache prepared statements in module scope
- Reuse prepared statements across requests

**Expected improvement:** 10-20% faster query execution

### Phase 7.3: Transaction Optimization
**Goal:** Minimize transaction overhead

**Changes:**
- Group all writes in single transaction
- Reduce transaction scope to minimum necessary operations

**Expected improvement:** 15-25% faster overall execution

### Phase 7.4: Profiling & Verification
**Goal:** Measure and validate improvements

**Tools:**
- Add detailed timing breakdowns
- Create performance benchmarks
- Test with realistic batch sizes

**Target:** <500ms p95 for single artwork with 3 artists

## Performance Targets

| Metric | Before | Target | Stretch |
|--------|--------|--------|---------|
| Single artwork, 0 artists | 200ms | 100ms | 50ms |
| Single artwork, 1 artist | 300ms | 150ms | 75ms |
| Single artwork, 3 artists | 500ms | 200ms | 100ms |
| Single artist | 150ms | 75ms | 40ms |
| Query count (3 artists) | 12 | 5 | 4 |

## Monitoring

Add timing logs for:
- Authentication (combined)
- Validation
- Artist processing (combined)
- Artwork creation
- Artist linking (combined)
- Total request time

## Testing Strategy

1. Unit tests for batch operations
2. Integration tests with realistic data
3. Load tests with 100+ concurrent requests
4. Performance regression tests

## Compatibility

All optimizations maintain:
- ✅ Existing API contract
- ✅ Error handling behavior
- ✅ Verbose logging support
- ✅ All 62 existing tests passing
