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

## Mass Export / Import
  
### Export

We need the ability to generate a export of the Artworks, Photos, and logbook entries from this system as a backup, and data dump.

This export will be used as a backup of the system and a data dump for others to import into their systems.

The export does not need to include user information or temporary information (magic links, rate limiting, etc).

The data dump will happen automatically once a month. Only the last 3 months will be kept. The data dumps will be public. Do not include any personal information or configuration settings or secrets in the data dump.

The data dumps are stored in the R2 bucket. A list of data dumps with links should be avalaible in the help page.

The data dumps and all of the content should be licensed as CC0 Zero. Add the license to the archive.

### Mass Import

We need the ability to mass import public data sources that we find. The public data sets will have some location data at a minimum, but also could have addtional information that would be useful.

We need a mass import libary that has utility functions to make generating import scripts for public data easier. This libary of utility functions will be used to import many different public data sets.

Many of these data sets will have duplicate, and overlapping data. There needs to be a mechanizem to combine artworks together or update artworks instead of adding them. This is very importaint.

These libaries functions should add logbook entries as if they were normal users. instead of directly accessing the database. Only use public functions.

The mass import should continbute all submissions to a mass-import user.

Example data sets:

- City of Vancouver Public Art: Contains artist info and geolocated artwork data, updated weekly. It’s available in GIS-friendly formats like CSV or GeoJSON https://opendata.vancouver.ca/explore/dataset/public-art/
- Public Art – Artists Dataset: https://opendata.vancouver.ca/explore/dataset/public-art-artists/information/

## Search page

The search results should be a series of Art Work Cards, and Creator Cards. The user can click the cards to see the corasponding page.

- Search by String - Primary way of searching
- Search by Tag/Keyword - A user might want to find all artworks tagged with one ore more keyword. `tag:{TagName}`
- Search by Creator - A user might want to find all artworks that are from the scame creator. `Creator:{CreatorName}`
- Search by field (The Key or the Value) - A user might want to find all artworks that contain a specific field, or where the field matches a value. `Field:{FieldName}:{FieldValue}`, or `Field:{FieldName}`

## Find partners

Find people that would be willing to partner with me on this project. Be specific and say that you are NOT looking for monetary support but are looking for in-kind support. Advertisement, recommendations, etc.

- Burrard Arts Foundation, Centre for Digital Media students. They spondered a simlare project in the past. https://intergalactic.com/content/muse-public-art-app?utm_source=chatgpt.com
- Canada Council - They prefer events over resources. The event could be a mass hunt for new art.

## Database

Currently the database has gone though several changes during the inital devlopment. There is an existing migration process (/migrations/) for updating the database between each version.

We do not need these old migration steps. They were devlopped during the intial devlopment stage while the system was changing quickly.

Now that the database is more stable, we want to extract the current state of the database and use this schema as the default base for new migration steps.

