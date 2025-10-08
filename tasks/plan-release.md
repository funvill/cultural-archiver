# plan-release

## Bugs

- [x] Setup email for magic link
- [x] Artist pages, on import.
- [x] Links in the pages are not underlined.
- [x] The action buttons on the artwork details page, if a user clicks one of these buttons when they are not logged in show the login dialog.
- [x] When a user is not logged in the "report an issue", and "report missing" dialogs. The cancel button doesn't close the dialogs. If the user updated the text, then show a "are you sure" prompt when trying to close. The user should be able to click outside the dialog to close the window as well.
- [x] When the user clicks the Map button "location" icon. The map should show their current location zoomed 15. A person icon should be shown at the users location. This icon should look different then the circle icons used for artworks, it should be bigger and look like a person. There should be a view cone that shows the users orentation on the map (what they are looking at).
- [x] The map location buton should be a one time action, not a toggle. The map should focuse on the users location once, then allow the user to pan and zoom around the map. The users location icons should update indpendenly of the map viewing box. the persion icon is not showing on the map. I want an icon for the users current location with a view cone. It should be ontop of all other icons and it should look vistually distinct from the other icons.
- [x] Map icons. The "visted" artworks on the map should appear like a checkbox or flag in a gray circle. This helps users know what artworks they have already seen. The "stared" artworks should appear as "star" icon. If an an artwork has both "star", and "visted". The visted icon is shown.
- [x] When trying to send feedback. I get an error saying feedback cannot be sent. Can't send feedback from the feedback dialogue.
- [x] Add the website to Google. Start a site map. Get SEO going today so it shows up in Google later on.
- [x] Icons in the bottom bar need to be much larger.
- [x] Show a difference between visted and submitted artworks on the map
- [x] Update `src\lib\mass-import-system\docs\formats.md` with example formats for both the `artwork.geojson` used by `src\lib\mass-import-system\importers\osm-artwork.ts`, and the `artists.json` used by `src\lib\mass-import-system\importers\artist-json.ts` This file should contain documnetation about how these files are formated, what are the expected fields, etc... This document will be used when generating new data-collection scripts that generate these files that will be used by the mass-import-system.
- [ ] Artwork index is not showing images
- [ ] None of the artists have a bio even though the imports had bios assoicated with them.
- [ ] The map filters are not working as expected and are missing the "Show removed artworks"
- [ ] Add filter for artworks with the following tags Physical Properties (1), Condition:removed
- [ ] Allow for 5 or more photos to be uploaded at a time. or give a good warning if they have uploaded too many

- make the hitboxes for the markers on the map larger. People are struggling with tapping the map markers
- The welcome screen needs a way of closing it without going to the help screen. Or the help screen needs. Learn more about this feature button.
- scrolling on the artwork detail page. When you hit the location map it takes your scrolling over a cursor.
- allow people to use the camera icon to take photos as well as upload photos.
- The consent button on the artwork submission page is hard to see. The questionnaires on that page. Also need to be clicklets rather than drop down pocket buttons. And because the page gets covered up by the bottom bar, you can't really see the submit button
- this artist profile page doesn't load https://publicartregistry.com/artist/49d789bf-e773-4e33-9f02-01883854a369 found from this artwork https://publicartregistry.com/artwork/f5d8d320-313c-43f9-82bc-3d5a9de3c088



Create a plan for this issue `tasks\plan-fix-unknown-artist-milestone-2.md`

This artwork https://publicartregistry.com/artwork/712120c9-1d18-4f77-a072-d3f4984a281c Has a artist name of "Unknown Artist".

The artwork has a tag "artist_ids" that contains the list of artists associated with this artwork. "90,144,145" comma seperated.

The ids in the artist_id tag of the artwork, reference the artist tag of artist_id on the artist details page https://publicartregistry.com/artist/25e38c05-2eef-42fc-a080-37cfda7969c1 (artist_id: 145)

Create a plan for updating the production database artwork's artist name by finding the artist with the assoicated artist_id, the linking the artwork and the artist together

This is a backup of the current state of the production database `_backup_database/database_production_2025-10-08-03-57-56.sql`

Create a migration file that adds the artwork to artist association into the `artwork_artists` table. 

Don't use complex SQL statments. Instead this migration should include `INSERT OR IGNORE INTO` or UPDATE statments for  artwork_artists table. 

See previouse notes on a simlare issue `tasks/done/plan-fix-unknown-artist.md`



## Release

- [x] 1.0 Update the welcome popup
  - [x] 1.1 Add a link that repops up this welcome page. (?)
- [ ] 2.0 Import all the artworks for each city
  - [x] 2.2 Vancouver Public Data
  - [x] 2.3 OSM
  - [ ] 2.4 Burnaby Art Gallery
  - [ ] 2.5 New West
  - [ ] 2.6 Richmond  
- [x] 3.0 Add Pages system
  - [X] 3.1 Add tutorial pages
  - [x] 3.2 Add about page
  - [x] 3.3 Why I am doing this
- [ ] 4.0 Update help page
- [x] 5.0 Remove the "Devlopment Banner"
- [X] 6.0 Logo?
- [x] HTTP Error pages
  - [x] HTTP 404 error page
- [x] 7.0 Generate thumbnails and different size images of artworks as needed
- [x] 8.0 Create social media accounts
  - [x] Instagram @publicartregistry
  - [x] Bluesky https://bsky.app/profile/publicartregistry.com
  - [x] Facebook https://www.facebook.com/profile.php?id=61581784564913
  - [x] Twitter @PubArtRegistry
- [ ] 9.0 Media call outs
  - [x] https://stickvancouver.substack.com/
  - [ ] CBC
  - [ ] Vancouver is Awesome
  - [ ] https://www.createastir.ca
  - [ ] https://www.destinationvancouver.com/
  - [ ] https://culturecrawl.ca/
  - [ ] https://secretvancouver.co/culture/
  - [ ] https://miss604.com/

- Funding
  - https://www.vancouverfoundation.ca/


----

Burnabyartgallery

src\lib\data-collection\burnabyartgallery

The photo field needs a full url, not a realtive url.
The photo field ends with a `?width=280` remove the width parameter from the url. Hopfully this will give us the full size image. for example: https://collections.burnabyartgallery.ca/media/hpo/_Data/_Art_Gallery/_Unrestricted/2014/NA/NA_2014_SFU_Arc2.jpg?width=280 becomes https://collections.burnabyartgallery.ca/media/hpo/_Data/_Art_Gallery/_Unrestricted/2014/NA/NA_2014_SFU_Arc2.jpg

medium => material
date => start_date

- Add a fixed field "city" with the value of "burnaby"
- Add a fixed field "country" with the value of "Canada"
- Add a fixed field "province" with the value of "Britsh Columbia"


The artist for https://collections.burnabyartgallery.ca/link/publicart46 is `Jacques Huet`. The artist detail page is https://collections.burnabyartgallery.ca/link/artists1272 

This artwork https://collections.burnabyartgallery.ca/link/publicart144 has a keywords list. "public art, Burnaby, permanent collection, sculpture, civic art, animal, horse, farm", but only "public art" is in the output.

The artist name has "," in them. this will cause my system to think of these as two people, when in fact they are a single person. Example: https://collections.burnabyartgallery.ca/link/publicart144 has a artist name of "Fafard, Joe", with a ",". I would like this to be stored in the artist table and the artwork table as "Joe Fafard"

----

Newwest
src\lib\data-collection\newwest

year => start_date

- Add a fixed field "city" with the value of "New West"
- Add a fixed field "country" with the value of "Canada"
- Add a fixed field "province" with the value of "Britsh Columbia"

----
Richmond
src\lib\data-collection\richmond

- artistNames, and artistIds needs to be comma seperated instead of a array.

- Add a fixed field "city" with the value of "Richmond"
- Add a fixed field "country" with the value of "Canada"
- Add a fixed field "province" with the value of "Britsh Columbia"
