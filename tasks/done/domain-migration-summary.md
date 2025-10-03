# Domain Migration Summary - Public Art Registry

**Migration Date:** October 3, 2025  
**Old Domain:** art.abluestar.com  
**New Domain:** publicartregistry.com  
**Old Branding:** Cultural Archiver  
**New Branding:** Public Art Registry

---

## ✅ Completed Automated Updates

### Configuration Files

**Root Configuration:**
- ✅ `wrangler.toml` - Updated worker name, routes, database name, R2 bucket, email addresses
- ✅ `package.json` - Updated project name, description, database migration commands
- ✅ `.github/copilot-instructions.md` - Updated domain references

**Workers Configuration:**
- ✅ `src/workers/wrangler.toml` - Updated worker name, routes, database name, R2 bucket, email addresses

**Frontend Configuration:**
- ✅ `src/frontend/wrangler.jsonc` - Updated worker name

**Documentation:**
- ✅ `README.md` - Updated project title and description from "Cultural Archiver" to "Public Art Registry"

### Vue Components

- ✅ `src/frontend/src/views/HelpView.vue` - Updated support email to support@publicartregistry.com
- ✅ `src/frontend/src/components/ErrorBoundary.vue` - Updated support email
- ✅ `src/frontend/src/components/DevelopmentBanner.vue` - Updated support email

### Task Files

- ✅ `tasks/next.md` - Updated email references

---

## 📝 Manual Updates Required

Due to file locks, the following files require manual updates. See `tasks/domain-migration-manual-updates.md` for detailed instructions.

### Legal Documents (High Priority)

These files contain extensive branding that should be updated:

1. `src/frontend/scripts/public/docs/terms-of-service.md`
2. `src/frontend/scripts/public/docs/privacy-policy.md`
3. `src/frontend/public/docs/terms-of-service.md`
4. `src/frontend/public/docs/privacy-policy.md`

**Search and Replace:**
- `Cultural Archiver` → `Public Art Registry`
- `art.abluestar.com` → `publicartregistry.com`
- `privacy@art.abluestar.com` → `privacy@publicartregistry.com`

### Test Files (Low Priority)

- `src/frontend/test-results/*/error-context.md` - Update email references (optional, can be regenerated)

---

## 🚀 New Files Created

### Planning & Documentation

1. **`tasks/plan-domain-update.md`**
   - Comprehensive migration plan
   - Search-and-replace guidance
   - Acceptance criteria

2. **`tasks/cloudflare-manual-setup.md`**
   - Step-by-step Cloudflare configuration instructions
   - DNS setup guide
   - SSL/TLS configuration
   - Workers routing
   - R2 bucket setup
   - Email configuration (SPF/DKIM/DMARC)
   - Environment variables and secrets
   - Verification checklist
   - Troubleshooting guide
   - Rollback plan

3. **`tasks/domain-migration-manual-updates.md`**
   - List of files requiring manual updates
   - PowerShell commands for batch updates
   - Next steps checklist

### CI/CD Workflows

4. **`.github/workflows/deploy-staging.yml`**
   - Auto-deploys to `test.publicartregistry.com` on every push to non-main branches
   - Runs tests before deployment
   - Posts deployment URL as commit comment

5. **`.github/workflows/deploy-production.yml`**
   - Deploys to `publicartregistry.com` only when PRs are merged to main
   - Runs full test suite, type checking, and linting
   - Posts deployment status as PR comment
   - Creates production release tags

---

## 🔧 Cloudflare Configuration Required

Before the new domain will work, you need to complete manual steps in the Cloudflare dashboard. See `tasks/cloudflare-manual-setup.md` for detailed instructions.

### High-Level Checklist

- [ ] Add `publicartregistry.com` to Cloudflare
- [ ] Update nameservers at domain registrar
- [ ] Configure DNS records (root, api, photos, test subdomains)
- [ ] Enable SSL/TLS settings
- [ ] Deploy and configure Workers
- [ ] Create/rename R2 bucket to `public-art-registry-photos`
- [ ] Configure R2 custom domain for `photos.publicartregistry.com`
- [ ] Create/update KV namespaces
- [ ] Create/rename D1 database to `public-art-registry`
- [ ] Run database migrations
- [ ] Configure email DNS records (SPF, DKIM, DMARC)
- [ ] Set Worker secrets (API keys, account IDs)
- [ ] Configure staging environment
- [ ] Set up GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
- [ ] Test staging deployment
- [ ] Test production deployment
- [ ] Verify all functionality

---

## 🎯 Domain Configuration Summary

### Production Environment

- **Frontend:** `publicartregistry.com`
- **API:** `api.publicartregistry.com`
- **Photos:** `photos.publicartregistry.com`
- **Email (noreply):** `noreply@publicartregistry.com`
- **Email (support):** `support@publicartregistry.com`
- **Worker Name:** `public-art-registry-api`
- **Database Name:** `public-art-registry`
- **R2 Bucket:** `public-art-registry-photos`

### Staging Environment

- **Frontend:** `test.publicartregistry.com`
- **API:** `test.publicartregistry.com/api` (or separate subdomain)
- **Auto-deploy:** On every commit to non-main branches
- **Purpose:** Preview changes before production

---

## 📋 Updated Infrastructure Names

### Cloudflare Workers

**Old:**
- `cultural-archiver-api`

**New:**
- `public-art-registry-api` (production)
- `public-art-registry-api-staging` (staging)

### D1 Database

**Old:**
- `cultural-archiver`

**New:**
- `public-art-registry`

### R2 Buckets

**Old:**
- `cultural-archiver-photos`

**New:**
- `public-art-registry-photos`

### KV Namespaces

**Old Comments:**
- `cultural-archiver-rate_limits`
- `cultural-archiver-magic-links`

**New Comments:**
- `public-art-registry-rate_limits`
- `public-art-registry-magic-links`

*Note: KV namespace IDs remain the same; only the descriptive comments changed.*

---

## 🧪 Testing & Verification

### Before Cloudflare Configuration

```powershell
# Build and test locally
npm run build
npm run test
```

### After Cloudflare Configuration

```powershell
# Verify DNS
nslookup publicartregistry.com
nslookup api.publicartregistry.com
nslookup photos.publicartregistry.com
nslookup test.publicartregistry.com

# Test API endpoint
Invoke-WebRequest -Uri "https://api.publicartregistry.com/health"

# Deploy to staging
git checkout -b test-deployment
git push origin test-deployment
# GitHub Actions will auto-deploy to test.publicartregistry.com

# After merge to main
# GitHub Actions will auto-deploy to publicartregistry.com
```

### Smoke Tests

1. **Map View:** Visit `publicartregistry.com` and verify map loads
2. **Search:** Test artwork search functionality
3. **Submit:** Upload a test photo and create artwork
4. **Details:** View artwork details page
5. **Photos:** Verify photos load from `photos.publicartregistry.com`
6. **Email:** Test magic link login (if implemented)

---

## ⚠️ Important Notes

### Database Migration

The database name has changed from `cultural-archiver` to `public-art-registry` in the configuration files. You have two options:

**Option 1: Create New Database (Recommended for Pre-Release)**
- Create new D1 database named `public-art-registry`
- Run migrations: `npm run database:migration:prod`
- Start fresh (acceptable since project is in pre-release)

**Option 2: Rename/Reuse Existing Database**
- Keep the existing database ID in `wrangler.toml`
- Only the logical name changes, database ID stays the same
- No data loss
- Update the `database_name` field if Cloudflare allows renaming

### Email Provider

Don't forget to:
1. Update your email provider (Resend/SendGrid) with the new domain
2. Add DNS records for email verification
3. Test email sending after DNS propagation

### GitHub Actions

The new workflows require these repository secrets:
- `CLOUDFLARE_API_TOKEN` - API token with Workers and Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

Add these in GitHub: Settings → Secrets and variables → Actions

---

## 📊 Migration Impact

### Code Changes

- **Files Modified:** 15
- **Files Created:** 5
- **Configuration Updates:** All production and development configs
- **Branding Updates:** Partial (legal docs require manual update)

### Infrastructure Changes

- **New Domain:** publicartregistry.com
- **New Subdomains:** 3 (api, photos, test)
- **Worker Renames:** 1
- **Database Rename:** 1 (logical name only)
- **R2 Bucket Rename:** 1

---

## 🔜 Next Steps

1. **Complete Manual Updates**
   - Update legal documents (Terms of Service, Privacy Policy)
   - Use PowerShell commands in `domain-migration-manual-updates.md`

2. **Cloudflare Configuration**
   - Follow steps in `cloudflare-manual-setup.md`
   - Complete all checklist items

3. **GitHub Actions Setup**
   - Add repository secrets
   - Test staging deployment

4. **Testing**
   - Deploy to staging first
   - Run smoke tests
   - Verify all functionality

5. **Production Deployment**
   - Merge PR to main
   - Monitor deployment
   - Run verification checklist

6. **Post-Launch**
   - Monitor error rates
   - Update external documentation
   - Consider 301 redirects from old domain (optional)

---

## 🆘 Support

If you encounter issues:
1. Check `tasks/cloudflare-manual-setup.md` troubleshooting section
2. Review worker logs: `npx wrangler tail public-art-registry-api --env production`
3. Verify DNS propagation: https://www.whatsmydns.net/
4. Check SSL certificate status in Cloudflare dashboard

---

**Migration Status:** Code changes complete, Cloudflare configuration pending  
**Next Action:** Follow `tasks/cloudflare-manual-setup.md` to configure Cloudflare  
**Expected Timeline:** DNS propagation 5-30 minutes, full migration 1-2 hours
