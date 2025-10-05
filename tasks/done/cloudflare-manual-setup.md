# Cloudflare Manual Setup Instructions

This document provides step-by-step instructions for configuring Cloudflare to use the new `publicartregistry.com` domain with staging and production environments.

## Prerequisites

- Administrative access to the Cloudflare account
- Domain `publicartregistry.com` registered and ready to use
- Nameservers for `publicartregistry.com` pointed to Cloudflare

## Table of Contents

1. [Add Domain to Cloudflare](#1-add-domain-to-cloudflare)
2. [DNS Configuration](#2-dns-configuration)
3. [SSL/TLS Settings](#3-ssltls-settings)
4. [Workers Configuration](#4-workers-configuration)
5. [R2 Bucket Setup](#5-r2-bucket-setup)
6. [KV Namespace Setup](#6-kv-namespace-setup)
7. [D1 Database Setup](#7-d1-database-setup)
8. [Email Configuration](#8-email-configuration)
9. [Environment Variables & Secrets](#9-environment-variables--secrets)
10. [Staging Environment Setup](#10-staging-environment-setup)
11. [Verification Checklist](#11-verification-checklist)

---

## 1. Add Domain to Cloudflare

1. Log in to your Cloudflare dashboard
2. Click "Add a Site" in the top navigation
3. Enter `publicartregistry.com`
4. Select a plan (Free tier is sufficient for development)
5. Cloudflare will scan for existing DNS records
6. Review and confirm the DNS records
7. Cloudflare will provide nameserver addresses (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`)
8. Update your domain registrar's nameserver settings to point to Cloudflare's nameservers
9. Wait for DNS propagation (can take up to 24 hours, usually much faster)

---

## 2. DNS Configuration

### Production Domain Records

Navigate to **DNS > Records** and create the following:

**Root Domain (publicartregistry.com):**
- Type: `CNAME`
- Name: `@` (or `publicartregistry.com`)
- Target: `public-art-registry.pages.dev` (or your worker route)
- Proxy status: **Proxied** (orange cloud)
- TTL: Auto

**API Subdomain (api.publicartregistry.com):**
- Type: `CNAME`
- Name: `api`
- Target: `public-art-registry-api.workers.dev` (or your worker route)
- Proxy status: **Proxied** (orange cloud)
- TTL: Auto

**Photos Subdomain (photos.publicartregistry.com):**
- Type: `CNAME`
- Name: `photos`
- Target: Will be configured after R2 setup (see section 5)
- Proxy status: **Proxied** (orange cloud)
- TTL: Auto

**Staging Subdomain (test.publicartregistry.com):**
- Type: `CNAME`
- Name: `test`
- Target: `public-art-registry-staging.pages.dev` (or staging worker)
- Proxy status: **Proxied** (orange cloud)
- TTL: Auto

**WWW Redirect (Optional):**
- Type: `CNAME`
- Name: `www`
- Target: `publicartregistry.com`
- Proxy status: **Proxied** (orange cloud)
- TTL: Auto

---

## 3. SSL/TLS Settings

Navigate to **SSL/TLS** and configure:

1. **Overview Tab:**
   - Encryption mode: **Full (strict)** (recommended if you control origin)
   - Or **Full** if you don't have origin certificates

2. **Edge Certificates Tab:**
   - ✅ Enable "Always Use HTTPS"
   - ✅ Enable "Automatic HTTPS Rewrites"
   - ✅ Enable "Minimum TLS Version": 1.2 or higher
   - ✅ Enable "Opportunistic Encryption"
   - ✅ Enable "TLS 1.3"

3. **Universal SSL:**
   - Should be automatically provisioned for `publicartregistry.com` and `*.publicartregistry.com`
   - Wait for certificate to become active (usually 15-30 minutes)

---

## 4. Workers Configuration

### Create Production Worker

1. Navigate to **Workers & Pages**
2. Click "Create Application" → "Create Worker"
3. Name: `public-art-registry-api`
4. Deploy the worker code (use `wrangler publish --env production` from command line)

### Create Staging Worker

1. Navigate to **Workers & Pages**
2. Create another worker: `public-art-registry-api-staging`
3. This will handle `test.publicartregistry.com` traffic

### Configure Worker Routes

Navigate to **Workers & Pages** → Select your worker → **Settings** → **Triggers**

**Production Routes:**
- Add route: `publicartregistry.com/*` → Worker: `public-art-registry` (frontend)
- Add route: `api.publicartregistry.com/*` → Worker: `public-art-registry-api`

**Staging Routes:**
- Add route: `test.publicartregistry.com/*` → Worker: `public-art-registry-staging`

### Worker Environment Variables

For each worker, go to **Settings** → **Variables**:

**Production API Worker (`public-art-registry-api`):**
- `ENVIRONMENT`: `production`
- `FRONTEND_URL`: `https://publicartregistry.com`
- `LOG_LEVEL`: `warn`
- `API_VERSION`: `1.0.0`
- `EMAIL_FROM_ADDRESS`: `noreply@publicartregistry.com`
- `EMAIL_FROM_NAME`: `Public Art Registry`
- `EMAIL_REPLY_TO`: `support@publicartregistry.com`
- `EMAIL_ENABLED`: `true`
- `PHOTOS_BASE_URL`: `https://photos.publicartregistry.com`
- `CLOUDFLARE_IMAGES_ENABLED`: `false`
- `PHOTO_DEBUG`: `false`

**Staging API Worker:**
- Same as production but:
  - `ENVIRONMENT`: `staging`
  - `FRONTEND_URL`: `https://test.publicartregistry.com`
  - `LOG_LEVEL`: `debug`
  - `EMAIL_FROM_NAME`: `Public Art Registry (Staging)`

---

## 5. R2 Bucket Setup

### Create R2 Bucket

1. Navigate to **R2** in the Cloudflare dashboard
2. Click "Create bucket"
3. Bucket name: `public-art-registry-photos`
4. Location: Choose closest to your users (e.g., North America)
5. Click "Create bucket"

### Configure R2 Public Access

1. Select the bucket `public-art-registry-photos`
2. Go to **Settings** → **Public Access**
3. Enable "Allow Access" for read-only public access
4. Copy the public R2 URL (e.g., `https://pub-xxxxx.r2.dev`)

### Create Custom Domain for R2 (photos.publicartregistry.com)

1. In the R2 bucket settings, go to **Settings** → **Public R2.dev subdomain**
2. Click "Connect Domain"
3. Enter: `photos.publicartregistry.com`
4. Cloudflare will automatically create the necessary DNS record
5. Wait for DNS propagation and SSL certificate provisioning

### Bind R2 Bucket to Workers

This is done via `wrangler.toml` (already updated in code):

```toml
[[env.production.r2_buckets]]
binding = "PHOTOS_BUCKET"
bucket_name = "public-art-registry-photos"
```

Run `wrangler publish --env production` to apply the binding.

---

## 6. KV Namespace Setup

You'll need to create new KV namespaces or reuse existing ones.

### Create KV Namespaces (if not reusing existing)

Navigate to **Workers & Pages** → **KV**

1. **Sessions KV:**
   - Click "Create a namespace"
   - Name: `public-art-registry-sessions`
   - Copy the namespace ID

2. **Cache KV:**
   - Name: `public-art-registry-cache`
   - Copy the namespace ID

3. **Rate Limits KV:**
   - Name: `public-art-registry-rate-limits`
   - Copy the namespace ID

4. **Magic Links KV:**
   - Name: `public-art-registry-magic-links`
   - Copy the namespace ID

### Update wrangler.toml with KV IDs

Update `src/workers/wrangler.toml` with the new namespace IDs:

```toml
[[env.production.kv_namespaces]]
binding = "SESSIONS"
id = "your-new-sessions-id"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "your-new-cache-id"

[[env.production.kv_namespaces]]
binding = "RATE_LIMITS"
id = "your-new-rate-limits-id"

[[env.production.kv_namespaces]]
binding = "MAGIC_LINKS"
id = "your-new-magic-links-id"
```

**Note:** You can reuse the existing KV namespaces if you prefer to keep existing data.

---

## 7. D1 Database Setup

### Create D1 Database (if not reusing existing)

Navigate to **Workers & Pages** → **D1**

1. Click "Create database"
2. Database name: `public-art-registry`
3. Copy the database ID
4. Update `src/workers/wrangler.toml` with the new database ID

### Run Database Migrations

From your local development environment:

```powershell
# Apply migrations to production
npm run database:migration:prod
```

This will create all necessary tables in the new D1 database.

### Verify Database

```powershell
# Check migration status
npm run database:status:prod
```

**Note:** If you're migrating from the old database, you'll need to export the old database and import it into the new one. See `/docs/database-reset.md` for details.

---

## 8. Email Configuration

### Email Provider Setup (Resend or SendGrid)

1. **Domain Verification:**
   - Log in to your email provider (e.g., Resend at https://resend.com)
   - Add domain: `publicartregistry.com`
   - Provider will give you DNS records to add

2. **Add DNS Records for Email:**

Navigate to **DNS > Records** in Cloudflare and add:

**SPF Record (TXT):**
- Type: `TXT`
- Name: `@` or `publicartregistry.com`
- Value: `v=spf1 include:_spf.resend.com ~all` (or your provider's SPF record)
- TTL: Auto

**DKIM Record (CNAME or TXT):**
- Type: `CNAME` (or `TXT` depending on provider)
- Name: `resend._domainkey` (or as specified by provider)
- Value: (provided by email service provider)
- TTL: Auto

**DMARC Record (TXT):**
- Type: `TXT`
- Name: `_dmarc`
- Value: `v=DMARC1; p=none; rua=mailto:support@publicartregistry.com`
- TTL: Auto

3. **Verify Domain in Provider Dashboard:**
   - Wait for DNS propagation (5-30 minutes)
   - Click "Verify" in your email provider dashboard

4. **Update Worker Secrets:**

```powershell
# Set email API key as secret
npx wrangler secret put RESEND_API_KEY --env production --config src/workers/wrangler.toml
# Enter your API key when prompted
```

5. **Test Email Sending:**
   - Use the platform's email test feature or submit a test magic link request

---

## 9. Environment Variables & Secrets

### Set Production Secrets

Run these commands from your local terminal:

```powershell
cd src/workers

# Cloudflare Account ID
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
# Enter your Cloudflare account ID when prompted

# Resend API Key (for transactional emails)
npx wrangler secret put RESEND_API_KEY --env production
# Enter your Resend API key when prompted

# Cloudflare Images Hash (if using Cloudflare Images)
npx wrangler secret put CLOUDFLARE_IMAGES_HASH --env production
# Enter your Images hash when prompted (or skip if not using)
```

### Verify Secrets

```powershell
npx wrangler secret list --env production
```

---

## 10. Staging Environment Setup

### Configure Staging Worker

1. Create a staging environment in Cloudflare Workers
2. Deploy staging worker:

```powershell
npx wrangler publish --env staging --config src/workers/wrangler.toml
```

3. Add worker route for `test.publicartregistry.com/*` pointing to the staging worker

### Staging Environment Variables

Set the same environment variables as production but with staging-specific values:
- `ENVIRONMENT`: `staging`
- `FRONTEND_URL`: `https://test.publicartregistry.com`
- `LOG_LEVEL`: `debug`

### Auto-Deploy on Commit (GitHub Actions)

Create `.github/workflows/deploy-staging.yml`:

```yaml
name: Deploy Staging

on:
  push:
    branches-ignore:
      - main

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build
        run: npm run build
        
      - name: Deploy to staging
        run: |
          cd src/workers
          npx wrangler publish --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Auto-Deploy Production (GitHub Actions)

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy Production

on:
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
  deploy-production:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          
      - name: Install dependencies
        run: npm install
        
      - name: Run tests
        run: npm run test
        
      - name: Build
        run: npm run build
        
      - name: Deploy to production
        run: |
          cd src/workers
          npx wrangler publish --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## 11. Verification Checklist

### DNS Verification

```powershell
# Check DNS propagation
nslookup publicartregistry.com
nslookup api.publicartregistry.com
nslookup photos.publicartregistry.com
nslookup test.publicartregistry.com

# Or use online tool: https://www.whatsmydns.net/
```

### SSL Verification

- Visit `https://publicartregistry.com` - should show valid SSL certificate
- Visit `https://api.publicartregistry.com` - should show valid SSL certificate
- Visit `https://test.publicartregistry.com` - should show valid SSL certificate

### Workers Verification

```powershell
# Test API endpoint
curl https://api.publicartregistry.com/health

# Or in PowerShell:
Invoke-WebRequest -Uri "https://api.publicartregistry.com/health"
```

### Email Verification

1. Submit a test email through the platform (e.g., magic link)
2. Check spam folder if not received
3. Verify SPF/DKIM/DMARC headers in received email
4. Use email testing tool: https://www.mail-tester.com/

### R2 Photos Verification

1. Upload a test photo through the platform
2. Verify it's accessible at `https://photos.publicartregistry.com/...`
3. Check that thumbnails are generated correctly

### Staging Verification

1. Push a commit to a non-main branch
2. Verify that `test.publicartregistry.com` updates automatically
3. Test core functionality on staging

### Production Verification

1. Create a PR and merge to main
2. Verify that `publicartregistry.com` updates
3. Smoke test all core flows:
   - View artwork on map
   - Submit new artwork
   - Upload photo
   - View artwork details
   - Search/filter

---

## Troubleshooting

### Issue: SSL Certificate Pending

**Solution:** Wait up to 30 minutes for Cloudflare to provision Universal SSL. Check **SSL/TLS > Edge Certificates** for status.

### Issue: DNS Not Resolving

**Solution:** Verify nameservers are correctly set at registrar. DNS can take up to 24 hours to propagate globally.

### Issue: Worker Not Found (404)

**Solution:** 
1. Verify worker routes are configured correctly
2. Check that worker is deployed: `npx wrangler deployments list`
3. Ensure route pattern matches exactly (e.g., `/*` at end)

### Issue: Email Not Sending

**Solution:**
1. Verify DNS records for SPF/DKIM/DMARC
2. Check email provider dashboard for domain verification status
3. Verify `RESEND_API_KEY` secret is set correctly
4. Check worker logs: `npx wrangler tail public-art-registry-api --env production`

### Issue: Photos Not Loading

**Solution:**
1. Verify R2 bucket has public access enabled
2. Check custom domain is connected to R2 bucket
3. Verify `PHOTOS_BASE_URL` environment variable is correct
4. Test direct R2 URL first before custom domain

---

## Rollback Plan

If issues occur during deployment:

1. **DNS Rollback:**
   - Update DNS records to point back to old domain
   - TTL is set to Auto, so changes should propagate quickly

2. **Worker Rollback:**
   ```powershell
   npx wrangler rollback --env production
   ```

3. **Database Rollback:**
   - Restore from backup: `npm run database:import:prod backup.sql`

4. **Keep Old Domain Active:**
   - Keep `api.publicartregistry.com` workers active until migration is verified
   - Run both domains in parallel during transition period

---

## Post-Migration Tasks

- [ ] Update GitHub repository settings to use new domain
- [ ] Update any external documentation or links
- [ ] Notify users of domain change (if applicable)
- [ ] Monitor error rates and performance
- [ ] Set up monitoring/alerting for new domain
- [ ] Update Google Search Console with new domain
- [ ] Set up 301 redirects from old domain to new (optional)

---

**Created:** October 3, 2025  
**For Domain:** publicartregistry.com  
**Old Domain:** api.publicartregistry.com
