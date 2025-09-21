# Known things to do

## Find partners

Find people that would be willing to partner with me on this project. Be specific and say that you are NOT looking for monetary support but are looking for in-kind support. Advertisement, recommendations, etc.

- Burrard Arts Foundation, Centre for Digital Media students. They spondered a simlare project in the past. https://intergalactic.com/content/muse-public-art-app?utm_source=chatgpt.com
- Canada Council - They prefer events over resources. The event could be a mass hunt for new art.

- https://www.art-bc.com/

### Art walk / festivals

These are groups doing "Art walks" or festvials. They might be good groups to partner with. Give them the tools that they need then they use our service.

- https://vancouverartwalk.com/

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

- https://artmap.ca using public data for artworks.

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

The "Nearby Artworks" results in the FastAdd Artwork. The thumbnails for the artworks are not showing. For example this artwork https://art.abluestar.com/artwork/969b3394-e3a0-4dbb-8d62-87a42b382b1e?action=add-logbook&from=fast-upload as a photo but it the photo isn't showing up on the "Nearby Artworks" results.

----

When clicking the the "Add" button in the appshell for the 2nd time. it should overwrite the existing image with this new image. As if you are starting the whole process over again.

If the customer wanted to select multiple images they would have in the inital "add" event


----

We are going to update the user profile page

Add a username to the user table. The users can change their username on the user settings page. The username must be unique across the whole system.


Badges
Users can earn badges by doing tasks for the system. A user can have the same badge multiple times. 



## Top row
- Total points card. Show zero right now 
- Cards for: Total submitted Artworks, Approved Artworks, Approved edits... Do not show rejected count

## Second row
Badges
Show a list of badges that this user has been awarded.

## Next row
Submissions
Show the submission cards

----

Add logbook submission

Users need the abiltiy to indicate that they have gone and seen an artwork. This is done by taking a photo of the artwork and adding it to the system as a logbook entry. While adding the photo they can update other information about the artwork to help with the documentation. The users will be rewarded with points each time they visit an artwork.

The users start the logbook submission by clicking the "Add" button in the app bar. This is the same way that users add new artworks.

The "Nearby Artwork" search shows existing artworks that this photo might belong to. This gives the user the ability to select one of these artworks to add their report to.

Update the "Nearby Artwork" cards to have a "Add Report" button at the bottom. When the user clicks this button they are lead to a new page called "Add logbook"

This page is very simlare to the "Add New Artwork" page, but allows the users to add this new image to an existing artwork. Adding an image to the artwork is adding proof that they have been there before.

While adding the logbook entry the user is asked a few questions. Each question is multiple choice and uses clicklet for the answers. The user does not have to answer any of the multiple choice questions. For example: "What is the current condition?", with "Good", "Damaged", "Missing", "Removed" as possiable answers.

The following fields are only shown if the existing artwork doesn't have a value for it. Artwork type, Access, Artist, Material

The "Consent & Legal Requirements" should be the same compoent as the "Add New Artwork" page.

This logbook submission are submitted to the submissions table.


----

User profile page

Update the user table to have a "Profile Name" field.
The user can edit their profile name on their profile page. Their profile name must be unique across the system. Only Allow a-Z0-9 and "-", must not start or end with "-". Also have banned names that sound like system admins, etc.. For Example: Admin, moderator, boss, mod, etc...

Users should be able to earn "Badges" for compleating tasks. There are lots of different badges. These badges are given out when the user achives a certin goal. For example, If a user submits 10 'mural' logbook entries, they get a "Mural Explorer Level 1" badge. The user gets another badge for level 2 at 25 mural logbook entries, etc...
