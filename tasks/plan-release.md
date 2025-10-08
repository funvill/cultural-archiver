# plan-release

## Bugs

- [x] Artwork index is not showing images
- [ ] The Artwork index page shows duplicate of artworks based on how many photos they have. See https://publicartregistry.com/artworks?page=37 for example.
- [x] None of the artists have a bio even though the imports had bios assoicated with them.
- [ ] The map filters are not working as expected and are missing the "Show removed artworks"
- [ ] Add filter for artworks with the following tags Physical Properties (1), Condition:removed
- [ ] Allow for 5 or more photos to be uploaded at a time. or give a good warning if they have uploaded too many

- make the hitboxes for the markers on the map larger. People are struggling with tapping the map markers
- The welcome screens needs a way of closing it without going to the help screen. Or the help screen needs. Learn more about this feature button.
- scrolling on the artwork detail page. When you hit the location map it takes your scrolling over a cursor.
- allow people to use the camera icon to take photos as well as upload photos.
- The consent button on the artwork submission page is hard to see. The questionnaires on that page. Also need to be clicklets rather than drop down pocket buttons. And because the page gets covered up by the bottom bar, you can't really see the submit button
- [ ] The admin dashbord audit logs tab, doesn't need to recored the 'view_audit_logs' action.

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
- [ ] 8.0 Create social media schedules and schedule 14 days of posts.
  - [ ] Instagram @publicartregistry
  - [ ] Bluesky https://bsky.app/profile/publicartregistry.com
- [ ] 9.0 Website Usage Analytics

- Possable Funding
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
