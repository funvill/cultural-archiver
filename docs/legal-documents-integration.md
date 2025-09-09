# Legal Documents Integration

This document describes how legal documents (Terms of Service and Privacy Policy) are integrated into the Cultural Archiver frontend.

## Architecture Overview

### Document Storage
- **Source**: Legal documents are maintained in `/docs/` as Markdown files
- **Frontend Public**: Documents are synced to `/src/frontend/public/docs/` for web serving
- **Rendering**: Vue components fetch and parse Markdown at runtime using `marked`

### Key Files

#### Legal Documents
- `docs/terms-of-service.md` - Master Terms of Service document
- `docs/privacy-policy.md` - Master Privacy Policy document

#### Frontend Components
- `src/frontend/src/views/TermsView.vue` - Terms of Service page component
- `src/frontend/src/views/PrivacyView.vue` - Privacy Policy page component

#### Supporting Files
- `src/frontend/scripts/sync-docs.js` - Document synchronization script
- `src/shared/consent.ts` - Updated with links to new routes

## Document Synchronization

### Manual Sync
When legal documents are updated in `/docs/`:

```powershell
cd src/frontend
npm run sync-docs
npm run build
```

### Automatic Integration
The sync script:
1. Copies Markdown files from `/docs/` to `/src/frontend/public/docs/`
2. Creates necessary directories
3. Reports success/failure status

## Frontend Implementation

### Route Configuration
Routes added to `src/frontend/src/router/index.ts`:
- `/terms` - Terms of Service page
- `/privacy` - Privacy Policy page

### Component Features
- **Async Loading**: Fetches Markdown content at runtime
- **Error Handling**: Displays error states for failed loads
- **Loading States**: Shows spinners during content fetch
- **Markdown Parsing**: Uses `marked` library for HTML conversion
- **Responsive Design**: Optimized for mobile and desktop
- **Accessibility**: Proper heading hierarchy and semantic markup

### Styling
- **Tailwind CSS**: Utility classes for consistent design
- **Prose Plugin**: Typography optimization for long-form content
- **Dark Mode Ready**: Color classes support dark theme
- **Print Friendly**: Optimized for document printing

## Content Management

### Document Structure
Both legal documents follow this structure:
1. **Header**: Version, effective date, domain
2. **Numbered Sections**: Clear organization with legal and plain language
3. **Plain Language Summaries**: User-friendly explanations
4. **Legal Terms**: Comprehensive legal protections
5. **Version History**: Change tracking

### Key Legal Protections
- **Liability Limitation**: CAD $100 maximum liability
- **User Indemnification**: Users responsible for their content
- **CC0 Licensing**: Clear public domain dedication
- **Content Moderation Rights**: Platform discretion over content
- **Age Requirements**: 18+ verification
- **Privacy Protection**: Minimal data collection principles

### Version Control
- **Document Versioning**: Major.Minor format (e.g., 2.0, 2.1)
- **Consent Tracking**: Technical version in `consent.ts` (YYYY-MM-DD.vN)
- **Change Documentation**: Updates tracked in document headers
- **User Notification**: 30-day notice for material changes

## Integration Points

### Consent System
- Links updated in `src/shared/consent.ts`
- References in consent collection components
- Version tracking for legal compliance

### Navigation
- Footer links to legal documents
- Consent form references
- Help system integration

## Development Guidelines

### When to Update Documents
- New features affecting user rights
- Legal requirement changes
- Privacy practice modifications
- Liability or risk changes

### Update Process
1. **Edit Master Documents**: Update `/docs/` Markdown files
2. **Sync to Frontend**: Run `npm run sync-docs`
3. **Test Routes**: Verify both routes load correctly
4. **Update Consent Version**: Increment in `consent.ts` if needed
5. **Rebuild & Deploy**: Run build and deployment process

### Testing Checklist
- [ ] Both routes load without errors
- [ ] Markdown renders correctly
- [ ] Links work properly
- [ ] Mobile responsive design
- [ ] Error states display correctly
- [ ] Loading states appear briefly

## Future Enhancements

### Potential Improvements
- **Build-time Integration**: Generate HTML at build time instead of runtime
- **Content Validation**: Automated checking of document structure
- **Change Detection**: Automatic version incrementation
- **Multi-language Support**: Localized legal documents
- **Search Integration**: Full-text search within documents

### Monitoring
- **Analytics**: Track document view rates
- **User Feedback**: Collect understanding/clarity feedback  
- **Legal Review**: Regular professional review schedule
- **Compliance Audits**: Periodic regulatory compliance checks

## Troubleshooting

### Common Issues
- **404 Errors**: Check if `npm run sync-docs` was run after document updates
- **Rendering Issues**: Verify Markdown syntax is valid
- **Route Not Found**: Ensure router configuration is correct
- **Build Failures**: Check for TypeScript errors in components

### Debug Steps
1. Check browser network tab for file fetch errors
2. Verify files exist in `public/docs/`
3. Test Markdown parsing with simple content
4. Check console for component errors
