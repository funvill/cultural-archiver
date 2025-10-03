---
name: Domain Migration to publicartregistry.com
about: Track the migration from art.abluestar.com to publicartregistry.com
title: 'Domain Migration: art.abluestar.com → publicartregistry.com'
labels: infrastructure, deployment, migration
assignees: ''
---

# Domain Migration Tracking Issue

**Old Domain:** art.abluestar.com  
**New Domain:** publicartregistry.com  
**Old Branding:** Cultural Archiver  
**New Branding:** Public Art Registry  
**Migration Date:** October 3, 2025

## 📋 Quick Links

- [ ] Review migration plan: `tasks/plan-domain-update.md`
- [ ] Follow Cloudflare setup: `tasks/cloudflare-manual-setup.md`
- [ ] Check quick checklist: `tasks/MIGRATION-CHECKLIST.md`
- [ ] Review summary: `tasks/domain-migration-summary.md`

## ✅ Phase 1: Code Updates (COMPLETED)

- [x] Update `wrangler.toml` configuration
- [x] Update `src/workers/wrangler.toml` configuration
- [x] Update `src/frontend/wrangler.jsonc`
- [x] Update `package.json` project name and scripts
- [x] Update `README.md` branding
- [x] Update Vue component email references
- [x] Create GitHub Actions workflows
- [x] Update copilot instructions
- [x] Create migration documentation

## 📝 Phase 2: Manual Code Updates

- [ ] Update Terms of Service documents (4 files)
- [ ] Update Privacy Policy documents (2 files)
- [ ] Verify no remaining old domain references: `git grep -i "art\.abluestar\.com"`
- [ ] Verify no remaining old branding: `git grep -i "cultural.archiver"`

## ☁️ Phase 3: Cloudflare Infrastructure

### Domain & DNS
- [ ] Add `publicartregistry.com` to Cloudflare
- [ ] Update nameservers at registrar
- [ ] Create DNS CNAME records (root, api, photos, test)
- [ ] Verify DNS propagation

### SSL/TLS
- [ ] Configure SSL/TLS settings (Full strict mode)
- [ ] Enable Always Use HTTPS
- [ ] Wait for Universal SSL certificate

### Workers
- [ ] Deploy production API worker
- [ ] Deploy production frontend worker
- [ ] Configure worker routes
- [ ] Set production environment variables

### Storage
- [ ] Create/rename R2 bucket: `public-art-registry-photos`
- [ ] Configure R2 public access
- [ ] Connect custom domain to R2: `photos.publicartregistry.com`

### Database
- [ ] Create/rename D1 database: `public-art-registry`
- [ ] Run production migrations
- [ ] Verify database schema

### KV Namespaces
- [ ] Verify/create KV namespaces
- [ ] Update KV namespace bindings

### Email
- [ ] Add domain to email provider (Resend/SendGrid)
- [ ] Add DNS records (SPF, DKIM, DMARC)
- [ ] Verify domain in email provider
- [ ] Set RESEND_API_KEY worker secret

### Secrets
- [ ] Set CLOUDFLARE_ACCOUNT_ID
- [ ] Set RESEND_API_KEY
- [ ] Set CLOUDFLARE_IMAGES_HASH (if using)

## 🔧 Phase 4: Staging Environment

- [ ] Deploy staging worker
- [ ] Configure staging routes
- [ ] Set staging environment variables
- [ ] Add GitHub Actions secrets
- [ ] Test auto-deploy on commit

## 🧪 Phase 5: Testing

### DNS & SSL
- [ ] DNS resolves: `publicartregistry.com`
- [ ] DNS resolves: `api.publicartregistry.com`
- [ ] DNS resolves: `photos.publicartregistry.com`
- [ ] DNS resolves: `test.publicartregistry.com`
- [ ] SSL certificate valid for all domains

### Functionality
- [ ] Homepage loads correctly
- [ ] Map displays artworks
- [ ] Search and filter work
- [ ] Photo upload works
- [ ] Photos load from `photos.publicartregistry.com`
- [ ] API health check responds
- [ ] Email sending works
- [ ] SPF/DKIM/DMARC pass

### Deployments
- [ ] Staging deploys on push to feature branch
- [ ] Production deploys on PR merge to main
- [ ] GitHub Actions workflows complete successfully

## 🚀 Phase 6: Production Launch

- [ ] Final smoke tests on production
- [ ] Monitor worker logs for errors
- [ ] Verify no broken functionality
- [ ] Update external documentation
- [ ] Announce domain change (if applicable)

## 📊 Verification Checklist

- [ ] `npm run build` completes successfully
- [ ] `npm run test` passes all tests
- [ ] No console errors on production site
- [ ] Worker logs show no errors
- [ ] Email deliverability verified
- [ ] Photo uploads and retrieval work
- [ ] Database queries work correctly
- [ ] All API endpoints respond correctly

## 🔄 Rollback Plan

If issues occur:
1. Update DNS to point back to old workers
2. Run worker rollback: `npx wrangler rollback --env production`
3. Restore database from backup if needed
4. Monitor for 24 hours before final cutover

## 📝 Notes

<!-- Add any notes, issues encountered, or decisions made during migration -->

## ✅ Completion Criteria

- [ ] All code updated and committed
- [ ] Cloudflare fully configured
- [ ] All tests pass
- [ ] Production site fully functional
- [ ] Staging auto-deploy working
- [ ] Production auto-deploy working
- [ ] No errors in worker logs
- [ ] Email sending verified
- [ ] DNS propagated globally
- [ ] Old domain can be safely deprecated

---

**Migration Status:** In Progress  
**Current Phase:** Phase 1 Complete, Phase 2 Pending  
**Blockers:** None  
**ETA:** 3-4 hours for Cloudflare configuration + testing
