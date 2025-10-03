# Domain Migration - Remaining Tasks

**Status**: Production deployed and working ✅  
**Date**: October 3, 2025  
**Migration**: `art.abluestar.com` → `publicartregistry.com`

## ✅ Completed Tasks

### Infrastructure (Production Live)
- ✅ Cloudflare domain added and nameservers updated
- ✅ DNS records configured (root, api, photos, test)
- ✅ SSL/TLS configured (Full/Strict mode)
- ✅ Frontend worker deployed to `publicartregistry.com`
- ✅ API worker deployed to `api.publicartregistry.com`
- ✅ R2 bucket created and custom domain configured (`photos.publicartregistry.com`)
- ✅ CORS configuration updated and working
- ✅ Staging environment configured (`test.publicartregistry.com`)

### Code Updates
- ✅ All wrangler.toml files updated
- ✅ Frontend API configuration updated
- ✅ Router page titles updated (20+ routes)
- ✅ Main HTML title and meta tags updated
- ✅ Contact emails updated in UI components
- ✅ Package.json updated with new name and database commands

### CI/CD
- ✅ GitHub Actions workflow created for staging (auto-deploy on commits)
- ✅ GitHub Actions workflow created for production (PR merge to main)
- ✅ Deployment scripts created (`deploy-production.ps1`, `deploy-staging.ps1`)

## 🟡 Optional/Nice-to-Have Tasks

### 1. Email Configuration (Deferred by User)
**Status**: Postponed - "Email can be done later"  
**Impact**: Medium - Magic links and transactional emails won't work until configured

**Steps Required:**
1. Add domain to Resend/SendGrid
2. Add DNS records:
   - SPF (TXT): `v=spf1 include:_spf.resend.com ~all`
   - DKIM (CNAME): Provided by Resend
   - DMARC (TXT): `v=DMARC1; p=quarantine;`
3. Verify domain in Resend dashboard
4. Test magic link emails

**Reference**: `tasks/cloudflare-manual-setup.md` section 8

### 2. GitHub Actions Secrets
**Status**: Not yet configured  
**Impact**: Low - CI/CD won't run until configured, but manual deployment works

**Steps Required:**
1. Go to: https://github.com/funvill/cultural-archiver/settings/secrets/actions
2. Add `CLOUDFLARE_API_TOKEN` (your current token)
3. Add `CLOUDFLARE_ACCOUNT_ID` = `6e404ff59acc48cff831e9b67555ded3`
4. Test by pushing to a feature branch (should auto-deploy to staging)

### 3. Update Remaining "Cultural Archiver" References
**Status**: Low priority - mostly in comments and documentation  
**Impact**: Very Low - Cosmetic only, doesn't affect functionality

**Files with old branding:**
- **Code Comments**: Test files, route handlers have "Cultural Archiver" in comments
- **Consent Strings**: Backend stores consent as "Cultural Archiver Consent v1.0"
- **Email Templates**: `src/workers/lib/resend-email.ts` footer
- **Test Files**: Many test descriptions use "Cultural Archiver"
- **Documentation**: Several docs still reference old domain in examples

**Examples:**
```typescript
// Test files
describe('Cultural Archiver API Integration Tests', (): void => {

// Consent strings  
`Cultural Archiver Consent v${consentVersion} - Artwork Submission`

// Email template
Cultural Archiver © ${new Date().getFullYear()} |
<a href="https://art.abluestar.com">Visit Website</a>
```

**Decision**: Keep as-is unless you want complete rebrand. These don't affect user experience.

### 4. Update Email Templates
**Status**: Contains old domain  
**Impact**: Low - Only visible if emails are sent

**Files to update:**
- `src/workers/lib/resend-email.ts` (line 138, 301)
  - Footer link: `https://art.abluestar.com` → `https://publicartregistry.com`
  - Domain display: `art.abluestar.com` → `publicartregistry.com`

### 5. Update Test File URLs
**Status**: Old domain in test files  
**Impact**: None - Tests still pass, URLs are just examples

**Files:**
- `src/workers/test/mass-import-solo-fix.test.ts` (3 occurrences)
- `src/workers/lib/mass-import-duplicate-detection.ts` (default parameter)

### 6. Update Documentation
**Status**: Some docs have old domain in examples  
**Impact**: Very Low - For reference only

**Files:**
- `docs/authentication.md` (example URLs)
- `tasks/next.md` (old artwork URL in issue description)
- Various task files (migration documentation itself)

### 7. Clean Up Build Artifacts
**Status**: Old CORS origins in compiled .wrangler files  
**Impact**: None - These are regenerated on each build

**Action**: Can safely ignore - these are temporary build files

### 8. Old Domain Data Migration (Optional)
**Status**: Not required - fresh start approach  
**Impact**: None - You confirmed data loss acceptable during pre-release

**If needed later:**
- Export data from old domain database
- Import to new domain database
- Update photo references

## 📋 Recommended Action Items (Priority Order)

### High Priority
None! The site is fully operational. 🎉

### Medium Priority (When Convenient)
1. **Set up GitHub Actions secrets** - Enables automated deployments
2. **Configure email DNS** - Required for magic link authentication

### Low Priority (Polish)
3. Update email template URLs in `resend-email.ts`
4. Update consent strings to say "Public Art Registry" instead of "Cultural Archiver"
5. Update test file comments and descriptions
6. Update documentation examples

## 🎯 Current Production Status

| Service | URL | Status |
|---------|-----|--------|
| Frontend | https://publicartregistry.com | ✅ Live |
| API | https://api.publicartregistry.com | ✅ Live |
| Photos | https://photos.publicartregistry.com | ✅ Configured |
| Staging | https://test.publicartregistry.com | ✅ Ready |

**All critical migration tasks are complete!** The remaining items are optional improvements.

## 🔍 Quick Verification Commands

```powershell
# Test frontend
Invoke-WebRequest https://publicartregistry.com/status

# Test API
Invoke-WebRequest https://api.publicartregistry.com/health

# Test artwork discovery
Invoke-WebRequest "https://api.publicartregistry.com/api/discovery/nearby?lat=49.2827&lon=-123.1207&radius=500"

# Check R2 domain
npx wrangler r2 bucket domain list public-art-registry-photos
```

## 📚 Reference Documents

- Full migration plan: `tasks/plan-domain-update.md`
- Cloudflare setup: `tasks/cloudflare-manual-setup.md`
- Migration checklist: `tasks/MIGRATION-CHECKLIST.md`
- Manual updates guide: `tasks/domain-migration-manual-updates.md`
- Wrangler automation: `tasks/wrangler-automation-guide.md`
