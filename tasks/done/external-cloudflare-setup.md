# External Cloudflare Setup Guide

This document outlines the manual setup steps required in Cloudflare that cannot be automated through code changes.

## Prerequisites

- Cloudflare account with appropriate permissions
- Access to the Cultural Archiver shared development account
- Understa```bash

# Test Workers deployment

wrangler deploy src/workers/index.ts

# Test D1 connection (use --env development for configured database)

wrangler d1 execute cultural-archiver --command "SELECT 1;" --env development

# Test KV access

wrangler kv namespace list

# Test R2 access

wrangler r2 bucket list

````dflare's services: Pages, Workers, KV, D1, R2

## Account Setup

### Shared Development Account

1. **Account Access**: Contact project maintainer for access to shared
   Cloudflare account
2. **Team Permissions**: Ensure you have the following roles:
   - **Administrator** or **Super Administrator** for full access
   - **Developer** role minimum for resource creation

### Account Information to Document

Record the following information for team access:

```env
# Main Account Details
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_EMAIL=team@api.publicartregistry.com
````

## Cloudflare Pages Setup

### [X] Create Pages Project

1. Navigate to **Cloudflare Dashboard** → **Pages**
2. Click **Create a project**
3. Select **Connect to Git**
4. Choose **GitHub** and authorize Cloudflare
5. Select the `cultural-archiver` repository
6. Configure build settings:
   - **Project name**: `cultural-archiver-frontend`
   - **Production branch**: `main`
   - **Build command**: `cd src/frontend && npm run build`
   - **Build output directory**: `src/frontend/dist`
   - **Root directory**: `/` (leave empty)

### Pages Environment Variables

Navigate to **Pages** → **cultural-archiver-frontend** → **Settings** → **Environment variables**:

#### Production Environment

| Variable       | Value                                       | Description          |
| -------------- | ------------------------------------------- | -------------------- |
| `NODE_ENV`     | `production`                                | Environment mode     |
| `VITE_API_URL` | `https://api.cultural-archiver.workers.dev` | Workers API endpoint |

#### Development/Preview Environment

| Variable       | Value                                           | Description              |
| -------------- | ----------------------------------------------- | ------------------------ |
| `NODE_ENV`     | `development`                                   | Environment mode         |
| `VITE_API_URL` | `https://api-dev.cultural-archiver.workers.dev` | Development API endpoint |

### [X] Custom Domain (Optional)

If using a custom domain:

1. Navigate to **Pages** → **cultural-archiver-frontend** → **Custom domains**
2. Click **Set up a custom domain**
3. Enter domain: `api.publicartregistry.com`
4. Update DNS records as instructed

## Cloudflare Workers Setup

### [X] Create Workers Project

1. Navigate to **Cloudflare Dashboard** → **Workers & Pages**
2. Click **Create application** → **Create Worker**
3. Configure:
   - **Name**: `cultural-archiver-api`
   - **Starter template**: HTTP handler

### Workers Environment Variables

Navigate to **Workers & Pages** → **cultural-archiver-api** → **Settings** → **Variables**:

| Variable      | Value                                 | Description             |
| ------------- | ------------------------------------- | ----------------------- |
| `NODE_ENV`    | `production`                          | Environment mode        |
| `CORS_ORIGIN` | `https://cultural-archiver.pages.dev` | Allowed frontend origin |

### Workers Routes and Triggers

Navigate to **Workers & Pages** → **cultural-archiver-api** → **Settings** → **Triggers**:

1. **Custom Domain**: `api.cultural-archiver.workers.dev`
2. **Route**: `api.publicartregistry.com/*` (if using custom domain)

## [x]D1 Database Setup

### Create Database Instance

1. Navigate to **Cloudflare Dashboard** → **D1 SQL Database**
2. Click **Create database**
3. Configure:
   - **Database name**: `cultural-archiver`
   - **Location**: Automatic (closest to team)

### [x] Database Schema Migration

After database creation:

1. **Get Database ID**: Copy the database ID from the D1 dashboard
2. **Update Environment**: Add `D1_DATABASE_ID` to your local `.env` file
3. **Run Migrations**: Execute the migration scripts (will be created in code)

### Database Connection

Navigate to **D1** → **cultural-archiver-dev** → **Settings**:

Record the following for team access:

```env
D1_DATABASE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### [X] Database Bindings

For each Workers project, add D1 binding:

1. Navigate to **Workers & Pages** → **cultural-archiver-api** → **Settings** → **Variables**
2. Add **Service Binding**:
   - **Variable name**: `DB`
   - **Service**: `D1 database`
   - **Database**: `cultural-archiver`

## KV Namespace Setup

### Create KV Namespaces

1. Navigate to **Cloudflare Dashboard** → **KV**
2. Create the following namespaces:

#### Sessions Namespace

- **Namespace name**: `cultural-archiver-sessions`
- **Purpose**: User session storage
- **TTL**: 24 hours default

#### Cache Namespace

- **Namespace name**: `cultural-archiver-cache`
- **Purpose**: Application caching
- **TTL**: 1 hour default

### [X] KV Bindings

For each Workers project, add KV bindings:

1. Navigate to **Workers & Pages** → **cultural-archiver-api** → **Settings** → **Variables**
2. Add **KV Namespace Binding**:
   - **Variable name**: `SESSIONS`
   - **KV namespace**: `cultural-archiver-sessions`
3. Add another **KV Namespace Binding**:
   - **Variable name**: `CACHE`
   - **KV namespace**: `cultural-archiver-cache`

### [X] Record KV IDs

Document the namespace IDs for team access:

```env
KV_SESSIONS_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
KV_CACHE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## R2 Storage Setup

### [X] Create R2 Bucket

1. Navigate to **Cloudflare Dashboard** → **R2 Object Storage**
2. Click **Create bucket**
3. Configure:
   - **Bucket name**: `cultural-archiver-photos`
   - **Location**: Automatic (closest to team)

### [??] R2 Folder Structure

Create the following folder structure in the bucket:

```
cultural-archiver-photos/
├── originals/          # Original uploaded photos
├── thumbnails/         # Generated thumbnails
└── temp/              # Temporary upload storage
```

### R2 Access Configuration

1. **Public Access**: Configure for thumbnail serving
2. **CORS Policy**: Allow frontend domain access
3. **Custom Domain**: Optional custom domain for assets

### [x] R2 Bindings

For Workers projects, add R2 binding:

1. Navigate to **Workers & Pages** → **cultural-archiver-api** → **Settings** → **Variables**
2. Add **R2 Bucket Binding**:
   - **Variable name**: `PHOTOS`
   - **R2 bucket**: `cultural-archiver-photos`

### [x] Record R2 Information

Document for team access:

```env
R2_BUCKET_NAME=cultural-archiver-photos
R2_BUCKET_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## API Token Creation

### Create API Token for CI/CD

1. Navigate to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use **Custom token** template
4. Configure permissions:
   - **Account**: `Cultural Archiver:Edit`
   - **Zone Resources**: `Include All zones`
   - **Zone**: `Zone:Edit, DNS:Edit`
   - **Page Rules**: `Page Rule:Edit`
5. **Client IP Address Filtering**: Include GitHub Actions IP ranges (optional)
6. **TTL**: Set expiration date (recommend 1 year)

### Token Permissions Required

Ensure the API token has these specific permissions:

- `Cloudflare Workers:Edit`
- [x] `Cloudflare Pages:Edit`
- [x] `D1:Edit`
- `KV Storage:Edit`
- [x] `R2 Storage:Edit`
- [x] `Account Settings:Read`

### Store Token Securely

Add the token to GitHub repository secrets as `CLOUDFLARE_API_TOKEN`.

## [x] Environment Configuration Summary

After completing all setup, your `.env` file should contain:

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

## Testing Cloudflare Setup

### Verification Checklist

After completing setup, verify each service:

- [ ] **Pages**: Frontend deploys successfully from GitHub
- [ ] **Workers**: API responds to HTTP requests
- [x] **D1**: Database queries work through Workers
- [x] **KV**: Session storage and cache operations work
- [x] **R2**: File uploads and retrieval work
- [x] **Bindings**: All Workers can access bound resources
- [ ] **API Token**: CI/CD pipelines can deploy successfully

### Test Commands

Run these commands to test each service:

```bash
# [x] Test Workers deployment
wrangler deploy src/workers/index.ts

# [x] Test D1 connection (use --env development for configured database)
wrangler d1 execute cultural-archiver --command "SELECT 1;" --env development

# [x] Test KV access
wrangler kv namespace list

# [x] Test R2 access
wrangler r2 bucket list
```

## Monitoring and Maintenance

### Cloudflare Analytics

Set up monitoring for:

1. **Pages Analytics**: Track frontend performance
2. **Workers Analytics**: Monitor API usage and errors
3. **R2 Analytics**: Track storage usage and costs

### Cost Management

Monitor usage to stay within free tier limits:

- **Workers**: 100,000 requests/day
- **Pages**: 1 build per project
- **KV**: 100,000 read operations/day
- **D1**: 5 million rows read/day
- **R2**: 10 GB storage

### Backup Strategy

Document backup procedures for:

1. **D1 Database**: Regular exports via CLI
2. **KV Data**: Backup critical session data
3. **R2 Objects**: Consider external backup for photos

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   - Check API token permissions
   - Verify account ID is correct
   - Ensure resources exist in correct account

2. **Database Connection Issues**
   - Verify D1 binding is configured
   - Check database ID matches
   - Ensure migrations have run

3. **CORS Errors**
   - Configure Workers CORS headers
   - Update allowed origins
   - Check custom domain configuration

### Support Resources

- **Cloudflare Docs**: https://developers.cloudflare.com/
- **Community Forum**: https://community.cloudflare.com/
- **Status Page**: https://www.cloudflarestatus.com/

## Security Best Practices

1. **API Token Security**
   - Use minimal required permissions
   - Set expiration dates
   - Rotate tokens quarterly
   - Monitor token usage in audit logs

2. **Resource Access**
   - Use least privilege principle
   - Configure proper CORS policies
   - Enable audit logging where available

3. **Data Protection**
   - Encrypt sensitive data in KV/D1
   - Use HTTPS for all endpoints
   - Implement proper authentication

## Next Steps

After completing Cloudflare setup:

1. Test all services manually
2. Run automated deployment pipeline
3. Verify frontend connects to API
4. Document any team-specific configurations
5. Create team onboarding checklist
