# Phase 0 – Project Setup Tasks (Cultural Archiver)

## 1. Repository & Governance
- **Create GitHub repository**
  - Init with MIT/Apache-2.0 license (code) + CC0 license (data).
  - Add default `.gitignore` for Vue + Cloudflare Workers.
  - **AC:** Repo builds clean, licenses visible in root.

- **Add governance docs**
  - Add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`.
  - Include instructions on submitting issues/PRs.
  - **AC:** Docs linked in repo sidebar.

- **Add PR & issue templates**
  - Create GitHub issue templates for: Feature, Bug, Task.
  - Create PR template with checklist.
  - **AC:** New issue/PR flows include templates.

---

## 2. CI/CD Pipeline
- **Configure GitHub Actions**
  - Add job to lint (`eslint`), type-check (TypeScript), and build Vue app.
  - **AC:** All PRs run checks automatically.

- **Set up Pages deploy**
  - Connect GitHub repo to Cloudflare Pages.
  - Configure branch → environment mapping (`main` → prod, `dev` → preview).
  - **AC:** On merge to main, site redeploys automatically within 5 minutes.

- **Set up Workers deploy**
  - Configure `wrangler` in repo.
  - On merge to `main`, auto-deploy Workers API.
  - **AC:** Test Worker route responds in production after merge.

---

## 3. Cloudflare Infrastructure
- **Initialize Cloudflare Workers monorepo**
  - Scaffold Workers API (placeholder endpoints).
  - Configure with `miniflare` for local dev.
  - **AC:** `npm run dev` runs Workers locally.

- **Create KV namespaces**
  - `sessions` for UUID tokens.
  - `cache` for map queries.
  - **AC:** Namespaces available in both dev and prod.

- **Create D1 database**
  - Initialize schema migrations for `artwork`, `logbook`, and `tags`.
  - **AC:** Migration runs locally and on prod.

- **Create R2 bucket**
  - Folders: `originals/` and `thumbs/`.
  - Configure upload permissions.
  - **AC:** Upload test file via Worker, confirm in bucket.

---

## 4. Data Model Skeleton
- **Define tables**
  - `artwork`: id, lat, lon, type, created_at, status, tags (JSONB).
  - `tags`: id, artwork_id, logbook_id, label, value, created_at.
  - `logbook`: id, artwork_id, user_token, note, photos[], status, created_at.
  - **AC:** Schema reviewed and matches MVP spec.

- **Implement migration scripts**
  - Write SQL migrations for D1.
  - **AC:** Running migrations creates tables cleanly on empty DB.

- **Decide JSON vs relational tags**
  - For MVP, implement `tags` JSON field on `artwork`.
  - **AC:** Sample insert/query tested locally.

---

## 5. Developer Onboarding
- **Write README**
  - Repo overview, architecture diagram, stack description.
  - Local setup instructions.
  - **AC:** New dev can clone + run app in <10 min.

- **Document environment variables**
  - Cloudflare tokens, KV IDs, D1 IDs, R2 bucket.
  - Use `.env.example` file.
  - **AC:** New dev can configure env easily.

- **Add `npm run dev` script**
  - Runs frontend (Vue) + Workers (API) locally.
  - **AC:** Running script shows landing page + test API.

---

## 6. Landing Page Placeholder
- **Build scaffold landing page**
  - Minimal Vue + Tailwind app.
  - App bar with “Cultural Archiver” + placeholder buttons.
  - Full-screen Leaflet map centered on current location.
  - **AC:** Deployed site shows app bar + map.

---

## Success Criteria
- A new developer can clone the repo, configure `.env`, and run the app locally with `npm run dev`.  
- Commits to `main` auto-deploy to Cloudflare Pages + Workers.  
- D1 migrations create tables correctly.  
- Governance and license docs are published in repo.  
- Landing page placeholder visible in production.  
