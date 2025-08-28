# Cultural Archiver

**Cultural Archiver** is a community-driven project that empowers people to become Citizen Cultural Archivists. The goal is to document, preserve, and share public and cultural artworks so they remain accessible to everyone, forever.

## 🌍 Project Vision

Cities are filled with cultural landmarks—murals, sculptures, mosaics, tiny libraries, installations, and more. Too often, these works fade away, get demolished, or disappear when privately managed websites go offline. Cultural Archiver provides a public, open platform to:

- **Discover** public art near you on an interactive map.
- **Document** artworks by uploading photos, notes, and details.
- **Preserve** submissions by contributing metadata under CC0 to the open commons.
- **Contribute** to long-lived open datasets such as OpenStreetMap and Wikidata (future phases).

This ensures that the cultural history of our cities outlives any single platform or institution.

## 🎯 MVP Goals

Phase 0 and 1 focus on delivering a simple, accessible web app where users can:

- Upload photos (auto-geolocated) and notes about artworks.
- See their own submissions immediately, with public visibility after moderator approval.
- Browse artworks on a Leaflet + OpenStreetMap powered map.
- Store data and images safely in a serverless Cloudflare stack (Pages, Workers, D1, KV, R2).

## 🛠 Tech Stack

- Frontend: Vue + TypeScript + Tailwind + shadcn/ui
- Mapping: Leaflet + OpenStreetMap tiles
- Backend/Infra: Cloudflare Pages, Workers, D1 (SQLite), KV, R2 storage
- Auth: Anonymous UUID cookie + optional email magic link login

## Licensing

- Metadata → CC0
- Photos → Free licenses (Commons integration in later phases)

## 🤝 Contributing

Everyone is welcome to contribute to this project. See the CONTRIBUTING.md for guidelines. All metadata is licensed CC0, making it freely reusable for the commons.
