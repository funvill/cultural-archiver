# Know things to do

## Choose a name

Use https://domains.cloudflare.com/ to find the domain.

### Avalaible

- artfind.net

## User edit artwork fields

A artwork has a series of fields and properties.

All artworks have the following fixed fields

- Description - A description of the artwork
- Title - Title of the artwork
- Created by - A list of the creators
- Location - The GPS location of the artwork
- Created on - The date that the artwork was added (Read only)
- Photos - A series of photos for this artwork.

An artwork also has variable fields. These fields may or may not exist on each artwork. These fields are Key/Value.




A user should be able to update all the fields on the artwork page. This allows them to add or update information. All updates are moderated.

Each artwork has a series of fixed fields. Location, title, description, created by, etc... These fields are known about. But each artwork also has a variable list of fields (Key values), where the key is not fixed. Users need the ability to add or edit these fields. Many of these custom fields will have enumerations associated with them. (Example: type = {murial, tiny libary, street art, etc..}). The user needs the ability to edit these fields and choose a enumerated value. 



logged in users only 

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

