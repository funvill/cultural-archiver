# Changes over time

These are small changes that I did inline.

## General

- [x] database reset should also reset the `moderation_decisions`, and `admin_actions` table


- ✅ FIXED - The GitHub Actions workflow had issues with vitest dependency installation. Fixed by:
  - Updated Node.js version from 23.x to 22.x (more stable)
  - Fixed cache placement to occur before dependency installation  
  - Updated cache action from v3 to v4
  - Simplified workspace dependency installation using npm workspaces correctly
  - Verified that vitest is properly installed in both frontend and workers workspaces


## Sign in

- [x] The system is not sending out magic links any more. I checked Resend and its not reciving any requests to send out emails.

## Artwork Details page

- [x] Move the tags section from below the description into the "informaiton" side bar
- [x] Remove "status", "Creators", and "Type" from information side bar.
- Tags
  - [x] Remove "Description", "Artwork name", and "Artist name" from the possiable tags. These are already part of the artwork table.
  - [x] Remove "Tourist type" from the possiable tags. This value will always be "artwork" when exported.
  - [x] Add "Tiny Libary", to the "Artwork Type" tag enumerations.
  - [x] Change tag "Creation date" to "Installtion date"
- [x] At the top of the page, move the replace the "Map" in the breadcrumbs with "< Back to Map".
- [x] The "Edit" button should be right aligned in the same row as the breadcrumbs. Make the edit button larger.
- [x] The "Community Journal" entries, have a icon button in the top right hand corner (open in new window). Remove this icon.
- [x] The visual look should be bold tag label: Value... instead of blue box chiplets
- [x] When viewing an artwork. Remove the ability to collapse the different tag sections.
- [x] Add a new tag called, "keywords", this has a comma seperated list of keywords, Each keyword is clickable. When clicked the user is sent to the search page to search for other artworks with the same keywords. Search by keywords. The keywords are free form, comma seperated and they can have 500 chars of keywords.
- [x] The information and details section should be combined. The "Added" filed should always be at the top of the information section followed by the variable tags.
- [x] The artwork description should render as Markdown. On the edit page add some quick markdown tips under the description text box. For example: Bold, header, link, list, etc...
- [x] Above the title there is an icon "🏛️" and Chiplet "Other". Remove this Row from the artwork details page.

- In edit mode
  - [x] The different tags should show as a full row value instead of a block floating.
  - [x] A user should be able to click the tags and edit the value in the form as the add tag.
  - [x] Couldn't enter in height, produced error.

## Add artwork

[x] After adding a new artwork. Then approving it in the moderators queue. I can see the artwork pin on the map. But when I click the map pin I get a error

```txt
Artwork Not Found
Artwork with ID "2d74d47e-af12-45bb-b1a2-295a17839c4d" was not found. It may have been removed or is pending approval.
```

- [X] Reorder the artwork submission page . All the information and then gets consent for submitting it. If they don't give consent then don't actually submit the documents to the website. The consent variable needs to be added to the logbook so we know what version of each consent checkbox they accept agreed to.

----

Update the add artwork workflow

  1) Customer uploads a photo first
  2) The system uses the photo's GPS, and the browsers GPS, and if all else fails, the IP address IP Address to find a list of artworks that are near by. This is shown as a search results page.
  3) The user can either
    3A) "Add new artwork" - The user reviews the close by artworks and determins that this is a new artwork.
    3B) The user clicks one of the existing artworks to add the logbook entry to the existing artwork.
  4) After they fill in the addtional information. They are asked for consent to use this inforamtion then its submitted to the website.

---- 

- [x] The "Change location". Should pop up a model dialog with a map, and a pin in the center. The user drags around the map until the pin in the center is in the right location. Then the customer clicks "update location" to save the location.
- On the "Add new artwork page"
  - [x] Type dropdown, does not have "tiny_libary", it should be in the list of "Type"
- [x] In the "Nearby Artworks" section. Show Similarity, and distance from the location, etc... This is simlare to the Artwork search by photo results page...
- [x] On the "Add new artwork page"
  - [x] The title is not required for a new artwork only the location and a photo
  - [x] Remove "Year", from the form
  - [x] Remove "Additional Notes", from the form
  - [x] The uploaded image is showing a broken image.
  - [x] The "Change location" link does not do anything
- [x] After submitting new artwork, Disable the submit button. Then redirect to the map page.

----

Consent checkboxes
There are several things we need to check before the user can submit a new artwork for us to use. License, are they above 18, do they have the right to give us the photo, etc...

Add the consent checkboxes above the submit button.
The customer must agree to all the consent terms of service before they can submit the new artwork. Each one should have its own checkbox.
Add a button to "Check and agree to all" that automaticly checks all the consent checkboxes. Part of the submission should include the versions of the different consents that they agreed to for our recoreds.



Update the consent checklist. 
First one should be "CC0 Public Domain Dedication". Update the note about this license to include mention of 

- Text, images, and metadata they submit.
- Confirmation they own the copyright or have the right to release it under CC0.
- They agree their submissions may be shared with and redistributed through third parties (OSM, Wikimedia Commons, public APIs, etc.).
- No expectation of compensation or control over future use of the content.

Next should be a general terms of service. This one bundles a bunch of things together. A lot of this can be linked out to a terms of service or privicy policy page. This checkbox can include things like

- Age Verification (18+) - I confirm that I am 18 years of age or older and legally able to provide consent for photo submissions.
- Public Commons Contribution - I understand that my submissions will become part of a public cultural archive and may be used for educational, research, and cultural preservation purposes. Shared far and wide. 
- Freedom of Panorama Acknowledgment - I understand Canada's Freedom of Panorama laws and confirm that my photos are taken from publicly accessible locations (with link)
- confirm submissions are accurate to the best of their knowledge (location, attribution, description, etc.).
- Confirmation they won’t submit personal data (faces, license plates, addresses in text fields, etc.) unless it’s incidental and compliant with your privacy policy.
- Agreement to abide by moderation decisions without dispute.
- User agrees to indemnify the project from claims if they submit content they didn’t have rights to.
- You (the project) don’t guarantee permanence of submissions (they could be removed, modified, or archived).

3rd checkbox is specifically about the photos 

Photo Rights Checklist
- I took these photos myself or have explicit permission from the photographer to submit them.
- Photos were taken in public spaces where photography is permitted.
- The artwork is in a publicly accessible location and I have the right to photograph and share it under Canada's Freedom of Panorama provisions.

The "Submit Artwork" button should not be enabled until the user clicks all of the consent checkboxes. 

Remove the note about the "Consent Status". The user needs to agree to all the checkboxes for all submissions. 

All of the consent boxes should be small and link out to more information when possiable or required. 

ASk me questions about this feature before implmenting it. 


## Map

- [x] The artwork search radius should be the visable screen based on the zoom level and the screen size.
- [x] The icon used as the marker on the map should be based off of the tag "Artwork Type". If the artwork does not have a "Artwork Type", then use a default. Each "Artwork Type" should have a different icon.
- [x] Zooming out should cluster artwork markers on the map.

## Admin page

The admin page is a super user that can give moderators permissions to other users.

- [x] List existing users that have email address.
- [x] The ability to give moderators permissions to users with email address.
- [x] The ability to give moderators permissions to users with email address.
- [x] All of the users on the admin index page have "Unknown Email", including "6c970b24-f64a-49d9-8c5f-8ae23cc2af47" user that i know has a email address.
- [x] The search always returns all of the results, regarless of what I search for

----

[x] When I click the link in the header for "admin", I get the following error

```txt
{
  "referenceId": "mfbid4ri-90w97t",
  "message": "Cannot read properties of undefined (reading 'toLocaleString')",
  "stack": "TypeError: Cannot read properties of undefined (reading 'toLocaleString')\n    at Proxy.<anonymous> (https://art.abluestar.com/assets/AdminView-BzvBEEUH.js:1:48675)\n    at Xs (https://art.abluestar.com/assets/vendor-2hKZjCc7.js:13:26655)\n    at zr.R [as fn] (https://art.abluestar.com/assets/vendor-2hKZjCc7.js:13:19154)\n    at zr.run (https://art.abluestar.com/assets/vendor-2hKZjCc7.js:9:1907)\n    at zr.runIfDirty (https://art.abluestar.com/assets/vendor-2hKZjCc7.js:9:2216)\n    at rn (https://art.abluestar.com/assets/vendor-2hKZjCc7.js:13:46)\n    at mo (https://art.abluestar.com/assets/vendor-2hKZjCc7.js:13:1795)",
  "component": "Unknown",
  "trace": "https://vuejs.org/error-reference/#runtime-1",
  "url": "https://art.abluestar.com/admin",
  "artworkId": null,
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  "timestamp": "2025-09-08T19:22:28.002Z",
  "appVersion": "unknown"
}
```


## Users

These are the different types of users.

- Anonymous - Can view artworks, and submit new artworks
- Verified - Can edit fields, while logged in.
- Moderator - Can approve new artworks, or updates to the fields
- Admin - Can give moderator permissions to logged in users

Note: There is no "Reviewer" user. there is only a Moderator user.

If any user is currently marked as a "Reviewer", make a migration step to assign them to "Moderator", and remove the "Reviewer" type.

Do an audit and list any other user type.



## Migration system

Goal:

1) Export
I should be able to run `npm run database:export` in the root project directory and it will create an export of the current production database in the `_backup_database/database_YYYY-MMM-DD.sql`

2) Migrate
I should be able to run `npm run database:migration` in the root project directory and it will use "wrangler" to migrate the production database to the new version using the migrations created by `wrangler migrations create`. The migration files are stored in a `migration` folder either in the root project directory or the `src\workers\migration` folder.

3) Import
I should be able to run `npm run database:import file.sql` in the root project directory. The system will ask me if I am sure and tell me that this is a destructive process. Then it will. A) clear the old database, B) Import a new database `file.sql`.

Notes:

- This might involve changing directories to the `/src/workers/` directory first to take advantage of the existing `src\workers\wrangler.toml` file.
- Use `.env`, or `src\workers\wrangler.toml` to store the required settings.
- Ths migration system should use CloudFlare D1 build in migration system. https://developers.cloudflare.com/d1/reference/migrations/
- See the list of D1 commands https://developers.cloudflare.com/workers/wrangler/commands/#d1 Such as "wrangler migrations create", "migrations list", "migrations apply", and "export"
- It should use wrangler, it should not using any nodejs scripts, or powershell scripts, or bash scripts.


## Mass import

Add a flag to the mass import that allows for auto accepting the new artworks and logbook entries.

Mass-import script

The goal is to use the same system but different scripts for each public data source. Make the import system generic, but script specific to the public data source.

Review one option below, but suggest a few different options. Plan this feature out before.

The mass import script should alow for linking specific fields in the import data recored, with the corasponding filed in the artwork and tags fileds.

Linking the fields should use JSON path.

There should be a script file that you can load that allows for linking the JSON paths from the input record to the artwork recored.

I am open to suggestions on how to do this properly.

For example:

This is a recored in the Open Data Vancouver data set.

```json
[
  {
    "registryid": 27,
    "title_of_work": "Solo",
    "artistprojectstatement": "\"McHaffie says she means to show movement, but not flight. 'My perception of the world is that very little of it is stable,' she says.\" -Vancouver Sun, July 19,1986                                             The sculpture was installed as one of ten pieces in the City Shapes sculpture symposium in the City's centennial year.",
    "type": "Sculpture",
    "status": "In place",
    "sitename": "Devonian Harbour Park",
    "siteaddress": "Denman & Georgia Street",
    "primarymaterial": "Stainless steel, cedar",
    "url": "https://covapp.vancouver.ca/PublicArtRegistry/ArtworkDetail.aspx?ArtworkId=27",
    "photourl": {
      "exif_orientation": 1,
      "thumbnail": true,
      "filename": "LAW27-1.jpg",
      "width": 350,
      "format": "JPEG",
      "etag": "\"apIttAiZOiONsoTSEogiJg==\"",
      "mimetype": "image/jpeg",
      "id": "25a422b0cc36381e0c0ab681d38f602d",
      "last_synchronized": "2025-06-09T13:32:37.304150",
      "color_summary": [
        "rgba(77, 96, 90, 1.00)",
        "rgba(118, 120, 100, 1.00)",
        "rgba(172, 148, 118, 1.00)"
      ],
      "height": 256,
      "url": "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-art/files/25a422b0cc36381e0c0ab681d38f602d"
    },
    "ownership": "City of Vancouver",
    "neighbourhood": "Downtown",
    "locationonsite": "Lawn along Georgia Street",
    "geom": {
      "type": "Feature",
      "geometry": {
        "coordinates": [-123.133965, 49.293313],
        "type": "Point"
      },
      "properties": {}
    },
    "geo_local_area": "Downtown",
    "descriptionofwork": "An abstract sculpture of stainless steel with carved cedar planks that fan out in a spiral.",
    "artists": ["103"],
    "photocredits": "SITE Photography, 2016",
    "yearofinstallation": "1986",
    "geo_point_2d": {
      "lon": -123.133965,
      "lat": 49.293313
    }
  }
]  
```

The title in the open data recored is "title_of_work" and we want to link it to the artwork's title field.

`$.title_of_work = artwork.title`

Some fields we want to append strings and multiple fields from the open data to the artwork fileds.

```txt
"## Description of work\n": + $.descriptionofwork += artwork.description ; 
"## Artist Project Statement\n": + $.artistprojectstatement += artwork.description ; 
"Site Address: " + $.artistprojectstatement += artwork.description ;
```

Some fields should be linked to tags that are attached to the artwork.

```txt
$.type = artwork.tags("tag:artwork_type");
$.url = artwork.tags("tag:website");
$.yearofinstallation = artwork.tags("tag:start_date");
```



## Vancouver import

We are working on the mass import for the Vancouver Open data set. We are working with the production database. The production database can lose data as we are still in testing

The Vancouver import does import some of the fields but is not compleate.

This is the command that I am running `mass-import vancouver --input ./tasks/public-art.json --output vancouver-report.json --offset 3 --limit 1`

For example the title of the imported artwork is set to "Unknown Artwork Title" instead of the expected name "Solo".

For example: artwork.value.title = $.title_of_work

The description should summerize all of the other fields in the import file recored.

For example:
artwork.description = "## Description Of Work\n" + $.descriptionofwork + "\n\n";
artwork.description += "## Artist statment\n" + $.artistprojectstatement + "\n\n";
artwork.description += "registryid:\n" + $.registryid + "\n";
artwork.description += "status:\n" + $.status + "\n";
artwork.description += "sitename:\n" + $.sitename + "\n";
artwork.description += "siteaddress:\n" + $.siteaddress + "\n";
artwork.description += "primarymaterial:\n" + $.primarymaterial + "\n";
artwork.description += "locationonsite:\n" + $.locationonsite + "\n";
artwork.description += "artists:\n" + $.artists + "\n";
artwork.description += "yearofinstallation:\n" + $.yearofinstallation + "\n";




```json
{
    "registryid": 27,
    "title_of_work": "Solo",
    "artistprojectstatement": "\"McHaffie says she means to show movement, but not flight. 'My perception of the world is that very little of it is stable,' she says.\" -Vancouver Sun, July 19,1986                                             The sculpture was installed as one of ten pieces in the City Shapes sculpture symposium in the City's centennial year.",
    "type": "Sculpture",
    "status": "In place",
    "sitename": "Devonian Harbour Park",
    "siteaddress": "Denman & Georgia Street",
    "primarymaterial": "Stainless steel, cedar",
    "url": "https://covapp.vancouver.ca/PublicArtRegistry/ArtworkDetail.aspx?ArtworkId=27",
    "photourl": {
      "exif_orientation": 1,
      "thumbnail": true,
      "filename": "LAW27-1.jpg",
      "width": 350,
      "format": "JPEG",
      "etag": "\"apIttAiZOiONsoTSEogiJg==\"",
      "mimetype": "image/jpeg",
      "id": "25a422b0cc36381e0c0ab681d38f602d",
      "last_synchronized": "2025-06-09T13:32:37.304150",
      "color_summary": [
        "rgba(77, 96, 90, 1.00)",
        "rgba(118, 120, 100, 1.00)",
        "rgba(172, 148, 118, 1.00)"
      ],
      "height": 256,
      "url": "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-art/files/25a422b0cc36381e0c0ab681d38f602d"
    },
    "ownership": "City of Vancouver",
    "neighbourhood": "Downtown",
    "locationonsite": "Lawn along Georgia Street",
    "geom": {
      "type": "Feature",
      "geometry": {
        "coordinates": [-123.133965, 49.293313],
        "type": "Point"
      },
      "properties": {}
    },
    "geo_local_area": "Downtown",
    "descriptionofwork": "An abstract sculpture of stainless steel with carved cedar planks that fan out in a spiral.",
    "artists": ["103"],
    "photocredits": "SITE Photography, 2016",
    "yearofinstallation": "1986",
    "geo_point_2d": {
      "lon": -123.133965,
      "lat": 49.293313
    }
  }
```





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

----


## Vancouver Mass Import

The Mass import for vancouver, imports the text correctly. But the import is missing the image.

The image needs to be downloaded from the Vancouver open data recored and submitted as an upload.

The photo can be found at the `$.photourl.url`

Example: `[{photourl: {"url": "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-art/files/25a422b0cc36381e0c0ab681d38f602d"}}]`

The mass import should use a special endpoint that suits its needs. replace src\workers\routes\mass-import-photos.ts with a special endpoint specifically for mass import that handles both the images, and the creation of the artwork and the logbooks.


----

While I am testing, I am reseting the production database between tests of the mass-import. using `npm run database:reset:prod`. This script should reset the production database and remove all the data but it shouldn't remove the tables or the schema. But I am finding that I need to migrate the database after each database reset. 

Review the `database:reset:prod` script with the migration steps in mind. specifically `0009_add_consent_version_tracking.sql`


----
  
Mass import UUID error

The mass import seems to be generating its own IDs for the artwork, and logbook tables (maybe other tables) instead of using a UUID. This means that the artwork pages urls are `https://art.abluestar.com/artwork/artwork-1757533783575-sz2ucn1` instead of the expected `https://art.abluestar.com/artwork/79e3ab63-2d75-401e-98f8-9c3aa6d001f7`. Because the frontend is expecting UUIDs instead of keywords for the id, the front end is showing the following error "Artwork Not Found - Invalid artwork ID format. Please check the URL and try again."



### Mass import vancouver artists

The mass import is setting the creator of the artwork as a UUID of the user that is submitting the artwork. `00000000-0000-0000-0000-000000000002`... When it should be using the data sets artist ID.

But better then using the Artist ID would be to use the Artist's name. 

The artist ID can be looked up in this file `tasks\public-art-artists.json` or on this page https://opendata.vancouver.ca/explore/dataset/public-art-artists/information/

Update the mass import script for vancouver to look up the artist name from the artist ID and use the name instead of the ID for the artwork artist field.



## Vancouver mass import tags

In the Vancouver mass import, the fields in the dataset should become tags of the artwork's logbook entry. For example: Fields in the data like "Site Address", etc... should be tags in the logbook entry for the artwork.



## Mass import duplications

When mass importing new artworks, the artwork might already exist in the database. We don't want to add two of the same artwork. We need a way of determin if this artwork already exists. If it does already exist. We want to make a note of it and add it to a report, then skip importing it.

The check should happen in the mass-import endpoint. Where it rejects (with a good error message), artworks that are too simlare.

Use a scoring system to determin if two artworks are the same, then have a threashold that if an artwork is above that threashold it marks it as duplicate.

For example:
If the title is the same +0.2,
If the artist is the same +0.2,
If the location is the same +0.3
For each tag that is the same +0.05
etc...

Then set the threashold to 0.7

The report should list the existing artwork url, a confadence score that its the same and the artwork that was attempted to be imported.



## Artist page

  Executive Summary

  Create dedicated artist profile pages that showcase artist information and their
  artworks, enhancing discoverability and providing comprehensive artist
  documentation within the Cultural Archiver platform.

Create a artist page type
The goal of this page is to tell people about the artist and list their artworks. A prime goal is to show other works by this artist.

An artist can have many artworks, An artwork can have many artists, An artist can have many tags.

Compoents on the artist page

- Artist name - Text field
- Description - A block of text formated as Markdown (biography, Artist statment, CV)
- Artist tags - Artist website, Birth year, etc... Same as the artwork tags
- List of artworks - A search results cards of all the artworks that this author is in the artwork's artist field.

Notes:

- The artist page should be editable by logged in users.
- Any changes to the artist page need a moderator approval.
- Don't use the existing creators tables or systems.
- The URL for the artist page is /artist/{UUID}

