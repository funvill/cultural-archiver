# Domain Migration - Manual Updates Required

The following files contain references to the old domain and branding that need to be updated manually due to file locks or extensive changes required.

## Files Requiring Manual Updates

### Legal Documents (Terms of Service & Privacy Policy)

Update all occurrences in these files:
- `src/frontend/scripts/public/docs/terms-of-service.md`
- `src/frontend/scripts/public/docs/privacy-policy.md`
- `src/frontend/public/docs/terms-of-service.md`
- `src/frontend/public/docs/privacy-policy.md`

**Search and Replace:**
- `Cultural Archiver` → `Public Art Registry`
- `Cultural Archiver Society` → `Public Art Registry Society` (keep "Society" for legal entity)
- `art.abluestar.com` → `publicartregistry.com`
- `privacy@art.abluestar.com` → `privacy@publicartregistry.com`

**Note:** Keep references to "cultural archiving" as a generic term where it describes the activity, not the organization name.

### Task Files

**File:** `tasks/next.md`
- Line 65: Update the URL `https://art.abluestar.com/artwork/...` to `https://publicartregistry.com/artwork/...`

**File:** `tasks/done/_smallchanges.md`
- Update stack traces that reference `art.abluestar.com` (for documentation purposes)

**File:** `tasks/done/handoff-loved-chip-bug.md`
- Line 53: Already updated contact email

### Test Files

**File:** `src/frontend/test-results/map-preview-marker-click-M-7d068-preview-with-type-and-title/error-context.md`
- Update mailto links from `support@art.abluestar.com` to `support@publicartregistry.com`

### Documentation Files

Check and update any remaining references in `/docs/` directory:
- Search for `art.abluestar.com`
- Search for `Cultural Archiver`
- Replace with new domain and branding

## Completed Updates

✅ Root `wrangler.toml` - updated domain routes, database name, bucket name, email addresses
✅ `src/workers/wrangler.toml` - updated domain routes, database name, bucket name, email addresses
✅ `src/frontend/wrangler.jsonc` - updated worker name
✅ `package.json` - updated name, description, database migration commands
✅ `README.md` - updated title and project description
✅ `src/frontend/src/views/HelpView.vue` - updated support email
✅ `src/frontend/src/components/ErrorBoundary.vue` - updated support email
✅ `src/frontend/src/components/DevelopmentBanner.vue` - updated support email
✅ `tasks/next.md` - updated support email references (lines 5-6)

## PowerShell Command for Bulk Updates

If you want to batch update files after closing VS Code:

```powershell
# Update Terms of Service
Get-Content "src\frontend\scripts\public\docs\terms-of-service.md" | ForEach-Object { 
  $_ -replace 'Cultural Archiver', 'Public Art Registry' -replace 'art\.abluestar\.com', 'publicartregistry.com' -replace 'privacy@art\.abluestar\.com', 'privacy@publicartregistry.com' 
} | Set-Content "src\frontend\scripts\public\docs\terms-of-service-new.md"

# Update Privacy Policy
Get-Content "src\frontend\scripts\public\docs\privacy-policy.md" | ForEach-Object { 
  $_ -replace 'Cultural Archiver', 'Public Art Registry' -replace 'art\.abluestar\.com', 'publicartregistry.com' -replace 'privacy@art\.abluestar\.com', 'privacy@publicartregistry.com' 
} | Set-Content "src\frontend\scripts\public\docs\privacy-policy-new.md"

# Then manually review and rename
```

## Next Steps After Manual Updates

1. Run full test suite: `npm run test`
2. Build both frontend and workers: `npm run build`
3. Verify no broken references with grep: `git grep -i "art\.abluestar\.com"`
4. Verify no broken references with grep: `git grep -i "cultural.archiver"`
