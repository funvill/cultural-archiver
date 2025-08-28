# PRD: Phase 0 – Project Setup
**Project:** Cultural Archiver  
**Phase:** 0 — Initial Project Setup  
**Owner:** Steven Smethurst  
**Date:** YYYY-MM-DD  

---

## Overview
The purpose of Phase 0 is to establish the foundational infrastructure, repositories, and workflows required to build and deploy the Cultural Archiver MVP. This phase will not include user-facing features; instead, it ensures the development environment, deployment pipelines, data model skeleton, and project governance are in place.

---

## Goals
1. Create and configure the project repository with correct licenses, contributing guidelines, and governance documents.  
2. Establish the Cloudflare infrastructure (Pages, Workers, KV, D1, R2) for serverless hosting, API logic, and storage.  
3. Implement automated deployment pipelines (GitHub → Cloudflare) for safe and repeatable deployments.  
4. Define and implement the initial data model (artwork + logbook + tags) with migration tooling.  
5. Provide developer onboarding docs, ensuring contributors can clone, run, and deploy locally with minimal setup.  

---

## Non-Goals
- No user-facing UI or submission functionality in this phase.  
- No integration with external services (OSM, Wikidata, Commons).  
- No moderation, auth, or map display logic yet.  

---

## Requirements

### Functional
- **Repository Setup**  
  - Repo created on GitHub with MIT/Apache-2.0 license (code) and CC0 license (data).  
  - CONTRIBUTING.md, CODE_OF_CONDUCT.md, and SECURITY.md present.  
  - PR templates and issue templates configured.  

- **CI/CD**  
  - GitHub Actions pipeline runs tests, type-checks, and lints.  
  - On merge to `main`, Cloudflare Pages automatically builds and deploys frontend.  
  - On merge to `main`, Cloudflare Workers automatically deploy API changes.  

- **Cloudflare Setup**  
  - Pages project created for hosting frontend.  
  - Workers monorepo initialized for API routes.  
  - KV namespaces created for session tokens + cache.  
  - D1 database initialized with migrations for `artwork`, `logbook`, `tags`.  
  - R2 bucket created for photo storage (originals + 800px).  

- **Data Model (Skeleton)**  
  - **artwork**: id, lat, lon, type, created_at, status, tags (JSONB or external table)  
  - **tags**: id, artwork_id, logbook_id, label, value, created_at  
  - **logbook**: id, artwork_id, user_token, note, photos[], status, created_at  

- **Dev Onboarding**  
  - README with setup instructions: cloning, installing deps, running locally with `miniflare`.  
  - Clear environment variable setup doc (API keys, Cloudflare tokens, etc).  

### Non-Functional
- Must deploy in < 5 min from push to live.  
- Cost-efficient: use Cloudflare free tier where possible.  
- Logs available in Cloudflare dashboard for debugging.  

---

## Milestones / Tasks

1. **Repository & Governance**
   - [ ] Create GitHub repo, set licenses (MIT/Apache-2.0 for code, CC0 for data).  
   - [ ] Add CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md.  
   - [ ] Add issue templates and PR templates.  

2. **CI/CD**
   - [ ] Configure GitHub Actions to lint + type-check (Vue, TypeScript).  
   - [ ] Connect repo to Cloudflare.  
   - [ ] On push to `main`, auto-deploy frontend to Pages.  
   - [ ] On push to `main`, auto-deploy Workers.  

3. **Cloudflare Infra**
   - [ ] Create Pages project (dev + prod).  
   - [ ] Initialize Workers monorepo.  
   - [ ] Configure KV namespaces (`sessions`, `cache`).  
   - [ ] Create D1 database, migrations for `artwork`, `logbook`, `tags`.  
   - [ ] Create R2 bucket with folders: `originals/`, `thumbs/`.  

4. **Data Model Skeleton**
   - [ ] Define minimal `artwork` table with JSONB `tags` field.  
   - [ ] Define `tags` table variant if relational model preferred.  
   - [ ] Define `logbook` table with photos[] JSON field.  
   - [ ] Migration scripts created and tested locally with `miniflare`.  

5. **Onboarding**
   - [ ] README with dev setup instructions.  
   - [ ] Env vars doc (Cloudflare API tokens, KV IDs, etc).  
   - [ ] Example command: `npm run dev` → launches frontend + Workers locally.  

---

## Success Criteria
- A new developer can clone the repo, configure `.env`, and run the app locally with `npm run dev`.  
- Commits to `main` auto-deploy to Cloudflare Pages + Workers.  
- D1 migrations create tables correctly.  
- Governance and license docs are published in repo.  
- Landing page placeholder visible in production.  
