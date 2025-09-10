# Know things to do

## MVP

- Optimized submit new artwork
- Mass import

## General

- ????? - Remove the creators system and replace it with a comma seperated list of keywords to search for. This means that there won't be a artist details page.

- Move all the test files out of the base source folders into test folders
- The github copilot issue started PR. There is an error that `vitest` is not installed. `I see there's an issue with vitest not being found. Let me check if dependencies are installed and try to fix this:`

- `support@art.abluestar.com` currently errors out when sending an email to this address. This address should forward to my personal address.
- Check to make sure that the only email address that is public is `support@art.abluestar.com`.

- Use small fixed size icons for the markers for the map. But have some ability to click though overlapping markers.

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


----

npx tsx src/cli/index.ts vancouver --limit 1

----

Analysis: Tags Field vs Tags Table
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
