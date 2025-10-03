# Domain Migration - Quick Start Checklist

This is a condensed checklist for migrating from `art.abluestar.com` to `publicartregistry.com`. For detailed instructions, see the referenced documents.

## ✅ Code Changes (COMPLETED)

- [x] Updated `wrangler.toml` configuration files
- [x] Updated `package.json` project name and scripts
- [x] Updated `README.md` branding
- [x] Updated Vue components email references
- [x] Created CI/CD workflows for staging and production
- [x] Updated copilot instructions

## 📝 Manual Code Updates (TODO)

See: `tasks/domain-migration-manual-updates.md`

- [ ] Update Terms of Service documents (4 files)
- [ ] Update Privacy Policy documents (2 files)
- [ ] Search and replace remaining references

## ☁️ Cloudflare Configuration (TODO)

See: `tasks/cloudflare-manual-setup.md` for detailed steps

### 1. Domain Setup (15 mins)

- [ ] Add `publicartregistry.com` to Cloudflare account
- [ ] Update nameservers at domain registrar
- [ ] Wait for DNS propagation

### 2. DNS Records (10 mins)

- [ ] Create CNAME: `@` → worker target (Proxied)
- [ ] Create CNAME: `api` → API worker target (Proxied)
- [ ] Create CNAME: `photos` → R2/Images target (Proxied)
- [ ] Create CNAME: `test` → staging worker target (Proxied)

### 3. SSL/TLS (5 mins)

- [ ] Set encryption mode to "Full (strict)"
- [ ] Enable "Always Use HTTPS"
- [ ] Enable "Automatic HTTPS Rewrites"
- [ ] Wait for Universal SSL certificate (15-30 mins)

### 4. Workers (20 mins)

- [ ] Deploy production worker: `npx wrangler deploy --env production --config src/workers/wrangler.toml`
- [ ] Deploy frontend worker: `npx wrangler deploy --env production --config src/frontend/wrangler.jsonc`
- [ ] Add worker routes in Cloudflare dashboard
  - `publicartregistry.com/*` → frontend worker
  - `api.publicartregistry.com/*` → API worker

### 5. R2 Bucket (15 mins)

- [ ] Create or rename R2 bucket to `public-art-registry-photos`
- [ ] Enable public access for bucket
- [ ] Connect custom domain `photos.publicartregistry.com` to R2 bucket
- [ ] Wait for R2 SSL certificate

### 6. D1 Database (10 mins)

- [ ] Create new D1 database named `public-art-registry`
  - OR keep existing database ID and just update the name reference
- [ ] Update `database_id` in `wrangler.toml` if creating new database
- [ ] Run migrations: `npm run database:migration:prod`
- [ ] Verify: `npm run database:status:prod`

### 7. KV Namespaces (5 mins)

**Option A: Reuse existing (Recommended)**
- [ ] Keep existing KV namespace IDs in `wrangler.toml`
- [ ] No action needed

**Option B: Create new**
- [ ] Create new KV namespaces for sessions, cache, rate limits, magic links
- [ ] Update KV namespace IDs in `src/workers/wrangler.toml`

### 8. Email Setup (20 mins)

- [ ] Add domain `publicartregistry.com` to Resend/SendGrid
- [ ] Add DNS records provided by email provider:
  - SPF (TXT record)
  - DKIM (CNAME or TXT)
  - DMARC (TXT record)
- [ ] Verify domain in email provider dashboard
- [ ] Set worker secret: `npx wrangler secret put RESEND_API_KEY --env production --config src/workers/wrangler.toml`

### 9. Environment Variables & Secrets (10 mins)

```powershell
cd src/workers

# Set secrets
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
npx wrangler secret put RESEND_API_KEY --env production
npx wrangler secret put CLOUDFLARE_IMAGES_HASH --env production

# Verify
npx wrangler secret list --env production
```

### 10. Staging Environment (15 mins)

- [ ] Deploy staging worker: `npx wrangler deploy --env staging --config src/workers/wrangler.toml`
- [ ] Add worker route: `test.publicartregistry.com/*` → staging worker
- [ ] Set staging environment variables

## 🔐 GitHub Actions Setup (5 mins)

In GitHub repository settings → Secrets and variables → Actions:

- [ ] Add secret: `CLOUDFLARE_API_TOKEN`
  - Create token at: https://dash.cloudflare.com/profile/api-tokens
  - Permissions: Workers Scripts:Edit, Pages:Edit, D1:Edit
- [ ] Add secret: `CLOUDFLARE_ACCOUNT_ID`
  - Find at: Cloudflare dashboard → Workers & Pages → Overview

## 🧪 Testing & Verification (30 mins)

### DNS Verification

```powershell
nslookup publicartregistry.com
nslookup api.publicartregistry.com
nslookup photos.publicartregistry.com
nslookup test.publicartregistry.com
```

### SSL Verification

- [ ] Visit `https://publicartregistry.com` - should show valid certificate
- [ ] Visit `https://api.publicartregistry.com` - should show valid certificate
- [ ] Visit `https://test.publicartregistry.com` - should show valid certificate

### Functionality Tests

- [ ] Map loads and displays artworks
- [ ] Search and filter works
- [ ] Submit new artwork with photo upload
- [ ] Photos load from `photos.publicartregistry.com`
- [ ] View artwork details page
- [ ] Test API endpoint: `Invoke-WebRequest -Uri "https://api.publicartregistry.com/health"`
- [ ] Test magic link email (if implemented)

### Staging Deployment Test

```powershell
# Create test branch
git checkout -b test-staging-deploy

# Make a small change (e.g., update a comment)
# Commit and push
git add .
git commit -m "Test staging deployment"
git push origin test-staging-deploy

# GitHub Actions should auto-deploy to test.publicartregistry.com
# Check deployment status in GitHub Actions tab
```

### Production Deployment Test

```powershell
# Create PR from test branch to main
# Merge PR in GitHub

# GitHub Actions should auto-deploy to publicartregistry.com
# Verify deployment status in PR comments
```

## 📊 Verification Checklist

After deployment:

- [ ] Homepage loads: `https://publicartregistry.com`
- [ ] API responds: `https://api.publicartregistry.com/health`
- [ ] Photos load: `https://photos.publicartregistry.com/...`
- [ ] Staging works: `https://test.publicartregistry.com`
- [ ] Email sends from `support@publicartregistry.com`
- [ ] SPF/DKIM/DMARC pass (check email headers)
- [ ] No console errors in browser
- [ ] Worker logs show no errors: `npx wrangler tail public-art-registry-api --env production`

## 🚨 Rollback Plan

If issues occur:

1. **DNS Rollback:**
   - Change DNS records back to old domain workers
   - TTL is Auto, changes propagate in 5-30 minutes

2. **Worker Rollback:**
   ```powershell
   npx wrangler rollback --env production --config src/workers/wrangler.toml
   ```

3. **Database Rollback:**
   - Import backup: `npm run database:import:prod backup.sql`

## 📚 Reference Documents

- **Detailed Plan:** `tasks/plan-domain-update.md`
- **Cloudflare Setup:** `tasks/cloudflare-manual-setup.md`
- **Manual Code Updates:** `tasks/domain-migration-manual-updates.md`
- **Migration Summary:** `tasks/domain-migration-summary.md`

## ⏱️ Estimated Time

- **Code Updates:** Already completed
- **Cloudflare Configuration:** 2-3 hours (including DNS propagation waits)
- **Testing:** 30 minutes
- **Total:** 3-4 hours

## 🎯 Success Criteria

- [x] All code changes committed
- [ ] Cloudflare fully configured
- [ ] DNS resolves correctly
- [ ] SSL certificates active
- [ ] Workers deployed and responding
- [ ] R2 photos accessible
- [ ] Email sending works
- [ ] Staging auto-deploys on commits
- [ ] Production deploys on PR merge
- [ ] All smoke tests pass

---

**Status:** Code changes complete ✅  
**Next Step:** Start Cloudflare configuration (Section: Domain Setup)  
**Start Here:** `tasks/cloudflare-manual-setup.md`
