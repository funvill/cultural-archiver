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

## Map

- [x] The artwork search radius should be the visable screen based on the zoom level and the screen size.

- [x] The icon used as the marker on the map should be based off of the tag "Artwork Type". If the artwork does not have a "Artwork Type", then use a default. Each "Artwork Type" should have a different icon.

- [x] Zooming out should cluster artwork markers on the map.


## Admin page

The admin page is a super user that can give moderators permissions to other users.

- List existing users that have email address.
- The ability to give moderators permissions to users with email address.

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