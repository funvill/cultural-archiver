# GitHub Actions Secrets Configuration

This document outlines the GitHub repository secrets required for the deployment workflow to function correctly.

## Required Secrets

The following secrets must be configured in your GitHub repository settings under **Settings > Secrets and variables > Actions**:

### Required for Database Migration

| Secret Name | Description | Example Value | Required |
|-------------|-------------|---------------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with D1 and Workers permissions | `your-cloudflare-api-token-here` | ✅ Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | `your-account-id-here` | ✅ Yes |
| `D1_DATABASE_ID` | Production D1 database ID | `your-production-database-id` | ✅ Yes |
| `D1_DATABASE_NAME` | Production D1 database name | `cultural-archiver` | ✅ Yes |

## How to Obtain These Values

### 1. Cloudflare API Token

1. Go to [Cloudflare Dashboard > My Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Custom token** template with these permissions:
   - **Account**: Your account - `Cloudflare Workers:Edit`
   - **Zone Resources**: Include All zones
   - **Zone**: `Zone:Edit, DNS:Edit` (if custom domains are used)
   - **Additional permissions**:
     - `D1:Edit` - Required for database operations
     - `Workers KV Storage:Edit` - Required for KV operations
     - `R2 Storage:Edit` - Required for photo storage

### 2. Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. In the right sidebar, find **Account ID**
4. Copy the value

### 3. D1 Database ID

#### Option A: Existing Database
1. Go to [Cloudflare Dashboard > D1](https://dash.cloudflare.com/)
2. Find your production database (should be named `cultural-archiver`)
3. Click on it to view details
4. Copy the **Database ID**

#### Option B: Create New Database
1. Go to [Cloudflare Dashboard > D1](https://dash.cloudflare.com/)
2. Click **Create database**
3. Name it `cultural-archiver`
4. Copy the **Database ID** from the created database

### 4. D1 Database Name

This should be `cultural-archiver` to match the configuration in `wrangler.toml`.

## Setting Up Secrets in GitHub

1. Go to your repository on GitHub
2. Click **Settings** tab
3. In the left sidebar, click **Secrets and variables** > **Actions**
4. Click **New repository secret**
5. Add each secret with its corresponding name and value

## Verification

After setting up the secrets, you can verify they work by:

1. Pushing a commit to the `main` branch
2. Checking the **Actions** tab for the deployment workflow
3. The migration step should now pass instead of failing

## Security Notes

- Never commit these values directly to your repository
- API tokens should have minimal required permissions
- Consider setting token expiration dates
- Rotate tokens regularly for security

## Troubleshooting

### "D1_DATABASE_ID secret is not set" Error

This means the `D1_DATABASE_ID` secret is missing or empty. Double-check it's set correctly in GitHub repository secrets.

### "Cannot connect to production database" Error

This usually indicates:
- Incorrect `CLOUDFLARE_API_TOKEN` (wrong token or insufficient permissions)
- Incorrect `D1_DATABASE_ID` (database doesn't exist or wrong ID)
- Incorrect `CLOUDFLARE_ACCOUNT_ID`

### Migration Validation Failures

The workflow includes built-in validation. If migrations fail validation:
1. Check the migration files for D1 compatibility issues
2. Run `npm run migrate:validate` locally to see detailed error messages
3. Fix any issues before pushing to main

## Related Documentation

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare API Token Documentation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Project Migration System Documentation](./migrations.md)