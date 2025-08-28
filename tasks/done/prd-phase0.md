# PRD: Phase 0 – Project Setup

## Introduction/Overview

Phase 0 establishes the foundational infrastructure, repositories, and workflows required to build and deploy the Cultural Archiver MVP. This phase focuses on creating a robust development environment that enables efficient collaboration and deployment, solving the problem of having no standardized setup for developers to contribute to the project. The goal is to create a complete development and deployment pipeline that allows any developer to quickly onboard and contribute to the Cultural Archiver project.

## Goals

1. Create and configure the project repository with correct licenses, contributing guidelines, and governance documents
2. Establish the Cloudflare infrastructure (Pages, Workers, KV, D1, R2) for serverless hosting, API logic, and storage
3. Implement automated deployment pipelines (GitHub → Cloudflare) for safe and repeatable deployments
4. Define and implement the initial data model (artwork + logbook + tags) with migration tooling
5. Provide developer onboarding documentation ensuring contributors can clone, run, and deploy locally with minimal setup

## User Stories

- As a new developer, I want to clone the repository and run the entire application locally with a single command (`npm run dev`) so that I can start contributing quickly without complex setup
- As a developer, I want my code to be automatically linted, tested, and type-checked when I push commits so that I can ensure my changes meet quality standards before creating pull requests
- As a project maintainer, I want every merge to the `main` branch to be automatically deployed to production so that we can have a reliable and fast release process
- As a contributor, I want clear documentation on how to set up my development environment so that I can focus on building features rather than configuration
- As a developer, I want the data model and migrations to be clearly defined so that I can understand the data structure and make appropriate changes

## Functional Requirements

1. **Repository Setup**: The system must create a GitHub repository with MIT/Apache-2.0 license for code and CC0 license for data
2. **Documentation**: The system must include CONTRIBUTING.md, CODE_OF_CONDUCT.md, and SECURITY.md files
3. **Templates**: The system must have PR templates and issue templates configured
4. **Branch Protection**: The system must configure main branch protection requiring PR reviews before merge
5. **CI/CD Workflows**: The system must create separate GitHub Actions workflows:
   - `.github/workflows/test.yml` for ESLint, TypeScript checking, and Prettier formatting
   - `.github/workflows/deploy-frontend.yml` for Cloudflare Pages deployment
   - `.github/workflows/deploy-workers.yml` for Cloudflare Workers deployment
6. **Frontend Deployment**: The system must automatically deploy Vue 3 + TypeScript + Vite frontend to Cloudflare Pages on merge to `main` branch
7. **API Deployment**: The system must automatically deploy TypeScript Cloudflare Workers on merge to `main` branch
8. **Infrastructure Setup**: The system must create Cloudflare Pages project for hosting frontend with automatic builds
9. **Workers Configuration**: The system must initialize Workers project with TypeScript configuration and proper routing
10. **Storage Setup**: The system must create KV namespaces named `sessions` and `cache` for session tokens and application cache
11. **Database Setup**: The system must set up shared development D1 database instance accessible by all developers
12. **Database Schema**: The system must initialize D1 database with the provided SQL schema for `artwork`, `logbook`, and `tags` tables
13. **File Storage**: The system must create R2 bucket named `cultural-archiver-photos` with folders: `originals/` and `thumbs/`
14. **Migration System**: The system must implement database migration scripts in `/migrations` folder with version control
15. **Development Environment**: The system must provide `npm run dev` command that starts Vue frontend and Workers locally using miniflare
16. **Build System**: The system must provide `npm run build` command that creates production-ready builds
17. **Package Dependencies**: The system must include package.json with major version pinning (e.g., "vue": "^3.4.0") for all dependencies
18. **Environment Configuration**: The system must include `.env.example` file documenting all required environment variables with placeholder values and descriptions
19. **Code Quality Setup**: The system must configure ESLint with @vue/eslint-config-typescript and Prettier with default configurations
20. **TypeScript Configuration**: The system must include proper tsconfig.json for both frontend and workers with strict type checking
21. **Cloudflare Account**: The system must provide instructions for accessing shared development Cloudflare account
22. **Error Handling**: The system must implement basic try/catch error handling with consistent JSON error responses
23. **Documentation**: The system must provide README.md with setup commands for cloning, installing, and running the development environment

## Non-Goals (Out of Scope)

- User-facing UI or submission functionality
- Integration with external services (OSM, Wikidata, Commons)
- Moderation, authentication, or map display logic
- Advanced features beyond basic project infrastructure
- Performance optimization beyond basic requirements
- Multi-environment setup (staging, development branches)

## Technical Considerations

**Technology Stack**:

- Frontend: Vue 3 + TypeScript + Vite
- Backend: Node.js + TypeScript for Cloudflare Workers
- Database: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2, KV
- Deployment: Cloudflare Pages + Workers

**Architecture**: The project uses a serverless architecture with Cloudflare Pages for frontend hosting, Cloudflare Workers for API logic, and Cloudflare services (KV, D1, R2) for data storage and management.

**Dependency Management**: Pin to specific major versions (e.g., "vue": "^3.4.0") to ensure compatibility while allowing patch updates.

**CI/CD Workflow Structure**: Use separate workflow files:

- `.github/workflows/test.yml` - Linting, type-checking, formatting
- `.github/workflows/deploy-frontend.yml` - Cloudflare Pages deployment
- `.github/workflows/deploy-workers.yml` - Cloudflare Workers deployment

**Local Development Database**: Connect to a shared development D1 instance to ensure consistency across all developers.

**Cloudflare Account Setup**: Use a shared development Cloudflare account for all developers. Production uses a separate account.

**Secret Management**: Document all required secrets in .env.example with placeholder values. Use clear variable names and descriptions.

**Code Quality**: Use default ESLint + Prettier configurations with Vue/TypeScript specific rulesets (@vue/eslint-config-typescript).

**Testing**: No testing framework in Phase 0 - focus on linting, type-checking, and formatting only.

**NPM Scripts**: Standardize on `npm run dev` for development and `npm run build` for production builds.

**Database Schema**:

```sql
-- artwork table
CREATE TABLE artwork (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'
);

-- tags table (relational approach)
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id INTEGER,
    logbook_id INTEGER,
    label VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artwork_id) REFERENCES artwork(id),
    FOREIGN KEY (logbook_id) REFERENCES logbook(id)
);

-- logbook table
CREATE TABLE logbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id INTEGER NOT NULL,
    user_token VARCHAR(255) NOT NULL,
    note TEXT,
    photos TEXT, -- JSON array of photo URLs
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artwork_id) REFERENCES artwork(id)
);
```

**Project Structure**: Follow standard Node.js conventions:

```text
cultural-archiver/
├── src/
│   ├── frontend/          # Vue 3 + TypeScript app
│   ├── workers/           # Cloudflare Workers
│   └── shared/            # Shared types and utilities
├── migrations/            # Database migration files
├── docs/                  # Documentation
├── tests/                  # Test
├── .github/              # GitHub templates and workflows
│   └── workflows/        # Separate workflow files
│       ├── test.yml      # Linting, type-checking, formatting
│       ├── deploy-frontend.yml
│       └── deploy-workers.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Configuration Examples

**Required .env.example variables**:

```env
# Cloudflare API Configuration
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# D1 Database
D1_DATABASE_ID=your_development_database_id_here

# KV Namespaces
KV_SESSIONS_ID=your_sessions_namespace_id_here
KV_CACHE_ID=your_cache_namespace_id_here

# R2 Storage
R2_BUCKET_NAME=cultural-archiver-photos

# Development Settings
NODE_ENV=development
```

**Required NPM Scripts (package.json)**:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:workers\"",
    "dev:frontend": "cd src/frontend && vite",
    "dev:workers": "wrangler dev src/workers/index.ts",
    "build": "npm run build:frontend && npm run build:workers",
    "build:frontend": "cd src/frontend && vite build",
    "build:workers": "wrangler publish src/workers/index.ts"
  }
}
```

**Key Dependencies (major versions)**:

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "@cloudflare/workers-types": "^4.0.0"
  },
  "devDependencies": {
    "@vue/eslint-config-typescript": "^12.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "wrangler": "^3.0.0",
    "concurrently": "^8.0.0"
  }
}
```

**Development Workflow**: GitHub Flow with feature branches → main, requiring PR reviews before merge.

**Environment Management**: Use .env files with .env.example template for local development, GitHub Secrets for CI/CD.

**Error Handling**: Implement basic try/catch blocks with consistent error response format.

**Deployment Pipeline**: GitHub Actions integration with Cloudflare ensures automated deployment on code changes, reducing manual deployment overhead and potential errors.

**Development Environment**: The use of miniflare allows developers to test Cloudflare Workers locally, ensuring consistency between development and production environments.

**Cost Considerations**: The infrastructure leverages Cloudflare's free tier where possible to minimize operational costs during the initial development phase.

## Success Metrics

- **Developer Onboarding Time**: A new developer can complete full environment setup (clone, configure, run locally) in under 15 minutes
- **Deployment Speed**: Code changes deploy to production in under 5 minutes from merge to main
- **Build Success Rate**: 95% of builds pass without manual intervention
- **Documentation Completeness**: All setup steps are documented and can be followed without external assistance
- **Infrastructure Reliability**: 99% uptime for deployed services during development phase

## Implementation Steps

### Phase 0.1: Repository Foundation

1. Create GitHub repository with proper licenses
2. Add CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
3. Configure PR and issue templates
4. Set up branch protection rules for main branch

### Phase 0.2: Development Environment

1. Create package.json with specified dependencies and major version pinning
2. Set up tsconfig.json for both frontend and workers with strict type checking
3. Configure ESLint with @vue/eslint-config-typescript and Prettier with defaults
4. Create .env.example with all required Cloudflare variables and descriptions
5. Implement project structure with src/frontend, src/workers, src/shared folders
6. Configure npm scripts for dev and build commands
7. Set up concurrently for running frontend and workers simultaneously

### Phase 0.3: Cloudflare Infrastructure

1. Set up shared development Cloudflare account access for team
2. Create Cloudflare Pages project linked to GitHub repository
3. Set up Cloudflare Workers project with TypeScript configuration
4. Initialize shared development D1 database instance
5. Run SQL schema migrations on development database
6. Create KV namespaces: "sessions" and "cache"
7. Set up R2 bucket "cultural-archiver-photos" with originals/ and thumbs/ folders
8. Document all Cloudflare resource IDs in team documentation

### Phase 0.4: CI/CD Pipeline

1. Create .github/workflows/test.yml for ESLint, TypeScript, and Prettier checks
2. Create .github/workflows/deploy-frontend.yml for Cloudflare Pages deployment
3. Create .github/workflows/deploy-workers.yml for Workers deployment
4. Configure GitHub repository secrets for Cloudflare API access
5. Test all three workflows with sample commits
6. Verify automatic deployment triggers on main branch merges

### Phase 0.5: Documentation & Testing

1. Write comprehensive README with setup commands
2. Document environment variable requirements
3. Test complete setup process with fresh clone
4. Validate all success metrics are met

## Open Questions

1. **Shared Cloudflare Account Details**: What are the specific login credentials and access permissions for the shared development Cloudflare account?

2. **Database Migration Naming**: Should migration files follow the format `YYYYMMDD_HHMMSS_description.sql` or `001_initial_schema.sql` numbering?

3. **Development Team Access**: How should new developers be granted access to the shared Cloudflare resources? Should there be a team onboarding checklist?

4. **Error Response Format**: What should the standard error response JSON structure include? Should it have fields like `error`, `message`, `code`, `timestamp`?

5. **Wrangler Configuration**: Should wrangler.toml be committed to the repository with environment-specific configurations, or kept as a template file?

6. **Local Development Port**: What specific ports should be used for local development? (e.g., frontend on 3000, workers on 8787)

7. **GitHub Repository Settings**: Should the repository require signed commits, have specific branch naming conventions, or other security policies?
