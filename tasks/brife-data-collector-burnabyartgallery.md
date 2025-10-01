# Data Collector - Burnaby Art Gallery

## Goal

Create a script that can scrape this website for public artworks and extract information about each artwork. The output of this script is a JSON file in GeoJSON format simlare to Open Steet Maps that will be used by the mass import system.

- Example artwork index page: https://collections.burnabyartgallery.ca/list?q=&p=1&ps=200&sort=title_sort%20asc&src_facet=Public%20Art%20Registry
- Example artwork page https://collections.burnabyartgallery.ca/link/publicart46

Each artwork page contains information about the artwork, location, and one or more photos.

This data-collector script should be stored here `src\lib\data-collection\burnabyartgallery`
The output from this data collector is stored in `src\lib\data-collection\burnabyartgallery\output`

There should be 114 recoreds

## Data Format

Each artwork is a GeoJSON `Feature`

Example: https://collections.burnabyartgallery.ca/link/publicart46

The "about" field on the artwork should be renamed to "description" in the GeoJSON Feature

All artworks and artists will have a "source" of "https://burnabyartgallery.ca"
All artworks and artists will have a "source_url" that shows where the data is from

This will produce a GeoJSON file like this

```json
{
  "type": "Feature",
  "id": "node/publicart46",
  "geometry": {
    "type": "Point",
    "coordinates": [-122.915511, 49.278845]
  },
  "properties": {
    "source": "https://burnabyartgallery.ca",
    "name": "Arc de Triomphe",
    "artwork_type": "sculpture",
    "location": "Simon Fraser University",
    "date": "1967",
    "medium": "aluminum, concrete",
    "technique": "metal fabrication, concrete installation",
    "dimensions": "",
    "keywords": "public art,architecture,France,SFU",
    "owner": "SFU Art Collection",
    "category": "SFU Art Collection",
    "accession number": "NA",
    "collection": "Public Art Registry",
    "description": "The modular and abstracted aluminum form of Arc de Triomphe, sited in the Academic Quadrangle’s east plaza, suggests a rendering of a rider atop their horse. The title of Jacques Huet’s sculpture directly references the low relief carvings featured at the Arc de Triomphe in Paris, built to commemorate both the French Revolutionary Wars and the Napoleonic Wars. Huet’s work may also pay homage to the tradition of equestrian statuary monumentalizing important figures. \n\nThis work is part of the Simon Fraser University Art Collection. The SFU Art Collection contains over 5,800 works. Approximately 1,000 works of art are shown throughout the campus and integrated in public, administrative and common learning spaces.  A selection of the most accessible in this diverse repository are incorporated into the City of Burnaby Public Art Registry. For more extensive information about the holdings at SFU, visit: https://www.sfu.ca/galleries/Collections.html (text provided by SFU)",
    "photos": ["https://collections.burnabyartgallery.ca/media/hpo/_Data/_Art_Gallery/_Unrestricted/2014/NA/NA_2014_SFU_Arc2.jpg?width=1200"]
  }
}
```

The artist pages should also be captured

Example: https://collections.burnabyartgallery.ca/list?q=&p=1&ps=&ct=expand&objectType_facet=artist000000|Artist&artist_facet=fafardjoe000000|Fafard,%20Joe

Should produce a JSON file for the artist

```json
{
  "source": "https://burnabyartgallery.ca",
  "source_url": "https://collections.burnabyartgallery.ca/list?q=&p=1&ps=&ct=expand&objectType_facet=artist000000|Artist&artist_facet=fafardjoe000000|Fafard,%20Joe",
  "name": "Fafard, Joe",
  "type": "Artist",
  "biography": "Nationally and internationally acclaimed artist, Joe Fafard, was born September 2, 1942 to French-Canadian parents in the small agricultural community of Ste. Marthe, Saskatchewan. He attended the University of Manitoba (BFA 1966) and Pennsylvania State University (MFA 1968). He was at the University of Saskatchewan, Regina from 1968 – 1974 and visiting lecturer at the University of California at Davis in 1980-1981. Joe Fafard is a distinguished full-time artist and sculptor who currently resides on an acreage near Lumsden, Saskatchewan.\n\nMr. Fafard is one of Canada’s leading professional visual artists and has exhibitions of a wide variety of work in galleries and museums across the country and around the world, including the United States, Great Britain, France and Japan. He is widely recognized as being at the forefront of his art, and his outstanding contributions to the arts have significantly raised the profile of both Saskatchewan and Canada on the national stage.\n\nHe was named an Officer of the Order of Canada in 1981; awarded the Architectural Institute of Canada Allied Arts Award in 1987; received an honorary degree from the University of Regina in 1989, and from the University of Manitoba in 2007; received the Saskatchewan Order of Merit in 2002; received the National Prix Montfort in 2003; received the Lieutenant Governor’s Saskatchewan Centennial Medal for the Arts in 2005; was named CTV Citizen of the Year in 2006; and the Saskatchewan Arts Board Lifetime Achievement Award in 2007. Joe Fafard also received his third honorary doctorate degree from the University of Saskatchewan in June of 2012.",
  "birth date": "1942",
  "death date": "2019",
  "websites": "www.joefafard.com"
}
```
