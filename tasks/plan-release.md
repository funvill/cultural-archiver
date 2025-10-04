# plan-release

## Bugs

- [x] Setup email for magic link
- [x] Artist pages, on import.
- [ ] The location map button doesn't work like expected. The map icon for the user is missing.
  - Click to move the map to your current location. The current location is always shown on the map with the direction cone.
- [ ] The map filters are not working as expected and are missing the "Show removed artworks"
- [x] Links in the pages are not underlined.

## Release

- [x] 1.0 Update the welcome popup
  - [x] 1.1 Add a link that repops up this welcome page. (?)
- [ ] 2.0 Import all the artworks for each city
  - [ ] 2.1 Cache the images on import
  - [ ] 2.1 Vancouver Public Data
    - [ ] Consider converting this data to OSM first before importing.
- [x] 3.0 Add Pages system
  - [X] 3.1 Add tutorial pages
  - [x] 3.2 Add about page
  - [x] 3.3 Why I am doing this
- [ ] 4.0 Update help page
- [ ] 5.0 Remove the "Devlopment banner"
- [X] 6.0 Logo?
- [ ] HTTP Error pages
  - [ ] HTTP 404 error page

----

Add `status` tag to the tag schema for `Artwork Classification` in `src\shared\tag-schema.ts`

Rename `height` to `dimensions` in `src\shared\tag-schema.ts` and change it to a string instead of a number

----

The Vancouver open data importer src\lib\mass-import-system\importers\vancouver-public-art.ts

There are tags that are imported from the Vancouver Open data that need to be renamed when importing.

Vancouver Open data | import as
primarymaterial => material
installation_date: => start_date


----
Burnabyartgallery

src\lib\data-collection\burnabyartgallery

The photo field needs a full url, not a realtive url.

Add a fixed field "city" with the value of "burnaby"

medium => material
date => start_date