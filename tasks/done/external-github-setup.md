# External GitHub Setup Guide

This document outlines the manual setup steps required in the GitHub repository
that cannot be automated through code changes.

## Repository Settings Configuration

### Branch Protection Rules

1. Navigate to **Settings** → **Branches** in the GitHub repository
2. Click **Add rule** for the `main` branch
3. Configure the following settings:
   - ✅ **Require a pull request before merging**
     - ✅ **Require approvals** (minimum 1 reviewer)
     - ✅ **Dismiss stale PR approvals when new commits are pushed**
   - ✅ **Require status checks to pass before merging**
     - ✅ **Require branches to be up to date before merging**
     - Add required status checks: `test`, `lint`, `type-check`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Restrict pushes that create files that exceed 100MB**
   - ✅ **Do not allow bypassing the above settings**

### Repository Secrets Configuration

Navigate to **Settings** → **Secrets and variables** → **Actions** and add the
following secrets:

#### [X] Required Secrets for CI/CD

| Secret Name             | Description                                             | Example Value                      |
| ----------------------- | ------------------------------------------------------- | ---------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with Workers and Pages permissions | `xxxxxxxxxxxxxxxxxxxxxxxx`         |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                                   | `abcdef1234567890abcdef1234567890` |

#### Optional Secrets for Advanced Features

| Secret Name           | Description                                  | When Needed              |
| --------------------- | -------------------------------------------- | ------------------------ |
| `CLOUDFLARE_ZONE_ID`  | Zone ID for custom domain setup              | When using custom domain |
| `DISCORD_WEBHOOK_URL` | Discord webhook for deployment notifications | For team notifications   |

### Repository Settings

Navigate to **Settings** → **General** and configure:

#### Features

- ✅ **Wikis** (enabled)
- ✅ **Issues** (enabled)
- ✅ **Sponsorships** (optional)
- ✅ **Projects** (enabled)
- ✅ **Preserve this repository** (enabled)
- ✅ **Discussions** (optional)

#### Pull Requests

- ✅ **Allow merge commits**
- ✅ **Allow squash merging** (recommended as default)
- ✅ **Allow rebase merging**
- ✅ **Always suggest updating pull request branches**
- ✅ **Allow auto-merge**
- ✅ **Automatically delete head branches**

#### Archives

- ✅ **Include Git LFS objects in archives**

### Collaborators and Teams

Navigate to **Settings** → **Manage access**:

1. Add team members with appropriate permissions:
   - **Admin**: Project leads and maintainers
   - **Maintain**: Senior developers who can merge PRs
   - **Write**: Regular contributors
   - **Read**: Reviewers and external contributors

2. Set up team-based access if using GitHub Organizations

## License Configuration

1. Navigate to repository root and verify `LICENSE` file exists
2. For this project, ensure dual licensing:
   - **MIT License** for code components
   - **CC0 (Public Domain)** for data and documentation

## Repository Topics and Description

Navigate to **Settings** → **General**:

1. **Description**: "Cultural heritage documentation platform using Vue 3,
   TypeScript, and Cloudflare infrastructure"
2. **Topics** (add these tags):
   - `cultural-heritage`
   - `typescript`
   - `vue3`
   - `cloudflare-workers`
   - `cloudflare-pages`
   - `documentation`
   - `archival`

## Workflow Permissions

Navigate to **Settings** → **Actions** → **General**:

1. **Actions permissions**: "Allow enterprise, and select non-enterprise,
   actions and reusable workflows"
2. **Workflow permissions**: "Read and write permissions"
3. ✅ **Allow GitHub Actions to create and approve pull requests**

## Issue and PR Templates

These templates should be created through code commits, but require the
following GitHub repository settings:

Navigate to **Settings** → **Features**:

- ✅ **Issues** must be enabled
- ✅ **Pull requests** must be enabled

## Verification Checklist

After completing the manual setup, verify:

- [X] Branch protection rules are active on `main` branch
- [ ] Required status checks are configured
- [X] Repository secrets are added and accessible to workflows
- [X] Collaborator permissions are properly set
- [ ] Repository topics and description are updated
- [X] License file is present and correct
- [X] GitHub Actions have appropriate permissions
- [X] Issues and PRs are enabled

## Security Considerations

1. **API Tokens**: Use tokens with minimal required permissions
2. **Secret Rotation**: Plan to rotate Cloudflare API tokens quarterly
3. **Access Reviews**: Review collaborator access monthly
4. **Audit Logs**: Monitor repository activity through GitHub audit logs

## Troubleshooting

### Common Issues

1. **Workflow fails with permission errors**
   - Verify `CLOUDFLARE_API_TOKEN` has correct permissions
   - Check token hasn't expired

2. **Branch protection prevents emergency fixes**
   - Repository admins can temporarily disable protection
   - Always re-enable after emergency deployment

3. **Status checks not required**
   - Ensure workflow names match required checks
   - Check workflows are enabled and passing

## Next Steps

After completing this manual setup:

1. Test branch protection by creating a test PR
2. Verify secrets work by triggering a deployment workflow
3. Confirm all team members have appropriate access
4. Document any additional organization-specific requirements
