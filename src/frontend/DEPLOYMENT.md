# Frontend Deployment Scripts

## Overview
This document explains the deployment scripts to prevent accidentally using development Clerk keys in production.

## Scripts

### Production Deployment (RECOMMENDED)
```bash
npm run deploy:prod
```
- **Purpose**: Deploy to production with proper environment variables
- **Clerk Keys**: Uses `VITE_CLERK_PUBLISHABLE_KEY_PROD` from root `.env` file
- **Process**: 
  1. Reads production Clerk key from root `.env` file
  2. Sets `VITE_CLERK_PUBLISHABLE_KEY` to production value
  3. Builds frontend with production environment
  4. Deploys to Cloudflare Workers with `--env production`

### Default Deployment
```bash
npm run deploy
```
- **Purpose**: Alias for `deploy:prod` to prevent accidental dev key usage
- **Safety**: Always uses production keys

### Development Build
```bash
npm run build
```
- **Purpose**: Build for development/testing
- **Clerk Keys**: Uses `VITE_CLERK_PUBLISHABLE_KEY` from local environment (typically dev keys)

### Production Build
```bash
npm run build:prod
```
- **Purpose**: Build with production environment settings
- **Clerk Keys**: Requires `VITE_CLERK_PUBLISHABLE_KEY` to be set to production value

## Environment Variables Required

### Root `.env` file must contain:
```
VITE_CLERK_PUBLISHABLE_KEY_DEV=pk_test_...
VITE_CLERK_PUBLISHABLE_KEY_PROD=pk_live_...
```

## Troubleshooting

### Issue: Production site shows "Development Mode"
**Cause**: Frontend was deployed with development Clerk keys
**Solution**: Run `npm run deploy:prod` to redeploy with production keys

### Issue: "Missing VITE_CLERK_PUBLISHABLE_KEY_PROD"
**Cause**: Root `.env` file missing production key
**Solution**: Add `VITE_CLERK_PUBLISHABLE_KEY_PROD=pk_live_...` to root `.env` file

## Safety Measures
1. `deploy` script is aliased to `deploy:prod` to prevent accidents
2. Production deployment script validates environment variables before proceeding
3. Clear error messages when production keys are missing
4. Automatic environment variable loading from root `.env` file