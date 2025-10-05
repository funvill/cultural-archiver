# Known things to do

## General

- `support@publicartregistry.com` currently errors out when sending an email to this address. This address should forward to my personal address.
- Check to make sure that the only email address that is public is `support@publicartregistry.com`

- In artwork edit mode, make the description text box 3 times as tall.
- Create a script to remove the deployed recoreds on cloudflare for the frontend and backend workers. These are piling up for no reason.

- Add an artwork for NULL island https://en.wikipedia.org/wiki/Null_Island

---

- Need to spend some more time on the mobile and experience. I found it difficult to change and edit the tags.

---

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

---

## Mass Import merge tags

- Update the "source_url" value to be clickable as a link. This means it shouldn't search that tag, that link should be clickable.
  - Tags that have urls in them, should be clickable

---

The "Nearby Artworks" results in the FastAdd Artwork. The thumbnails for the artworks are not showing. For example this artwork https://api.publicartregistry.com/artwork/969b3394-e3a0-4dbb-8d62-87a42b382b1e?action=add-logbook&from=fast-upload as a photo but it the photo isn't showing up on the "Nearby Artworks" results.

---

We are going to update the user profile page

Add a username to the user table. The users can change their username on the user settings page. The username must be unique across the whole system.

Badges Users can earn badges by doing tasks for the system. A user can have the same badge multiple times.

## Top row

- Total points card. Show zero right now
- Cards for: Total submitted Artworks, Approved Artworks, Approved edits... Do not show rejected count

## Second row

Badges Show a list of badges that this user has been awarded.

## Next row

Submissions Show the submission cards

----

- Artist Pages need to be created
- The photo checkbox in the search results does not work because it's searching the tags for photos instead of the photos field

---- 

Downloadable QR code "Sign" for the artwork page
This allows people to print the sign for their own artworks to link to this page.

----

A series of quotes that motivate users. This should show on the navagation rail

- “Your actions preserve creativity and carry artists’ voices into the future.”
- “When you witness and record art, you extend its legacy forward.”
- “By preserving what artists create, you gift their legacy to the future.”
- “You are the guardian who ensures public art’s story never fades.”
- “Your care today honors artists and shapes tomorrow’s cultural memory.”
- “Because of you, artists’ voices will echo through generations.”
- “Without you, art vanishes; with you, its legacy endures.”
- “Because of your care, public art lives on forever.”
- “Your commitment transforms fleeting artworks into eternal stories.”