# Plan: Migrate project to publicartregistry.com

This document describes the steps to update the project from the old domain
(`api.publicartregistry.com`) and branding (`Cultural Archiver` / `cultural-archiver`) to
the new domain and branding `Public Art Registry` / `publicartregistry.com`.

Primary domains

- Public site: publicartregistry.com
- API: api.publicartregistry.com
- Photos: photos.publicartregistry.com
- Support email: support@publicartregistry.com
- Staging (auto-deploy on commits): test.publicartregistry.com

Goals

- Update code, configs and docs to use new domain and branding.
- Provide manual Cloudflare dashboard steps for DNS, SSL, Workers, R2 and email setup.
- Configure CI/CD so `test.publicartregistry.com` updates on each commit and
  `publicartregistry.com` updates only when PRs are merged to `main`.
- Verify photos and API routes still work and transactional email is configured.

High-level plan (ordered)

1. Audit repository for references to the old domain and branding.
2. Update configuration files and environment references.
3. Update branding strings and documentation.
4. Prepare Cloudflare manual instructions and checklist.
5. Implement CI/CD changes for staging/production deploys.
6. Deploy staging and run smoke tests.
7. Deploy production (after PR/approval) and run verification.

Detailed steps

1) Audit (search & list)

- Search for these strings: `api.publicartregistry.com`, `abluestar.com`, `cultural-archiver`, `Cultural Archiver`, `api.publicartregistry.com`, `support@api.publicartregistry.com`.
- Record file paths and create a branch `domain-update/publicartregistry` for changes.

2) Update config files (code edits)

- `wrangler.toml` (root): update routes, account id, and zone to `publicartregistry.com` where applicable.
- `src/frontend/wrangler.jsonc` or similar frontend worker config: set `assets.directory`, `routes` and `env` domains to new values.
- Any environment files (.env, .env.production, secrets/CI variables): update API base URLs to `https://api.publicartregistry.com` and photo base to `https://photos.publicartregistry.com`.
- Update `package.json` deploy scripts if they reference old domains.

3) Update branding and docs

- Replace title/meta/site name: change `Cultural Archiver` to `Public Art Registry` in `README.md`, docs/, templates and HTML meta tags.
- Replace `cultural-archiver` slug and similar identifiers in docs and tasks where safe. Avoid renaming code packages or npm package names unless intended.
- Update Open Graph tags and email templates to reference new email and domains.

4) Cloudflare manual steps (Checklist)

Prereq: You have administrative access to the Cloudflare account currently managing `api.publicartregistry.com` and can add domains and edit DNS, Workers, R2, and Pages settings.

- Add domain to Cloudflare (if not already): publicartregistry.com
  - Follow Cloudflare steps to add the domain and update registrar nameservers.

- DNS records
  - Create A/ALIAS/CNAME records required by your hosting setup. For Workers + static assets using the Worker to serve the site, add CNAME records like:
    - `publicartregistry.com` -> (Cloudflare will handle root via root CNAME flattening when needed)
    - `www` CNAME to `publicartregistry.com` (or to the worker/Pages target)
    - `api` CNAME to the worker route target for the API (or set worker route bindings)
    - `photos` CNAME to the R2/Images endpoint or CDN hostname as applicable

- SSL/TLS
  - Ensure SSL mode is set to `Full (strict)` if you control origin certs, otherwise `Full` until origin certs are configured.
  - Enable Automatic HTTPS Rewrites and Always Use HTTPS.

- Workers & Routes
  - Add routes for the Worker(s):
    - `publicartregistry.com/*` -> frontend worker
    - `api.publicartregistry.com/*` -> API worker
    - `test.publicartregistry.com/*` -> staging worker (bind to staging environment)
  - Configure Worker environments: `production` for `publicartregistry.com`, `staging` for `test.publicartregistry.com`.

- R2 / Photos
  - Create R2 bucket (if not already) and ensure the bucket policy and CORS allow image access by the site domain.
  - If using Cloudflare Images or direct R2 public URLs, configure `photos.publicartregistry.com` as a CNAME or a custom subdomain mapped to Images/R2 origin.

- Pages (if used) / Static assets
  - If you use Pages for static assets, configure `publicartregistry.com` and `test.publicartregistry.com` as custom domains in Pages and connect deploy rules accordingly.

- Email (support@publicartregistry.com)
  - Create DNS records for email provider (MX, SPF/TXT, DKIM CNAME/TXT, DMARC).
  - If using a transactional provider (Resend, SendGrid, etc.), update their domain settings and provide the DNS records Cloudflare will host.

5) CI/CD for staging + production

- Staging: `test.publicartregistry.com`
  - Create a Cloudflare Worker environment or Pages custom domain bound to `test.publicartregistry.com`.
  - Update your CI pipeline to run on push to any branch (or on a push) and deploy to the `staging` environment using Wrangler or your deployment method. Use CI secrets for account ID, zone ID and API tokens.
  - Set the deploy trigger to run on each commit (or merge to non-main branches) so site updates frequently.

- Production: `publicartregistry.com`
  - Configure CI to only deploy to the `production` Worker/Pages environment when a PR is merged to `main` (or when a tag is created). Prefer GitHub Actions with a branch-protection enforced workflow.
  - Use `wrangler publish --env production` (or similar) with `CI=true` in the environment to avoid interactive prompts.

6) Photos & caching

- Ensure image URLs and CDN caching are updated to use `photos.publicartregistry.com`.
- Update any image processing pipeline to publish thumbnails and originals to R2 and set correct cache headers and CDN TTL.

7) Email and transactional

- Update transactional email service config to use `support@publicartregistry.com` and verify domain ownership with the provider.
- Add SPF (TXT), DKIM and DMARC records to Cloudflare DNS per provider instructions.

8) Testing and verification

- Staging verification checklist
  - Visit `https://test.publicartregistry.com` and exercise the main flows (submit, view artwork, map, photos, login if any).
  - Verify API calls go to `api.publicartregistry.com` (or the staging API route) and that responses are correct.
  - Verify photos load from `photos.publicartregistry.com` and that thumbnails are served correctly.
  - Check page meta tags and Open Graph images reference the new domain.

- Production verification checklist (post-deploy)
  - DNS propagation verified with `dig`/online checks.
  - Smoke test core flows as above on `https://publicartregistry.com`.
  - Verify email deliverability from `support@publicartregistry.com` using test messages and check SPF/DKIM/DMARC pass.

9) Rollback plan

- Keep the previous Cloudflare configuration and domain active until verification is complete.
- If a deployment causes site failure, roll back by redeploying the last known-good release or switching the Cloudflare route to the prior worker or Pages deployment.

Search-and-replace guidance and safety

- Use a code-aware search to find instances; prefer `git grep` or your editor's project search.
- Avoid blind renaming in code that may be used as package names, npm package identifiers, or third-party integration ids unless intentional.
- Example safe replacements:
  - `api.publicartregistry.com` -> `publicartregistry.com`
  - `api.publicartregistry.com` -> `api.publicartregistry.com`
  - `support@api.publicartregistry.com` -> `support@publicartregistry.com`
  - `Cultural Archiver` -> `Public Art Registry` (in docs, templates, UI copy)
  - `cultural-archiver` -> `public-art-registry` (where used as slugs)

Files to check (examples)

- `README.md`, `docs/*`, `tasks/*` (update docs and tasks)
- `wrangler.toml`, `src/frontend/wrangler.jsonc`, `package.json` scripts
- `src/frontend/*` templates, meta tags, and API base URL files
- `src/workers/*` API routes and configs

Follow-ups and small extras (proactive)

- Add a short `docs/domain-change-checklist.md` with the Cloudflare DNS records template to copy/paste.
- Add a GitHub Actions workflow snippet example in `tasks/` for staging and production deploys.
- Add unit or smoke tests that assert environment variables point to the expected API/asset domains in CI for both staging and production.

Acceptance criteria

- All references in docs and UI now say `Public Art Registry` where appropriate.
- test.publicartregistry.com updates on each commit and publicartregistry.com updates only when PRs merge to `main`.
- DNS, SSL, Workers and R2 are configured in Cloudflare and email is verified.

If you want, I can now:

- Run a repo-wide search to list files referencing the old domain and branding.
- Create the branch `domain-update/publicartregistry` and open a PR with basic config changes (wrangler and env updates).

Notes / assumptions

- I assume Cloudflare is the current DNS/hosting provider because the project uses Cloudflare Workers, R2 and Pages. If some services are elsewhere, update the plan accordingly.
- I won't rename npm package names or change package ownership.

---

Created by automated plan generator on behalf of the project owner.
