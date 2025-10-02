npx tsx src/lib/data-collection/newwest/index.ts --limit=5 | Tee-Object output.txt



Update the readme `src\lib\data-collection\readme.md` with more hints for the next data-collection script 


----

Read the readme `src\lib\data-collection\readme.md`

Create a data-collection script for `Richmond`

First use playwright MCP to review the contents and format of the public art index page.
https://www.richmond.ca/culture/howartworks/publicart/collection/Search.aspx

Artwork example page
https://www.richmond.ca/culture/howartworks/publicart/collection/PublicArt.aspx?ID=569

source: "https://www.richmond.ca/culture/howartworks/publicart/"
id=569
title=(Coyote) koyo-te, through the bog (2020)
Artists: Nancy Chew , Jacqueline Metz
Address: 23100 Garripie Ave

The address has a link https://www.richmond.ca/culture/howartworks/publicart/collection/LocationsMap.aspx?x=-122.966809&y=49.177886 that includes the GPS location 122.966809, 49.177886

This artwork has one photo
This artwork has two artists

Then make a plan in the `src\lib\data-collection\richmond\readme.md` for this data-collection script

----

Surrey 
https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection

Example artwork page
https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection/abstract-mountains

source: "https://www.surrey.ca/arts-culture/public-art/"
source_url: https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection/abstract-mountains
id: https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection/abstract-mountains
title: Abstract Mountains
artists: Marie Khouri
location: City Centre 2 (9639 137A Street)
category: Private collection
developer: Lark Group
year installed: 2018
artist: Marie Khouri

This artwork has three photos.


----

Mapleridge 
https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art

Example artwork page
https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/maple-ridge-community-mosaic

Source: "https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/"
Source_url: https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/maple-ridge-community-mosaic
Artist Name: Rebecca Bayer, David Gregory, SpaceMakePlace Design
Project Status: Completed
Art Project Type: Installation
Installation Date: January 31, 2020
Location: Maple Ridge Leisure Centre
Address: 11925 Haney Place, Maple Ridge, BC, V2X 6G2

This one does not produce a GPS location, create a helper script that can look up a GPS by an address 
There is one photo

----




https://www.nvrc.ca/arts-culture/public-art/art-collection
https://gisext2.cnv.org/publicart/

