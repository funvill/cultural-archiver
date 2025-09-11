# Known things to do

## MVP

- [x] Variable fields for artwork
- [x] Optimized submit new artwork
- Mass import

## Choose a name

- Use https://domains.cloudflare.com/ to check if the domain is avlaible
- This is good for brain storming https://namelix.com/app/

### Keywords

**Project Description:** A collaborative platform where people can discover, photograph, and collect public artworks. Users contribute photos, descriptions, and locations of cultural works under Creative Commons licensing, building an open, community-driven archive. The project blends elements of art curation, exploration, and game-like discovery, encouraging people to seek, share, and connect through cultural creativity.

- **Core Themes:** Art, Culture, Public Art, Artwork, Creative Commons, Curation, Art Collector
- **Actions / Interactivity:** Seek, Find, Collect, Discover, Explore, Photograph, Archive
- **Playful / Experiential:** Game, Quest, Hunt
- **Other:** Open Data, Crowdsourced, giving back

**The perfect domains (Not avalaible)**

- iArchivist
- ArtSeeker
- ArtHunt
- ArtQuest
- Seek.art
- findart.app
- artarchive.com

- public.art
- found.art
- collect.art

### Avalaible

- [1] seekart.app + seekartapp.com

- seekerart.app + seekarterapp.com
- artgame.app + artgameapp.com
- SeekCommon.com
- ArtMarked.com
- ArtWorkHunt.com
- CommonsQuest.com
- FoundCommons.com
- PublicPieces.com
- ExplorePublic.com
- PubliclyBuilt.com
- WhatIsThisArt.com
- komunarto.com - Esperanto for Collector
- arscollectiva.com - Latin for Art collector
- arscollect.io

**No .Com**

- [2] CulturalCommon.org + culturalcommon.com  (Note: the missing "S" at the end)

- OpenArt.org (premimum aka expensive)
- huntart.app
- particip.art → participate + .art
- ArtFind.net, ArtFinds.net
- ArtSpotter.org
- CultureCollect.org
- artcollects.org
- artcollect.app
- iArchivist.org

## Find partners

Find people that would be willing to partner with me on this project. Be specific and say that you are NOT looking for monetary support but are looking for in-kind support. Advertisement, recommendations, etc.

- Burrard Arts Foundation, Centre for Digital Media students. They spondered a simlare project in the past. https://intergalactic.com/content/muse-public-art-app?utm_source=chatgpt.com
- Canada Council - They prefer events over resources. The event could be a mass hunt for new art.

## General

- ????? - Remove the creators system and replace it with a comma seperated list of keywords to search for. This means that there won't be a artist details page.
- `support@art.abluestar.com` currently errors out when sending an email to this address. This address should forward to my personal address.
- Check to make sure that the only email address that is public is `support@art.abluestar.com`

- [x] Add tag "city", "province/state", and "country" to the "Physical Properties" tag catagory.
- In artwork edit mode, make the description text box 3 times as tall.


----

- Need to spend some more time on the mobile and experience. I found it difficult to change and edit the tags.

----

## Prior Art research

- **School Of Cities** - Vancouver public Art
  - https://github.com/schoolofcities/vancouver-public-art
  - The data is just Vancouver public art database
  - I like the way they put a box on the left hand side when you click on an icon instead of just going direct to the artwork page
  - Contact them and say hello, maybe we could do something together.
  - I like how the markers on the map are small and stay the same reliative size as the map scales up and down.
  - The markers are colored making it easy at a glance to see what each marker repersents.

## Marketing and gameafication

- Speak more about the gamification of the system. We want to send people notifications when a artwork that they contributed to or in artwork that they added gets 1,000 views, 10,000 views, etc. Could make them feel really proud that they've added to this social good.

- Look into how I naturalist sends emails out to new members. Follow that list. How are they doing? Engagement with people. Copy their list. Marketing emails

- Look into the calls to actions that google maps does for "good" reviews and populare reviews. Follow their lead

- Use small fixed size icons for the markers for the map. But have some ability to click though overlapping markers.

- This artwork https://covapp.vancouver.ca/PublicArtRegistry/ArtworkDetail.aspx?FromArtworkSearch=False&ArtworkId=358 from this list https://covapp.vancouver.ca/PublicArtRegistry/ is not in the Vancouver open data public artwork list. Its in the data set but not on the map. something has gone wrong.

## Sign in

- The email should send out a passcode instead of a link. Don't train people to click links in emails. Maybe a magic phrase instead of a magic link.

## Artwork Details page

## Map page

- In the map options, allow for filtering the map markers by the artwork type.

## Admin page

The admin page is a super user that can give moderators permissions to other users.

## Review Queue / Moderate page

- Move the tabs "New Submissions", and "Artwork Edits" to below the Moderate stats. (Simlare to the admin page)
- The "pending review" stat should also include the "Artwork Edits" pending.


## Add artwork

- After a user uploads a photo, they are shown the search results page of artwork nearby. If the user clicks one of the artwork cards from the search results, they should be brought to a logbook submission form. On this page they can submit a new photo and any other information that they want to. This page is identical to the new artwork submission details page but instead of submitting new artwork it submits a logbook entry, and a artwork details update.

- [ ] After uploading artwork, If no artworks are detected nearby the search results. Go straight to add art details page. No reason to show a page that doesn't have any actions.

----

npx tsx src/cli/index.ts vancouver --limit 1

----

## Tags Field vs Tags Table

Current Usage
Artwork.tags field: Contains rich JSON data with structured metadata from the mass import system and user submissions. In production, all 154 artwork records have structured tag data stored in this field.

Tags table: Currently empty in production (0 records). The functions to query this table exist but are never called in the actual application code.

The Purpose of Each
Artwork.tags field (JSON):

Primary storage for artwork metadata using the structured tag schema
Contains rich data from mass imports (Vancouver Open Data) with extensive metadata like registry IDs, materials, descriptions, etc.
Used for JSON queries with indexes like json_extract(tags, '$.tags.tourism')
Supports the structured tag schema with versioning and timestamps
This is the active, production system
Tags table (relational):

Legacy/unused key-value pair storage system
Was designed for storing individual tag entries as separate database rows
Has functions like getTagsForArtwork() and insertTags() but they're never called
This is dead code that can be safely removed
Recommendation: Remove the Tags Table
Yes, we can and should remove the tags table for these reasons:

Not used in production - 0 records, no active code paths
Redundant - The artwork.tags JSON field serves all current needs
Better performance - JSON queries with indexes are more efficient than joins
Simpler architecture - One source of truth for tag data
Test coverage confirms - All 556 tests pass without using the tags table
Migration Plan
I'll create a migration to:

Remove the tags table
Remove unused functions from database service
Remove unused TypeScript types
Clean up any references in documentation

----

## Index page

Create two index pages, these index pages show art and artists as cards with pagination. These cards can be clicked to see the details page.

- /artwork - Should be an index page of all artworks
- /artist - Should be an index page of all artists

These are like search results pages but show all of each item sorted by last updated.

There should be 30 items on these index pages, with the ability to go to the next page

Both of these pages use cards and show 30 cards per page. Use ppagination controls at the top and bottom

Have a search bar at the top that leads to the search page

----

## Database clean up

What is this field used for? Can it be removed or moved?

----

artwork.consent_version
In table artwork the consent_version field doesn't need to be part of the artwork table. Instead create a new table (consent) to recored all the consent for content from users.

The table strucutre could look like thi

- id - TEXT PRIMARY KEY,
- created_at - TEXT NOT NULL DEFAULT (datetime('now')),
- user_id - User UUID
- consent_version - The version that the user accepted
- content_type - Artwork, etc...
- content_id - The ID of the content where consent was given.

The goal is clean up the artwork table. Any content that is provided by the user needs consent to make it avalaible to others. This table is also flexable for the future user commited data.

Do the same thing for artwork, logbook tables.

----

artwork.type_id
In the artwork table, the type_id does not need to be part of this table.
Instead use the tag:artwork_type for the artwork type.
Then we can drop the artwork_types table.

The tag:artwork_type should default to "unknow"

The advantage of using the tag:artwork_type is that it can be updated by the users from the normal tag editing.

----


## Mass Import merge tags

When running the mass-import and a duplicate is found. Check the tags, add any new tags to the existing recored, don't overwrite the existing tags.

- [x] In src\lib\mass-import\osm-report-1757618334783.json all of the "title" in the "duplicate_records" are "Unknown" instead of the properties.name from the OSM import.
