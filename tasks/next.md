# Know things to do

## Choose a name

Use https://domains.cloudflare.com/ to find the domain.

### Avalaible

- artfind.net

## User Edit Artwork Fields

A artwork has a series of fields and properties.

All artworks have the following fixed fields

- Description - A description of the artwork
- Title - Title of the artwork
- Created by - A list of the creators, comma separated.
- Location - The GPS location of the artwork (Can't be edited by users)
- Created on - The date that the artwork was added (Can't be edited by users)
- Photos - A series of photos for this artwork. (Can't be edited by users)
- Tags/keywords - A series of comma separated keywords. That can be used for searching.

An artwork also has variable fields. These fields may or may not exist on each artwork. These fields are Key/Value. Some of the key/value variable fields will have enumerated values, while others are text fields. Examples: Artwork type: murals, sculptures, memorials, mosaics, tapestries, paintings, etc...

The user needs a method for updating the information about a artwork. The moderators need the ability to approve or reject these changes to the artwork. Only logged in users only can edit information about artworks.

In this way a artwork details page is like a wiki, allowing for user submitted content and edits. A moderator reviews each edit to reject obvious abuse.

A user should click the "edit mode" button on the artworks details page. This enabled them to edit each field. The edits should happen inline. When the user has made one or more changes to the artwork page. They can click the "Save" button, add a change note. This change is then stored in the moderators queue.

A moderator needs to review all edits to reject the obvious abuse.

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

## App tool bar

1) Combine the sign in and sign up dialogs. They both have only one input "email address", and both send magic-links. If the user doesn't exist for a specific email address add it. if doesn't exist as a user, then create the user and send the magic-link. If the user does exist, then send the magic-link. Call this "Sign in". instead of Sign up.

2) Combine the 'About' and 'Help' links in the app bar into a single "Help" button.

3) The site name and logo should be clickable to bring the user back to the map. If the user is in the middle of entering a form (dirty forum), ask them if they want to continue.

4) The "Location Access Needed" warning should not be dismissible. Add a link into the warning bar to a help page in the FAQ section on "Why Location Access Needed"

5) Add a FAQ section to the help page.

## Search page

The search results should be a series of Art Work Cards, and Creator Cards. The user can click the cards to see the corasponding page.

- Search by String - Primary way of searching
- Search by Tag/Keyword - A user might want to find all artworks tagged with one ore more keyword.
- Search by Creator - A user might want to find all artworks that are from the scame creator
- Search by field (The Key or the Value) - A user might want to find all artworks that contain a specific field, or where the field matches a value.


## Find partners

Find people that would be willing to partner with me on this project. Be specific and say that you are NOT looking for monetary support but are looking for in-kind support. Advertisement, recommendations, etc.

- Burrard Arts Foundation, Centre for Digital Media students. They spondered a simlare project in the past. https://intergalactic.com/content/muse-public-art-app?utm_source=chatgpt.com
