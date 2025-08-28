# Task List: Phase 0 – Project Setup

Based on PRD: `tasks/phase0_prd.md`

## Relevant Files

- `package.json` - Root package configuration with dependencies, scripts, and project metadata
- `tsconfig.json` - TypeScript configuration for both frontend and workers
- `.env.example` - Environment variable template with Cloudflare configuration
- `.eslintrc.js` - ESLint configuration with Vue/TypeScript rules
- `.prettierrc` - Prettier formatting configuration
- `src/frontend/package.json` - Frontend-specific dependencies and scripts
- `src/frontend/vite.config.ts` - Vite build configuration for Vue frontend
- `src/frontend/tsconfig.json` - Frontend TypeScript configuration
- `src/workers/wrangler.toml` - Cloudflare Workers configuration
- `src/workers/package.json` - Workers-specific dependencies
- `src/workers/tsconfig.json` - Workers TypeScript configuration
- `src/workers/index.ts` - Main Workers entry point
- `src/shared/types.ts` - Shared TypeScript interfaces and types
- `migrations/migrate.ts` - TypeScript migration runner script (executable with node migrate.ts)
- `migrations/001_initial_schema.sql` - Initial database schema migration
- `.github/workflows/test.yml` - CI workflow for linting and type checking
- `.github/workflows/deploy-frontend.yml` - Frontend deployment workflow
- `.github/workflows/deploy-workers.yml` - Workers deployment workflow
- `.github/PULL_REQUEST_TEMPLATE.md` - Pull request template
- `.github/ISSUE_TEMPLATE/bug_report.md` - Bug report issue template
- `.github/ISSUE_TEMPLATE/feature_request.md` - Feature request issue template
- `CODE_OF_CONDUCT.md` - Community code of conduct
- `SECURITY.md` - Security policy and reporting guidelines
- `README.md` - Updated project documentation with setup instructions, npm commands, and development workflow

### Notes

- The project uses a monorepo structure with separate configurations for frontend and workers
- Node.js v23+ native TypeScript support eliminates compilation steps for development
- Cloudflare resources (D1, KV, R2) will be created through the Cloudflare dashboard initially
- GitHub repository settings and branch protection will be configured through the GitHub web interface
- All TypeScript configurations use strict mode for better code quality
- Development scripts can run TypeScript files directly with `node file.ts` (no transpilation needed)

## Tasks

- [ ] 1.0 Repository Foundation & Documentation
  - [x] 1.1 Update README.md with comprehensive setup instructions and npm commands
  - [ ] 1.2 Create CODE_OF_CONDUCT.md following GitHub's community standards
  - [ ] 1.3 Create SECURITY.md with vulnerability reporting guidelines
  - [ ] 1.4 Update CONTRIBUTING.md with specific development workflow and TypeScript requirements
  - [ ] 1.5 Create .github/PULL_REQUEST_TEMPLATE.md with checklist for code quality and testing
  - [ ] 1.6 Create .github/ISSUE_TEMPLATE/bug_report.md for standardized bug reports
  - [ ] 1.7 Create .github/ISSUE_TEMPLATE/feature_request.md for feature proposals
  - [ ] 1.8 Configure GitHub repository settings: branch protection rules for main branch requiring PR reviews
  - [ ] 1.9 Set up repository licenses: MIT/Apache-2.0 for code, CC0 for data (update LICENSE file)

- [ ] 2.0 Project Structure & Configuration
  - [ ] 2.1 Create root package.json with workspace configuration and shared dependencies
  - [ ] 2.2 Create root tsconfig.json optimized for Node.js v23+ native TypeScript support
  - [ ] 2.3 Set up ESLint configuration (.eslintrc.js) with @vue/eslint-config-typescript
  - [ ] 2.4 Set up Prettier configuration (.prettierrc) with default formatting rules
  - [ ] 2.5 Create .env.example with all required Cloudflare environment variables and descriptions
  - [ ] 2.6 Create src/frontend/ directory structure with Vue 3 + Vite setup
  - [ ] 2.7 Create src/frontend/package.json with Vue 3, TypeScript, and Vite dependencies
  - [ ] 2.8 Create src/frontend/vite.config.ts with proper TypeScript and build configuration
  - [ ] 2.9 Create src/frontend/tsconfig.json extending root configuration for browser compatibility
  - [ ] 2.10 Create src/workers/ directory with Cloudflare Workers TypeScript setup
  - [ ] 2.11 Create src/workers/package.json with Workers and Wrangler dependencies
  - [ ] 2.12 Create src/workers/wrangler.toml configuration file
  - [ ] 2.13 Create src/workers/tsconfig.json optimized for Node.js v23+ and Workers runtime
  - [ ] 2.14 Create src/workers/index.ts with basic Workers entry point and routing (runnable with node index.ts)
  - [ ] 2.15 Create src/shared/ directory with common TypeScript types and utilities
  - [ ] 2.16 Create src/shared/types.ts with database and API interfaces
  - [ ] 2.17 Set up npm scripts leveraging Node.js v23+ native TypeScript execution for development

- [ ] 3.0 Cloudflare Infrastructure Setup
  - [ ] 3.1 Set up shared development Cloudflare account access and document credentials
  - [ ] 3.2 Create Cloudflare Pages project linked to GitHub repository
  - [ ] 3.3 Configure Cloudflare Pages build settings for Vue/Vite frontend
  - [ ] 3.4 Create Cloudflare Workers project with TypeScript support
  - [ ] 3.5 Create shared development D1 database instance "cultural-archiver-dev"
  - [ ] 3.6 Create migrations/ directory structure for database version control
  - [ ] 3.7 Create migrations/001_initial_schema.sql with artwork, tags, and logbook tables
  - [ ] 3.8 Create TypeScript migration runner script leveraging Node.js v23+ native execution
  - [ ] 3.9 Run initial schema migration on development D1 database
  - [ ] 3.10 Create KV namespaces: "sessions" and "cache" for development environment
  - [ ] 3.11 Create R2 bucket "cultural-archiver-photos" with originals/ and thumbs/ folders
  - [ ] 3.12 Document all Cloudflare resource IDs and access instructions for team
  - [ ] 3.13 Configure Cloudflare Workers environment variables and bindings

- [ ] 4.0 CI/CD Pipeline Implementation
  - [ ] 4.1 Create .github/workflows/test.yml for ESLint, TypeScript checking, and Prettier
  - [ ] 4.2 Configure test workflow to run on all branches and pull requests
  - [ ] 4.3 Create .github/workflows/deploy-frontend.yml for Cloudflare Pages deployment
  - [ ] 4.4 Configure frontend deployment to trigger only on main branch merges
  - [ ] 4.5 Create .github/workflows/deploy-workers.yml for Cloudflare Workers deployment
  - [ ] 4.6 Configure workers deployment with proper environment variable injection
  - [ ] 4.7 Set up GitHub repository secrets for Cloudflare API tokens and account IDs
  - [ ] 4.8 Test all three workflows with sample commits and verify proper execution
  - [ ] 4.9 Configure workflow notifications and failure handling
  - [ ] 4.10 Verify automatic deployment triggers work correctly on main branch

- [ ] 5.0 Development Environment & Testing
  - [ ] 5.1 Install and configure concurrently package for running frontend and workers simultaneously
  - [ ] 5.2 Test npm run dev command starts both frontend (Vite) and workers (Wrangler) with native TypeScript
  - [ ] 5.3 Test npm run build command creates production builds for both frontend and workers
  - [ ] 5.4 Verify local development connects to shared D1 database instance
  - [ ] 5.5 Test local development workflow with hot reloading and native TypeScript execution
  - [ ] 5.6 Validate .env.example contains all necessary variables with clear descriptions
  - [ ] 5.7 Test TypeScript migration runner works with Node.js v23+ native execution
  - [ ] 5.8 Perform fresh repository clone test to validate complete setup process
  - [ ] 5.9 Document any discovered setup issues and update documentation accordingly
  - [ ] 5.10 Verify all success metrics from PRD are met (15-minute setup, 5-minute deployment)
  - [ ] 5.11 Create developer onboarding checklist highlighting Node.js v23+ requirements
  - [ ] 5.12 Validate TypeScript development workflow without compilation steps
