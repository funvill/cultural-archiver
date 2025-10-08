This directory contains generated artifacts related to the social media template bundling.

Files:
- bundled-templates.generated.ts — Auto-generated TypeScript file exporting the BUNDLED_TEMPLATES map.

Notes:
- Do NOT edit bundled-templates.generated.ts by hand. Edit the source templates in:
  src/workers/templates/social-media/*.txt

- Regenerate the bundled file by running (from the repository root):
  npm run bundle:templates

- We commit the generated file to the repository to ensure Cloudflare Worker builds
  (which cannot read the repository filesystem at runtime) have access to templates
  during CI and deploy workflows. If you prefer to keep it out of git, add it to
  .gitignore and ensure CI always runs the bundler prior to build/deploy.
