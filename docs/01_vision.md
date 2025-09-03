# 01_idea-artseek.md  

## Pitch
ArtSeek is **a game that builds an archive**. It feels like Pokémon Go for art: a playful hunt where users collect artworks in their city. But every photo, every note, every discovery quietly contributes to a Creative Commons archive that benefits society, artists, and cultural institutions. By playing, users become heroes who help preserve art for the good of all.

## Description
ArtSeek is a **mobile-first web app** where people explore, photograph, and collect public art. The core loop is simple: open a map, find artworks nearby, snap a photo, and add it to your personal profile. Each artwork can be enriched with details like creator, style, or tags, but the minimum requirement is a photo + location. Over time, this builds a living archive of artworks — murals, mosaics, sculptures, installations — including those that change or disappear.

The app is playful at its core: streaks, badges, leaderboards, and weekly challenges keep users motivated. Yet behind the game, the contributions flow into a Creative Commons archive: open, reusable data that documents the art landscape of cities. Casual explorers get to learn, obsessive collectors get to compete, and artists gain visibility by curating their own profiles.

## Problem Definition  
Public art is everywhere — murals, installations, mosaics — but most people don’t know who created it, why it was made, or when it appeared. Information is fragmented, inconsistent, or not documented at all. Temporary art is lost when events end. The problem is **art invisibility**.  

ArtSeek solves this by making art discoverable and collectible, while creating a global archive of artworks that society can use, study, and preserve.

## User Story (High-Level)  

- “As a casual city explorer, I want to take a photo of a mural I stumble upon so that I can learn who made it and why.”  
- “As a collector, I want to track and complete all the artworks in my neighborhood so that I can show off my achievements and climb the leaderboard.”  
- “As a contributor, I want to add missing artworks so that the database becomes more complete and useful.”  
- “As an artist, I want to curate my artworks and add information so that people who find them can connect with my story.”  

## Target Market / Audience  

- **Primary Audience:**  
  - Collectors & explorers who enjoy completion, stats, and bragging rights.  
  - Casual users who occasionally check the app when encountering art.  

- **Secondary Audience:**  
  - Artists who want to claim and curate their artworks.  
  - Moderators and heroes who volunteer to help maintain data quality.  
  - Researchers, historians, and educators who want structured archives.  
  - Festivals, galleries, and municipalities (later phases).  

## Users
ArtSeek supports multiple types of users, each with different motivations and roles.  

### 1. Casual Explorer
- Uses the app passively when stumbling upon art.  
- Main value: learns about artworks on the spot.  
- Frequency: ~4–10 times/month.  
- Low priority — not a major driver of data or growth.  

### 2. Collector (Obsessive Player)  
- **Core hero user.**  
- Motivated by completion, leaderboards, badges, and “first discovery” credit.  
- Wants to see 100% of artworks in their city.  
- Travels to other cities to expand their reputation.  
- Provides the majority of high-value data and energy.  

### 3. Contributor  
- Adds new artworks to the database (critical in MVP).  
- Minimum input: photo + location; optional metadata.  
- Gets credit on artwork pages (“Discovered by [username]”).  
- Pathway into moderator/hero status.  

### 4. Artist  
- Can claim their artworks with proof.  
- Curates artwork detail pages with bios, progress photos, links.  
- Changes are treated as more trustworthy than random user edits.  
- Secondary focus in MVP, but important for legitimacy.  

### 5. Moderator / Hero  
- Volunteers motivated by love of art and “giving back.”  
- Review submissions for obvious abuse.  
- Specialize in certain domains (murals, mosaics, locations).  
- Recognized with hero badges and titles (e.g., “Hero of Vancouver Murals”).  
- Background role but essential for trust.  

### 6. Social Sharer  
- Vanity-driven users who want to show off their accomplishments.  
- Profile is more like a public timeline of achievements.  
- Secondary audience; low MVP priority.  

### 7. Researcher / Historian  
- Interested in long-term archive value.  
- Rare but valuable.  
- May trade in-kind contributions for special access or tools.  
- Not a major MVP focus, but important long-term.  

### 8. Festival-Goer (Phase 2)  
- Attends temporary art events.  
- Wants to prove presence and collect artworks during the event.  
- Low priority for MVP, but strong later growth path.  

---

## Impact  
- **Cultural:** Preserves public and temporary artworks that are often undocumented.  
- **Personal:** Gamifies exploration, turning cultural discovery into fun.  
- **Community:** Builds a Creative Commons dataset that anyone can reuse.  
- **Artists:** Provides visibility, legitimacy, and curation tools.  
- **Society:** Long-term, becomes a global archive of 1M+ artworks.  

## Prior Art / Inspirations  
- **Smartify** – Strong image recognition indoors, but institution-driven. Lacks playful collection.  
- **Magnus** – Focused on art markets and collectors, not exploration.  
- **Google Arts & Culture** – Rich data, some recognition, but not gamified and community-driven.  
- **Street Art Cities** – Maps murals well, but lacks collection game, moderation, and open archive.  
- **eBird** – Great example of a “game that builds a dataset.”  

## Potential Features  

### MVP Essentials
- Map of artworks with clickable pins.  
- Artwork cards and simple detail pages.  
- Artwork submission (photo + location required).  
- User profiles with stats and journals.  
- Authentication for attribution.  
- Basic search/filter.  
- CC0 licensing agreement.  
- Basic moderation (abuse checks).  

### Phase 2 Features
- Seen vs unseen pins (to-do map).  
- First discovery credit (badges, stats).  
- Weekly auto-generated challenges.  
- Contributor credit: “Discovered by [username].”  
- Artist profile pages.  
- Advanced search (style, tags, location).  
- Saved searches → personal to-do lists.  

### Future Features
- Photo CV identification (suggest matches on upload).  
- Artwork lifespan (“keep alive” mechanic).  
- Version history (murals across decades).  
- Festival packs (temporary hunts).  
- Notifications for new art nearby.  
- Social sharing (optional).  
- Advanced moderation (crowd voting, hero roles).  

## Project Name Ideas  
- **ArtSeek** (seek + art, direct and memorable).  
- **MuralQuest** (playful, hunt-oriented).  
- **Artefact** (art-fact + artifact).  
- **CanvasGo** (Pokémon Go parallel).  
- **Cultura** (culture + capture).  

## Keywords  
- public art  
- mural map  
- art archive  
- cultural discovery  
- gamification  
- Creative Commons  
- art hunt  

## General Resources Required  
- **People:**  
  - Visionary (done!)  
  - Project Manager / Team Lead  
  - UX/UI Designer (map, photo flow, gamification)  
  - Community manager & moderators  
  - Partnerships lead (for seed data & artist outreach)  

- **Skills:**  
  - UX gamification design  
  - Community moderation workflows  
  - Data collection & curation  
  - Partnership development (festivals, cities)  

- **External Resources:**  
  - Open data (Wikidata, museum APIs, city public art databases)  
  - Creative Commons licensing text  
  - Grants or cultural funding  

## Open Questions  
1. How competitive should the gamification be (light bragging vs hardcore leaderboards)?  
2. How do we verify artist claims securely but without friction?  
3. What’s the simplest moderation workflow at scale (heroes, crowd voting, staff)?  
4. How do we handle copyrighted artworks photographed by users? (solution: CC0 photos, but artworks may still have copyright).  
5. Should user profiles default to private or public? (decided: private by default).  
6. How do we detect and encourage obsessive collectors (our “hero users”)?  
7. When to expand to festivals, galleries, and cities beyond Vancouver?  

## MVP
The MVP validates the concept by proving users will:  
- Explore artworks via a map.  
- Submit new artworks with photo + location.  
- View simple artwork detail pages.  
- Maintain a profile with their contributions.  
- Search and filter a growing archive.  
- Use authentication so contributions are attributed.  
- Accept CC0 licensing of their submissions.  
- Rely on basic moderation to prevent abuse.  

MVP Core Loop:  
1. User opens map → sees pins.  
2. User clicks pin → views artwork card/detail.  
3. User clicks camera button → submits new photo/artwork.  
4. Submission saved, shown in profile timeline.  
5. Profile shows stats of user contributions.  

This loop ensures the game works and starts building the archive.

---

## Handoff to Next Step (PM / Team Lead)  
- **Features to break into PRDs (MVP):**  
  - Map of Artworks  
  - Artwork Card + Detail Page  
  - Artwork Submission Flow  
  - User Profile Page  
  - Authentication / Identity  
  - Basic Search / Filter  
  - Moderation (Basic)  
  - Data Licensing & Terms  

- **Resources to confirm:**  
  - Which seed datasets to import (Wikidata, city archives, museums).  
  - Creative Commons legal text for uploads.  
  - Lightweight moderation system design.  

- **Prioritized open questions:**  
  - Gamification intensity (light vs competitive).  
  - Artist verification process.  
  - Collector reward loops for MVP.  
  - Minimum viable moderation process.  

