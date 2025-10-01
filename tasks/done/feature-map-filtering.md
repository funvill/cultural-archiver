
# Map interface

## User story

1) What is around me?

- Want to know about all the art near them
- Want to filter out artwork markers for artwork that doesn't exist any more (Removed, temporary, etc...)
- May want to filter by artwork type

2) Curated list (low priorty)

- The user has already gone though the catalog and selected artworks that they want to see
- They only want to see the artworks in their specific list
- Filter by user list

3) Hunter

- Wants to check off all artworks around him
- Wants to filter out artwork markers for artwork with an unknown status (Removed, temporary, etc...)
- Wants to show artworks that they have already seen in a different way (Gray flags)
- May want to filter artworks out of the map that they have already seen

## Lists

- Loved (System) - The user clicked the heart next to the artwork.
- Visited (System) - Artworks that the user has already seen.
- Stared (System) - Artworks that the user has stared, (Wants to see)
- Custom lists (User) - A series of custom lists that the user has made.

## Requirments

- Ability to show different markers on the map depending on the state of the artwork. (Visited, Stared, Normal, Unknown)
  - Visited - This shows as a Gray flag. From the Visited (System) list.
  - Stared - This shows as a golden star. From the Stared (System) list.
  - Normal - This is a round circle for artworks that don't exist in the other two system lists
  - Unknown - Shown as a gray circle with a dashed boarder. These are artworks that we don't know if they exist any more. Status=unknown
- Markers can be simple style
- Ability to show 1000 map markes of different types on the map at any given time
  - Good preformence with a large amount of map markers
  - The map pointers must not be in the HTML DOM as there are too many to keep proforment
- Ability to turn on and off map marker clustering
  - Force clustering at zoom level 1-12
- Caching of map markers and lists for quicker inital loading and filtering

## Implmentation

Create a test map page '/test-map/` that loads in 250 markers of each different artwork status types (Visited, Stared, Normal, Unknown). Then have a panel that allows for filtering of the markers.

On page load
- Request the system lists from the user profile (Visited, Stared, Loved). This should be a single request. This should be cacheable with a head request for last updated time.
- Request the nearby artworks with minimal flag set.

Update the local storage database with a list of all the markers
Update the map based on what is in the local stroage database, and what filters have been applied.

## UI/UX

- Show a banner at the top of the map that indicates what filters are currenly active. If no filters are active then hide the banner.
- Show the Map filtering options in the Map options panel. The map options panel should be scrollable.
- The filters are
  - "Hide Visited Artworks", Disabled by default, if enabled then filter out the artworks that are in the "visited" list.
  - "Show removed Artworks", Disabled by default, if enabled then also show the artworks with the "Unknown" status.
