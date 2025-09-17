# Known things to do

## MVP

- [x] Variable fields for artwork
- [x] Optimized submit new artwork
- [x] Mass import

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
  - The problem is that this name "Seekart" is used by a AI Art generator "
  Seekart | Create Unique AI-Generated Digital Artwork" https://seek.art/, and https://www.seaart.ai/... so the domain is plutted

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

- `support@art.abluestar.com` currently errors out when sending an email to this address. This address should forward to my personal address.
- Check to make sure that the only email address that is public is `support@art.abluestar.com`


- In artwork edit mode, make the description text box 3 times as tall.
- Create a script to remove the deployed recoreds on cloudflare for the frontend and backend workers. These are piling up for no reason.

- Add an artwork for NULL island https://en.wikipedia.org/wiki/Null_Island 

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

## Mass Import merge tags

- Update the "source_url" value to be clickable as a link. This means it shouldn't search that tag, that link should be clickable.
  - Tags that have urls in them, should be clickable


----

The problem
There are populated areas where there are 1000s of map pointers in a small area. The map slows down and doesn't load all of the map points in this area. Then the map slows down as they move around the map.

We need a solution for large amounts of map points. What are some recomentations?

We should cache the map points in the browser so that these points can load quicker on reload of the map. We need an ability to cache bust.
- Manually - Add new button to the Map options. "Clear map Cache"
- Time based - If the point is older then 30 days remove it from the Cache.

