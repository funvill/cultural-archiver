Review this brief. Ask numbered questions, with multiple choice answers, with "A" being the recommended response. These questions should help clarify this task for a developer. 

# Social Media Scheduler

Create a new view in the admin database called social media schedule. This new social media schedule has two goals. 

1) Display a list of possible artworks that could be turned into social media posts. 

This list would be filtered by several different conditions. Artwork has photo, has a description longer then 100 words, has a artist assocated with the artwork, Has not been posted on social media before. 

The list would be sorted by the the artworks that are in the most users "loved" lists, then by age ascending (older artworks first). 

The list should show 10 possible artworks at a time. For each artwork there would be a preview of what the post would look like in (Bluesky, Instagram). Use a template 

A user can click a "+" icon button to add the social media posts (Both Bluesky and instagram) to the calendar for this artwork. The artwork gets added to the next available day. One set of social media posts per day.

2) Show a calendar of schedule social media posts for each type (Bluesky, Instagram). 


Notes:
- A cron job will be added later on to do the posting to the social media websites. This feature is just for the scheduling
- A table should be created for the social media schedule. A field in that table should have if it was posted to the social media websites or not. 
- We can tell if a artwork has been schedule or posted if its in this table. 
- 