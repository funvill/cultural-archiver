# Know things to do

2. Variables files
3. Mass import

## Add artwork

---

- Update this workflow
  1) Customer uploads a photo first
  2) The system uses the photo's GPS, and the browsers GPS, and if all else fails, the IP address IP Address to find a list of artworks that are near by.
  3) The user can either
    3A) "Add new artwork" - The user reviews the close by artworks and determins that this is a new artwork.
    3B) The user clicks one of the existing artworks to add the logbook entry to the existing artwork.
  4) After they fill in the addtional information. They are asked for consent to use this inforamtion then its submitted to the website.

## Artwork Details page

## Map page

- [ ] The map page should remember where what your last location was and the zoom level. So if you refresh the page again, it will return to the old location. Use local storage for this.

## Admin page

The admin page is a super user that can give moderators permissions to other users.

## Review Queue / Moderate page

- Move the tabs "New Submissions", and "Artwork Edits" to below the Moderate stats. (Simlare to the admin page)
- The "pending review" stat should also include the "Artwork Edits" pending.

## App Bar

- The search should be centered on all screen sizes. and enlarged to be a single icon.
- Help, Admin, and Moderator should automaticly be put in to the menu. The menu should always be shown.

## Choose a name

Use https://domains.cloudflare.com/ to find the domain.

### Avalaible

- artfind.net

## Mass Import


Update tasks\prd-mass-import-system.md to include information about tags from this PRD tasks\prd-artwork-variable-tagging-system.md

Use a tag for the "data source attribution".

Add functionality to set tags for mass imported artworks.

Allow for dry runs of importing, so i can see what the import looks like before actually importing the data set.

Allow for Automatic approval. OR mass approval of these imported artworks and logbook entries.

This PRD has two parts. Creating the tools that all the improt scripts will use. Then creating the import script for tasks\public-art.json vancouver-public-art as an example.

Data sets

- City of Vancouver Public Art: Contains artist info and geolocated artwork data, updated weekly. It’s available in GIS-friendly formats like CSV or GeoJSON https://opendata.vancouver.ca/explore/dataset/public-art/
- Public Art – Artists Dataset: https://opendata.vancouver.ca/explore/dataset/public-art-artists/information/

## Find partners

Find people that would be willing to partner with me on this project. Be specific and say that you are NOT looking for monetary support but are looking for in-kind support. Advertisement, recommendations, etc.

- Burrard Arts Foundation, Centre for Digital Media students. They spondered a simlare project in the past. https://intergalactic.com/content/muse-public-art-app?utm_source=chatgpt.com
- Canada Council - They prefer events over resources. The event could be a mass hunt for new art.

## Github copilot

Optimize the adgent session. See if there is a way to have `vitest` pre installed.

`I see there's an issue with vitest not being found. Let me check if dependencies are installed and try to fix this:`

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
