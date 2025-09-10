# Know things to do

## MVP

- Mass import
- Optimized submit new artwork

## General

- ????? - Remove the creators system and replace it with a comma seperated list of keywords to search for. This means that there won't be a artist details page.

- Move all the test files out of the base source folders into test folders
- The github copilot issue started PR. There is an error that `vitest` is not installed. `I see there's an issue with vitest not being found. Let me check if dependencies are installed and try to fix this:`

- `support@art.abluestar.com` currently errors out when sending an email to this address. This address should forward to my personal address.
- Check to make sure that the only email address that is public is `support@art.abluestar.com`.

## Sign in

- The system is not sending out magic links any more. I checked Resend and its not reciving any requests to send out emails.

## Artwork Details page

## Map page

- [ ] The map page should remember where what your last location was and the zoom level. So if you refresh the page again, it will return to the old location. Use local storage for this.
- [ ] Allow for an option to cluster or not to cluster pins on the map.

## Admin page

The admin page is a super user that can give moderators permissions to other users.

## Review Queue / Moderate page

- Move the tabs "New Submissions", and "Artwork Edits" to below the Moderate stats. (Simlare to the admin page)
- The "pending review" stat should also include the "Artwork Edits" pending.

## App Bar

- In the app bar. Change the "add" to a Camera Icon and make it 3 times larger then all of the other menu items in the app bar. This icon should glow with a fuzzy border. This is the main button people will use and we want to bring attention to it.
- Help, logout, Admin, and Moderator should automaticly be put in to the menu. The menu should always be shown on the right hand side.

## Choose a name

Use https://domains.cloudflare.com/ to find the domain.

### Avalaible

- artfind.net

## Find partners

Find people that would be willing to partner with me on this project. Be specific and say that you are NOT looking for monetary support but are looking for in-kind support. Advertisement, recommendations, etc.

- Burrard Arts Foundation, Centre for Digital Media students. They spondered a simlare project in the past. https://intergalactic.com/content/muse-public-art-app?utm_source=chatgpt.com
- Canada Council - They prefer events over resources. The event could be a mass hunt for new art.

## Add artwork

- After a user uploads a photo, they are shown the search results page of artwork nearby. If the user clicks one of the artwork cards from the search results, they should be brought to a logbook submission form. On this page they can submit a new photo and any other information that they want to. This page is identical to the new artwork submission details page but instead of submitting new artwork it submits a logbook entry, and a artwork details update.

----

## Vancouver Mass Import

The Mass import for vancouver, imports the text correctly. But the import is missing the image.

The image needs to be downloaded from the Vancouver open data recored and submitted as an upload.

The photo can be found at the `$.photourl.url`

Example: `[{photourl: {"url": "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-art/files/25a422b0cc36381e0c0ab681d38f602d"}}]`






## Mass import artwork with unknonw tags

When a user submits a edit or a new artwork. Only validate on the known tags (Keywords, artwork type, etc...), but if a unknown tag is submitted accept it with a value type of string.

```
OPTIONS https://art-api.abluestar.com/api/artwork/REDACTED/edit - Ok @ 2025-09-09, 11:46:47 p.m.
  (log) <-- OPTIONS /api/artwork/5563cf05-90cd-4b1e-9a02-60535b7dac39/edit
  (log) --> OPTIONS /api/artwork/5563cf05-90cd-4b1e-9a02-60535b7dac39/edit
 204 0ms
POST https://art-api.abluestar.com/api/artwork/REDACTED/edit - Ok @ 2025-09-09, 11:46:48 p.m.
  (log) <-- POST /api/artwork/5563cf05-90cd-4b1e-9a02-60535b7dac39/edit
  (log) [TAG VALIDATION DEBUG] Starting tag validation: {
  tags: {
    keywords: '',
    material: 'steel',
    artwork_type: 'sculpture',
    start_date: '1986',
    operator: 'City of Vancouver',
    location: 'Lawn along Georgia Street',
    neighbourhood: 'Downtown',
    source: 'vancouver-opendata',
    condition: 'good',
    addr_full: 'Denman & Georgia Street, Devonian Harbour Park, Downtown, Vancouver, BC, Canada',
    source_url: 'https://covapp.vancouver.ca/PublicArtRegistry/ArtworkDetail.aspx?ArtworkId=27',
    external_id: '27',
    license: 'Open Government Licence – Vancouver',
    import_date: '2025-09-10',
    import_method: 'mass_import'
  },
  timestamp: '2025-09-10T06:46:48.065Z'
}
  (log) [TAG VALIDATION DEBUG] Tags sanitized: {
  sanitizedTags: {
    keywords: '',
    material: 'steel',
    artwork_type: 'sculpture',
    start_date: '1986',
    operator: 'City of Vancouver',
    location: 'Lawn along Georgia Street',
    neighbourhood: 'Downtown',
    source: 'vancouver-opendata',
    condition: 'good',
    addr_full: 'Denman & Georgia Street, Devonian Harbour Park, Downtown, Vancouver, BC, Canada',
    source_url: 'https://covapp.vancouver.ca/PublicArtRegistry/ArtworkDetail.aspx?ArtworkId=27',
    external_id: '27',
    license: 'Open Government Licence – Vancouver',
    import_date: '2025-09-10',
    import_method: 'mass_import'
  }
}
  (log) [SHARED VALIDATION DEBUG] Skipping required tag validation - all tags are optional
  (log) [TAG VALIDATION DEBUG] Validation results: {
  validationResults: {
    keywords: { isValid: true, errors: [], warnings: [] },
    material: { isValid: true, errors: [], warnings: [] },
    artwork_type: { isValid: true, errors: [], warnings: [] },
    start_date: { isValid: true, errors: [], warnings: [] },
    operator: { isValid: false, errors: [Array], warnings: [] },
    location: { isValid: false, errors: [Array], warnings: [] },
    neighbourhood: { isValid: false, errors: [Array], warnings: [] },     
    source: { isValid: false, errors: [Array], warnings: [] },
    condition: { isValid: true, errors: [], warnings: [] },
    addr_full: { isValid: false, errors: [Array], warnings: [] },
    source_url: { isValid: false, errors: [Array], warnings: [] },        
    external_id: { isValid: false, errors: [Array], warnings: [] },       
    license: { isValid: false, errors: [Array], warnings: [] },
    import_date: { isValid: false, errors: [Array], warnings: [] },       
    import_method: { isValid: false, errors: [Array], warnings: [] }      
  }
}
  (log) [TAG VALIDATION DEBUG] Validation summary: {
  summary: {
    isValid: false,
    totalErrors: 10,
    totalWarnings: 0,
    errorMessages: [
      'Unknown tag: operator',
      'Unknown tag: location',
      'Unknown tag: neighbourhood',
      'Unknown tag: source',
      'Unknown tag: addr_full',
      'Unknown tag: source_url',
      'Unknown tag: external_id',
      'Unknown tag: license',
      'Unknown tag: import_date',
      'Unknown tag: import_method'
    ],
    warningMessages: []
  }
}
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'operator', message: 'Unknown tag: operator' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'location', message: 'Unknown tag: location' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'neighbourhood', message: 'Unknown tag: neighbourhood' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'source', message: 'Unknown tag: source' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'addr_full', message: 'Unknown tag: addr_full' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'source_url', message: 'Unknown tag: source_url' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'external_id', message: 'Unknown tag: external_id' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'license', message: 'Unknown tag: license' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'import_date', message: 'Unknown tag: import_date' }
  (log) [TAG VALIDATION DEBUG] Adding validation error: { key: 'import_method', message: 'Unknown tag: import_method' }
  (log) [TAG VALIDATION DEBUG] Final validation response: {
  valid: false,
  errorCount: 10,
  warningCount: 0,
  errors: [
    { key: 'operator', message: 'Unknown tag: operator' },
    { key: 'location', message: 'Unknown tag: location' },
    { key: 'neighbourhood', message: 'Unknown tag: neighbourhood' },      
    { key: 'source', message: 'Unknown tag: source' },
    { key: 'addr_full', message: 'Unknown tag: addr_full' },
    { key: 'source_url', message: 'Unknown tag: source_url' },
    { key: 'external_id', message: 'Unknown tag: external_id' },
    { key: 'license', message: 'Unknown tag: license' },
    { key: 'import_date', message: 'Unknown tag: import_date' },
    { key: 'import_method', message: 'Unknown tag: import_method' }       
  ]
}
  (error) Unexpected error in route handler: Error: Invalid tags format: Tag validation failed: Unknown tag: operator, Unknown tag: location, Unknown tag: neighbourhood, Unknown tag: source, Unknown tag: addr_full, Unknown tag: source_url, Unknown tag: external_id, Unknown tag: license, Unknown tag: import_date, Unknown tag: import_method
  (error) [3ab4bda9] API Error: {
  error: 'INTERNAL_ERROR',
  stack: 'ApiError: INTERNAL_ERROR\n' +
    '    at index.js:6626:9\n' +
    '    at async dispatch (index.js:4477:17)\n' +
    '    at async index.js:12653:5\n' +
    '    at async dispatch (index.js:4477:17)\n' +
    '    at async rateLimitSubmissions (index.js:6884:5)\n' +
    '    at async dispatch (index.js:4477:17)\n' +
    '    at async cors2 (index.js:6141:5)\n' +
    '    at async dispatch (index.js:4477:17)\n' +
    '    at async prettyJSON2 (index.js:6224:5)\n' +
    '    at async dispatch (index.js:4477:17)',
  statusCode: 500,
  path: '/api/artwork/5563cf05-90cd-4b1e-9a02-60535b7dac39/edit',
  method: 'POST'
}
  (log) --> POST /api/artwork/5563cf05-90cd-4b1e-9a02-60535b7dac39/edit 500 59ms
  ```