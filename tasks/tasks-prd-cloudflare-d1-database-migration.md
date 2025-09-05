# Tasks: PRD - Cloudflare D1 Database Migration

## Relevant Files

- `migrations/` - Existing migration SQL files and migration runner; will be reorganized and new Wrangler-compatible files added here.
- `migrations/archive/` - Archive location for old migration files (created as part of the migration move).
- `migrations/templates/` - New folder for D1-compatible migration templates and scaffolding.
- `src/workers/` - Worker code and `wrangler.toml` context; new D1 migration commands will run from this folder.
- `src/workers/wrangler.toml` - Wrangler configuration and environment entries used for D1 operations.
- `scripts/backup.ts` - Backup script to update for `wrangler d1 export` integration and R2 photo downloads.
- `migrations/migrate.ts` - Current custom migration runner (to be removed/archived).
- `package.json` - New npm scripts for migration and backup will be added/updated here.
- `docs/migrations.md` - Will be completely rewritten to document the new Wrangler-based workflow.
- `docs/development.md` - Update local dev setup to use new migration commands.
- `docs/deployment.md` - Update production deploy instructions to include migration steps and safeguards.
- `docs/backup-data-dump.md` - Update to reflect `wrangler d1 export` based backups and validation.
- `tests/` and `src/workers/test/` - Add/extend tests for migration validation, backup validation, and scripts.

### Notes

- This file contains detailed sub-tasks for each parent task from the PRD and follows `.github/instructions/generate-tasks.md`.
- Unit tests should follow existing project conventions (Vitest for workers, tests alongside code in `src/workers/test`) and run with `npm run test` at repo root.
- Use Wrangler CLI (`npx wrangler`) for all D1 migration operations; scripts should `cd src/workers` where appropriate.
- Assumptions made where PRD is underspecified:
  - We'll restart migration numbering with `0001_` based on PRD recommendation and include a consolidated baseline migration.
  - Wrangler version >= 4.33.2 is available in CI and developer machines.

## Tasks

- [x] 1.0 Archive current custom migration system
  - [x] 1.1 Audit `migrations/` to list all current migration files and confirm which are already applied in production.
  - [x] 1.2 Move `migrations/migrate.ts` and obsolete SQL files to `migrations/archive/` and add brief metadata file `migrations/archive/README.md` describing why each file was archived.
  - [x] 1.3 Remove or guard any npm scripts that call the old `migrate.ts` (leave behind clear comments in commits for reviewers).
  - [x] 1.4 Run the test suite and smoke-test local worker to ensure no regressions introduced by archiving.

- [x] 2.0 Create Wrangler-compatible migration structure
  - [x] 2.1 Create `migrations/templates/` with a D1-compatible SQL template and example header (timestamp, author, description).
  - [x] 2.2 Add `migrations/README.md` documenting the 4-digit sequential naming convention and D1 compatibility rules.
  - [x] 2.3 Create an initial placeholder `0001_initial_schema.sql` (consolidated baseline) and mark as draft for review.
  - [x] 2.4 Add a small Node/TS script `scripts/migration-scaffold.ts` (or npm script) to scaffold new migrations with proper name and template.

- [x] 3.0 Replace npm scripts and CLI workflows
  - [x] 3.1 Add/replace npm scripts in root `package.json` per PRD (migrate:create, migrate:dev, migrate:prod, migrate:status, migrate:rollback, migrate:validate, backup variants).
  - [x] 3.2 Ensure scripts run from `src/workers` (use `cd`) and pass `--env` flags where applicable.
  - [x] 3.3 Update `src/workers/package.json` if present to mirror necessary wrangler helper scripts.
  - [x] 3.4 Add documentation blurb in `docs/migrations.md` showing example commands and confirming pre-flight steps.

- [ ] 4.0 Implement migration validation and D1 compatibility checks
  - [ ] 4.1 Implement `scripts/validate-migration.ts` that scans SQL files for prohibited patterns (regex-based checks for `PRAGMA`, `WITHOUT ROWID`, `AUTOINCREMENT`, `ATTACH`, complex CHECKs using `length(`, etc.).
  - [ ] 4.2 Add unit tests for the validator under `src/workers/test/validate-migration.test.ts` covering supported and prohibited examples.
  - [ ] 4.3 Integrate the validator into `npm run migrate:create` and `migrate:validate` so migrations fail fast with clear messages.
  - [ ] 4.4 Document validation rules and example fixes in `docs/migrations.md`.

- [ ] 5.0 Update and integrate backup system with `wrangler d1 export`
  - [ ] 5.1 Update `scripts/backup.ts` to support `--wrangler-export` mode that runs `npx wrangler d1 export` and captures `database.sql`.
  - [ ] 5.2 Add logic to generate `migration_state.json` (wrangler migration status output) and include it in backup ZIP metadata.
  - [ ] 5.3 Ensure existing R2 photo download logic continues to work; add `--photos-only` flag paths unchanged.
  - [ ] 5.4 Add `backup:validate` mode that attempts a local restore of the exported SQL into a temporary local D1 instance (or SQLite file) and runs migration validation.
  - [ ] 5.5 Add unit/integration tests for backup flows (`tests/backup.test.ts`) which mock wrangler outputs.

- [ ] 6.0 Implement migration templates and developer tooling
  - [ ] 6.1 Populate `migrations/templates/d1-template.sql` with the PRD-provided D1-compatible template and comments.
  - [ ] 6.2 Implement `npm run migrate:create "name"` that uses the scaffold script to create `migrations/000X_name.sql` and opens it in the developer's editor (optional).
  - [ ] 6.3 Add example migrations for common tasks (add table, add index) under `migrations/examples/` for reference.

- [ ] 7.0 Add migration state reporting and environment isolation
  - [ ] 7.1 Add `migrate:status` and `migrate:status:prod` scripts that invoke `npx wrangler d1 migrations list` and output a machine-readable JSON status for CI.
  - [ ] 7.2 Implement safety checks in `migrate:prod` (explicit `--yes` flag or interactive confirmation) to avoid accidental prod runs.
  - [ ] 7.3 Ensure migration state tracking is environment-scoped; include test coverage for listing and comparing states across envs.

- [ ] 8.0 Create baseline migration for production reconciliation
  - [ ] 8.1 Inspect production schema dump (coordinate with ops) and assemble consolidated baseline SQL that represents current production.
  - [ ] 8.2 Add `0001_initial_schema.sql` to `migrations/` and mark it as applied in production using Wrangler migration state (or document manual step to reconcile state without reapplying destructive changes).
  - [ ] 8.3 Validate baseline by applying to a fresh local D1 database and running `npm run migrate:status` to confirm no pending conflicts.

- [ ] 9.0 Update documentation across docs/ (migrations, development, deployment, backup)
  - [ ] 9.1 Rewrite `docs/migrations.md` with step-by-step migration workflows, examples, compatibility rules, and templates.
  - [ ] 9.2 Update `docs/development.md` to include `npm run migrate:dev` and local setup steps, including how to reset local D1 for a clean development state.
  - [ ] 9.3 Update `docs/deployment.md` and `docs/production-deployment-fix.md` with production migration runbooks and confirmation steps.
  - [ ] 9.4 Update `docs/backup-data-dump.md` with the new `wrangler d1 export` backup flow and restoration guide.
  - [ ] 9.5 Add a short `docs/migration-troubleshooting.md` or a troubleshooting section covering common D1 errors and fixes.

- [ ] 10.0 Add tests, CI checks, and pre-flight validation in pipeline
  - [ ] 10.1 Add Vitest unit tests for migration validator, scaffold script, and backup validation under `src/workers/test/` or `tests/`.
  - [ ] 10.2 Update repository CI pipeline (e.g., GitHub Actions) to run `npm run migrate:validate` and `npm run test` on pull requests.
  - [ ] 10.3 Add a CI job that runs migration lint/validation on changed `migrations/` files and blocks merging if checks fail.

- [ ] 11.0 Team training, rollout plan, and post-deployment monitoring
  - [ ] 11.1 Create a migration runbook (short README) describing production steps, rollback, and audit logging requirements.
  - [ ] 11.2 Schedule migration window and notify team; coordinate with ops to take a pre-migration backup.
  - [ ] 11.3 After rollout, monitor migration status, backup health, and error logs for 48–72 hours; capture post-mortem if issues arise.

## Acceptance Criteria

- `migrations/` contains a Wrangler-compatible structure and `0001_initial_schema.sql` baseline.
- Root `package.json` contains the new migration and backup scripts and they run from the `src/workers` context.
- `scripts/validate-migration.ts` detects prohibited SQL and has unit tests with passing results.
- `scripts/backup.ts` supports `--wrangler-export`, produces ZIP with `database.sql`, `migration_state.json`, and `photos/`, and includes validation.
- Documentation updated for migrations, development setup, and backup procedures.
- CI runs migration validation on PRs and blocks merges for invalid migrations.

## Quick Validation / Smoke Steps

1. Run unit tests: `npm run test` (root). The repo should have existing tests; new tests run alongside them.
2. Scaffold a migration: `npm run migrate:create "add_example_table"` -> verify new file created `migrations/000X_add_example_table.sql` using template.
3. Run validation: `npm run migrate:validate` -> should pass for templates and fail for SQL containing `PRAGMA`.

---

If this looks good, I can also create the initial scaffold scripts and the validator implementation next — tell me which task to prioritize or say `start` to begin implementing task 4.1 (validator) first.
