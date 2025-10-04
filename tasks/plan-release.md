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
  - [ ] 2.2 Vancouver Public Data
  - [ ] 2.3 Burnaby Art Gallery
  - [ ] 2.4 New West
  - [ ] 2.5 Richmond  
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

- Add a fixed field "city" with the value of "Vancouver"
- Add a fixed field "country" with the value of "Canada"
- Add a fixed field "province" with the value of "Britsh Columbia"

----

Burnabyartgallery

src\lib\data-collection\burnabyartgallery

The photo field needs a full url, not a realtive url.

medium => material
date => start_date

- Add a fixed field "city" with the value of "burnaby"
- Add a fixed field "country" with the value of "Canada"
- Add a fixed field "province" with the value of "Britsh Columbia"

----

Newwest
src\lib\data-collection\newwest

year => start_date

- Add a fixed field "city" with the value of "New West"
- Add a fixed field "country" with the value of "Canada"
- Add a fixed field "province" with the value of "Britsh Columbia"

----
richmond
src\lib\data-collection\richmond

- artistNames, and artistIds needs to be comma seperated instead of a array.

- Add a fixed field "city" with the value of "Richmond"
- Add a fixed field "country" with the value of "Canada"
- Add a fixed field "province" with the value of "Britsh Columbia"
