# Domain Migration - Wrangler Automation Guide

This guide separates tasks into **Wrangler-automated** vs. **manual dashboard** steps.

## 🎯 **Quick Summary**

**Manual Dashboard Steps:** ~30 minutes (mostly DNS)
**Wrangler Automated Steps:** ~15 minutes (run commands)

---

## ❌ **Manual Steps (Cloudflare Dashboard Only)**

### Step 1: Add Domain (5 mins)

1. Log in to Cloudflare dashboard
2. Click "Add a Site"
3. Enter `publicartregistry.com`
4. Select a plan
5. Copy the nameserver addresses
6. Update your domain registrar's nameservers
7. Wait for DNS propagation

### Step 2: Create DNS Records (10 mins)

Navigate to **DNS > Records** and create:

| Type  | Name     | Target/Content                          | Proxy Status |
|-------|----------|-----------------------------------------|--------------|
| CNAME | @        | public-art-registry.workers.dev         | Proxied      |
| CNAME | api      | public-art-registry-api.workers.dev     | Proxied      |
| CNAME | test     | public-art-registry-staging.workers.dev | Proxied      |

**Note:** `photos` subdomain will be added automatically by Wrangler when you connect R2 custom domain.

### Step 3: SSL/TLS Settings (3 mins)

Navigate to **SSL/TLS**:

- Encryption mode: **Full (strict)**
- ✅ Enable "Always Use HTTPS"
- ✅ Enable "Automatic HTTPS Rewrites"
- ✅ Enable "TLS 1.3"

### Step 4: Email DNS Records (10 mins)

Add these records (get values from your email provider):

**SPF Record:**
- Type: `TXT`
- Name: `@`
- Value: `v=spf1 include:_spf.resend.com ~all` (or your provider's value)

**DKIM Record:**
- Type: `CNAME` or `TXT`
- Name: `resend._domainkey` (or as specified by provider)
- Value: (provided by email service)

**DMARC Record:**
- Type: `TXT`
- Name: `_dmarc`
- Value: `v=DMARC1; p=none; rua=mailto:support@publicartregistry.com`

**Total Manual Time:** ~30 minutes (including DNS propagation waits)

---

## ✅ **Automated Steps (Wrangler Commands)**

Once the manual steps above are complete, run these commands:

### Step 1: Create Infrastructure (5 mins)

```powershell
# Get your zone ID first (needed for some commands)
npx wrangler whoami

# Create R2 bucket
npx wrangler r2 bucket create public-art-registry-photos

# Create D1 database (if you're not reusing existing)
npx wrangler d1 create public-art-registry

# The command will return a database_id - update it in wrangler.toml if new

# Create KV namespaces for production
npx wrangler kv:namespace create "SESSIONS" --env production
npx wrangler kv:namespace create "CACHE" --env production
npx wrangler kv:namespace create "RATE_LIMITS" --env production
npx wrangler kv:namespace create "MAGIC_LINKS" --env production

# Copy the returned IDs and update src/workers/wrangler.toml if creating new ones
```

### Step 2: Update Configuration (2 mins)

If you created new KV namespaces or D1 database, update `src/workers/wrangler.toml` with the new IDs.

Or, if you're reusing existing infrastructure, you can skip this - the IDs are already in your config.

### Step 3: Run Database Migrations (2 mins)

```powershell
# Apply migrations to production database
npm run database:migration:prod

# Verify migrations applied
npm run database:status:prod
```

### Step 4: Set Secrets (3 mins)

```powershell
cd src/workers

# Set production secrets
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
# Enter your Cloudflare account ID when prompted

npx wrangler secret put RESEND_API_KEY --env production
# Enter your Resend API key when prompted

# Optional: If using Cloudflare Images
npx wrangler secret put CLOUDFLARE_IMAGES_HASH --env production

# Verify secrets
npx wrangler secret list --env production
```

### Step 5: Deploy Workers (3 mins)

```powershell
# Deploy API worker
cd src/workers
npx wrangler deploy --env production

# Deploy frontend worker
cd ../frontend
npx wrangler deploy --env production

# Return to root
cd ../..
```

### Step 6: Configure R2 Custom Domain (2 mins)

```powershell
# Add custom domain to R2 bucket (this creates DNS record automatically)
npx wrangler r2 bucket domain add public-art-registry-photos --domain photos.publicartregistry.com

# Verify
npx wrangler r2 bucket domain list public-art-registry-photos
```

### Step 7: Deploy Staging (2 mins)

```powershell
# Deploy staging workers
cd src/workers
npx wrangler deploy --env staging

cd ../frontend
npx wrangler deploy --env staging

cd ../..
```

**Total Automated Time:** ~20 minutes

---

## 🧪 **Verification via Wrangler**

```powershell
# Check worker deployments
npx wrangler deployments list --config src/workers/wrangler.toml

# Check D1 database
npx wrangler d1 info public-art-registry --env production

# Check R2 bucket
npx wrangler r2 bucket list

# Check secrets
npx wrangler secret list --env production --config src/workers/wrangler.toml

# Tail logs in real-time
npx wrangler tail public-art-registry-api --env production --format pretty
```

---

## 🔄 **Using Wrangler for Staging**

For your staging environment that auto-deploys:

### Add Staging Environment to wrangler.toml

You'll need to add a `[env.staging]` section to `src/workers/wrangler.toml`:

```toml
# Add after production config
[[env.staging.routes]]
pattern = "test.publicartregistry.com/*"
zone_name = "publicartregistry.com"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "public-art-registry"
database_id = "b64d04af-79d9-4573-8adb-97f0e3946962"

# Staging KV namespaces (can reuse production or create new ones)
[[env.staging.kv_namespaces]]
binding = "SESSIONS"
id = "c991e608759d45bdae4198b72955da5f"

[[env.staging.kv_namespaces]]
binding = "CACHE"
id = "91052eaeeef24b6fab6ac2b3c75b8b0b"

[[env.staging.kv_namespaces]]
binding = "RATE_LIMITS"
id = "81aa51ca054d46b18977670c3dff6c04"

[[env.staging.kv_namespaces]]
binding = "MAGIC_LINKS"
id = "5b69d7c338734f3aa56cea9c1f3930f7"

[[env.staging.r2_buckets]]
binding = "PHOTOS_BUCKET"
bucket_name = "public-art-registry-photos"

[env.staging.vars]
ENVIRONMENT = "staging"
FRONTEND_URL = "https://test.publicartregistry.com"
LOG_LEVEL = "debug"
API_VERSION = "1.0.0"
EMAIL_FROM_ADDRESS = "noreply@publicartregistry.com"
EMAIL_FROM_NAME = "Public Art Registry (Staging)"
EMAIL_REPLY_TO = "support@publicartregistry.com"
EMAIL_ENABLED = "true"
PHOTOS_BASE_URL = "https://photos.publicartregistry.com"
CLOUDFLARE_IMAGES_ENABLED = "false"
PHOTO_DEBUG = "true"
```

Then deploy with:
```powershell
npx wrangler deploy --env staging --config src/workers/wrangler.toml
```

---

## 🚀 **One-Command Full Deployment**

Create a PowerShell script `deploy-production.ps1`:

```powershell
#!/usr/bin/env pwsh

Write-Host "🚀 Deploying Public Art Registry to Production" -ForegroundColor Green

# Build
Write-Host "📦 Building..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Cyan
npm run test

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests failed" -ForegroundColor Red
    exit 1
}

# Deploy workers
Write-Host "☁️ Deploying API worker..." -ForegroundColor Cyan
Push-Location src/workers
npx wrangler deploy --env production
Pop-Location

# Deploy frontend
Write-Host "🎨 Deploying frontend..." -ForegroundColor Cyan
Push-Location src/frontend
npx wrangler deploy --env production
Pop-Location

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Visit: https://publicartregistry.com" -ForegroundColor Cyan
```

Then just run:
```powershell
.\deploy-production.ps1
```

---

## 📊 **Summary: Manual vs. Automated**

### Manual Dashboard (One-Time Setup):
- ❌ Add domain to Cloudflare
- ❌ Update registrar nameservers
- ❌ Create DNS records (CNAME for root, api, test)
- ❌ Configure SSL/TLS settings
- ❌ Add email DNS records (SPF/DKIM/DMARC)

**Time:** ~30 minutes (including waits)

### Wrangler Automated (Repeatable):
- ✅ Create R2 buckets
- ✅ Create D1 databases
- ✅ Create KV namespaces
- ✅ Run database migrations
- ✅ Set worker secrets
- ✅ Deploy workers
- ✅ Configure worker routes
- ✅ Add R2 custom domains
- ✅ Manage all environment variables

**Time:** ~20 minutes (first time), ~5 minutes (subsequent deploys)

---

## 💡 **Pro Tips**

1. **Use `wrangler.toml` for everything possible** - It's version controlled and repeatable
2. **Secrets in CI/CD** - Use GitHub Actions secrets, not local machine
3. **Staging = Production config** - Keep staging and production configs identical except for URLs
4. **Tail logs during deployment** - Run `npx wrangler tail` in another terminal to watch for errors
5. **Use `--dry-run`** - Test deployments with `npx wrangler deploy --dry-run` first

---

**Bottom Line:** You can automate ~80% of the migration with Wrangler. Only DNS and SSL setup require the dashboard.
