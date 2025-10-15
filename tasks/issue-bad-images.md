Of the artworks that did import properly.

Example
https://publicartregistry.com/artwork/0ee8bc39-404c-41f4-acf7-d061b228a016

This artwork has a primlary image with a url of
https://api.publicartregistry.com/api/images/medium/https://photos.publicartregistry.com/mass-import-cache/2025/10/15/cached-36cb268beeaa3da4.jpg

This url doesn't work and produces a error of
```{"error":"INVALID_IMAGE_PREFIX","message":"Image path must start with artworks/, submissions/, originals/, or photos/","details":{},"show_details":true}```

Note: the `http://` in the middle of the url. I assume this has to do with the mass-import-cache

This url does work
`https://photos.publicartregistry.com/mass-import-cache/2025/10/15/cached-36cb268beeaa3da4.jpg`


Two problems 

1) the mass-import is failing to import the images correctly
