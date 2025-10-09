# Public Art Registry

**Public Art Registry** is a production-ready community-driven platform that empowers people to become Citizen Cultural Archivists. The goal is to document, preserve, and share public and cultural artworks so they remain accessible to everyone, forever.

## 🌍 Project Vision

Cities are filled with cultural landmarks—murals, sculptures, mosaics, tiny libraries, installations, and more. Too often, these works fade away, get demolished, or disappear when privately managed websites go offline. Public Art Registry provides a public, open platform to:

- **Discover** public art near you on an interactive map.
- **Document** artworks by uploading photos, notes, and details.
- **Preserve** submissions by contributing metadata under CC0 to the open commons.
- **Contribute** to long-lived open datasets such as OpenStreetMap and Wikidata (future phases).

This ensures that the cultural history of our cities outlives any single platform or institution.

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[API Documentation](docs/api.md)** - Complete API reference
- **[Database Schema](docs/database.md)** - Database structure and relationships
- **[Deployment Guide](docs/deployment.md)** - Deployment instructions for Cloudflare
- **[Social Media Scheduler](docs/social-media-scheduler.md)** - Automated social media posting
- **[Photo Processing](docs/photo-processing.md)** - Photo upload and optimization
- **[Authentication](docs/authentication.md)** - User authentication system
- **[Mass Import](docs/mass-import.md)** - Bulk artwork import system

## 🚀 Quick Start

See the [deployment documentation](docs/deployment.md) for detailed setup instructions.

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# Optional: Social Media Integration
BSKY_IDENTIFIER=your-handle.bsky.social
BSKY_APP_PASSWORD=your-app-password
INSTAGRAM_ACCESS_TOKEN=your-token
INSTAGRAM_ACCOUNT_ID=your-account-id
```

See [Social Media Scheduler documentation](docs/social-media-scheduler.md) for setup instructions.

## 📄 License

This project is open source. See LICENSE for details.
