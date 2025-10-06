# plan-release

## Bugs

- [x] Setup email for magic link
- [x] Artist pages, on import.
- [x] Links in the pages are not underlined.
- [x] The action buttons on the artwork details page, if a user clicks one of these buttons when they are not logged in show the login dialog.
- [x] When a user is not logged in the "report an issue", and "report missing" dialogs. The cancel button doesn't close the dialogs. If the user updated the text, then show a "are you sure" prompt when trying to close. The user should be able to click outside the dialog to close the window as well.
- [X] When the user clicks the Map button "location" icon. The map should show their current location zoomed 15. A person icon should be shown at the users location. This icon should look different then the circle icons used for artworks, it should be bigger and look like a person. There should be a view cone that shows the users orentation on the map (what they are looking at).
- [X] The map location buton should be a one time action, not a toggle. The map should focuse on the users location once, then allow the user to pan and zoom around the map. The users location icons should update indpendenly of the map viewing box. the persion icon is not showing on the map. I want an icon for the users current location with a view cone. It should be ontop of all other icons and it should look vistually distinct from the other icons.
- [X] Map icons. The "visted" artworks on the map should appear like a checkbox or flag in a gray circle. This helps users know what artworks they have already seen. The "stared" artworks should appear as "star" icon. If an an artwork has both "star", and "visted". The visted icon is shown.
- [x] When trying to send feedback. I get an error saying feedback cannot be sent. Can't send feedback from the feedback dialogue.
- [x] Add the website to Google. Start a site map. Get SEO going today so it shows up in Google later on.
- [x] Icons in the bottom bar need to be much larger.
- [ ] Artwork index is not showing images
- [ ] None of the artists have a bio even though the imports had bios assoicated with them. 

- [ ] The map filters are not working as expected and are missing the "Show removed artworks"

- [ ] Add filter for artworks with the following tags Physical Properties (1), Condition:removed


- make the hitboxes for the markers on the map larger. People are struggling with tapping the map markers
- The welcome screen needs a way of closing it without going to the help screen. Or the help screen needs. Learn more about this feature button.
- scrolling on the artwork detail page. When you hit the location map it takes your scrolling over a cursor.
- allow people to use the camera icon to take photos as well as upload photos.
- The consent button on the artwork submission page is hard to see. The questionnaires on that page. Also need to be clicklets rather than drop down pocket buttons. And because the page gets covered up by the bottom bar, you can't really see the submit button
- this artist profile page doesn't load https://publicartregistry.com/artist/49d789bf-e773-4e33-9f02-01883854a369 found from this artwork https://publicartregistry.com/artwork/f5d8d320-313c-43f9-82bc-3d5a9de3c088



## Release

- [x] 1.0 Update the welcome popup
  - [x] 1.1 Add a link that repops up this welcome page. (?)
- [ ] 2.0 Import all the artworks for each city
  - [ ] 2.1 Cache the images on import
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
- [x] 5.0 Remove the "Devlopment banner"
- [X] 6.0 Logo?
- [x] HTTP Error pages
  - [x] HTTP 404 error page
- [ ] 0.0 Generate thumbnails and different size images of artworks as needed

1) 
When a user submits a photo, we want to store the orginal of the photo for reference. Then create smaller versions of the photo for use within the website. This should signfiganty reduce the bandwidth requirments. These different size images should be stored in the R2 object storage with the originals.

- Create a thumbnail for the artwork card preview (map, search, artwork index, etc...)
- Create a reduce size image for the artwork details page

2) There are 1000+ artworks on the website right now. smaller versions of these images need to be created and the artworks need to be updated to use these smaller versions. Create a nodejs script to help with this migration.







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
