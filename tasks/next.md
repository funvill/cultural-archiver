# Know things to do

## Choose a name

Use https://domains.cloudflare.com/ to find the domain.

### Avalaible

- artfind.net

## User Edit Artwork Fields

A artwork has a series of fields and properties.

All artworks have the following fixed fields

- Title - Title of the artwork. A string with a max of 512 chars
- Description - A description of the artwork. Markdown formating
- Created by - A list of the creators, comma separated.
- Tags/keywords - A series of comma separated keywords. That can be used for searching.

The user needs a method for updating the information about a artwork. Only logged in users only can edit information about artworks.

In this way a artwork details page is like a wiki, allowing for user submitted content and edits.

A user should click the "edit mode" button on the artworks details page. This enabled the user to edit the content of each field. The edits should happen inline. When the user is done with editing, they can click the "Save" button to submit their changes to the server.

All user submitted content needs to be reviewed by a moderator. A moderator can either `Approve` or `Rejected` the changes, Just like the new artwork moderator queue. The changes are added to the moderator queue (/review). A moderator is given a preview of the change. If the moderator accepted the updates, the updates will be shown on the artwork details page. The changes also are shown in the logbook section of the Artwork details page.



An artwork also has variable fields. These fields may or may not exist on each artwork. These fields are Key/Value. Some of the key/value variable fields will have enumerated values, while others are text fields. Examples: Artwork type: murals, sculptures, memorials, mosaics, tapestries, paintings, etc...

## Mass Import

Data sets

- City of Vancouver Public Art: Contains artist info and geolocated artwork data, updated weekly. It’s available in GIS-friendly formats like CSV or GeoJSON https://opendata.vancouver.ca/explore/dataset/public-art/
- Public Art – Artists Dataset: https://opendata.vancouver.ca/explore/dataset/public-art-artists/information/

## Find partners

Find people that would be willing to partner with me on this project. Be specific and say that you are NOT looking for monetary support but are looking for in-kind support. Advertisement, recommendations, etc.

- Burrard Arts Foundation, Centre for Digital Media students. They spondered a simlare project in the past. https://intergalactic.com/content/muse-public-art-app?utm_source=chatgpt.com
- Canada Council - They prefer events over resources. The event could be a mass hunt for new art.

## Github copilot

Optimize the adgent session. See if there is a way to have `vitest` pre installed.

`I see there's an issue with vitest not being found. Let me check if dependencies are installed and try to fix this:`
