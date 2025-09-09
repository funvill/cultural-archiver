# Changes over time

These are small changes that I did inline.

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