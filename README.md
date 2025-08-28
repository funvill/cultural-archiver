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

## 🚀 Quick Start

### Prerequisites

- **Node.js v23+** (required for native TypeScript support)
- **npm** (comes with Node.js)
- **Cloudflare account** (for deployment)

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/funvill/cultural-archiver.git
   cd cultural-archiver
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment setup**

   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare credentials
   ```

4. **Start development servers**

   ```bash
   npm run dev
   ```

   This starts both the frontend (Vite) and workers (Wrangler) with hot reloading.

### Available Scripts

- `npm run dev` - Start development servers for frontend and workers
- `npm run build` - Build both frontend and workers for production
- `npm run test` - Run test suite (ESLint, TypeScript checks, Prettier)
- `npm run lint` - Run ESLint on all TypeScript files
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript compiler checks
- `npm run migrate` - Run database migrations using native TypeScript execution
- `npm run deploy:frontend` - Deploy frontend to Cloudflare Pages
- `npm run deploy:workers` - Deploy workers to Cloudflare

### Project Structure

```text
cultural-archiver/
├── src/
│   ├── frontend/           # Vue 3 + TypeScript frontend
│   │   ├── components/     # Vue components
│   │   ├── views/          # Page components
│   │   └── main.ts         # Frontend entry point
│   ├── workers/            # Cloudflare Workers backend
│   │   ├── index.ts        # Workers entry point
│   │   └── api/            # API route handlers
│   └── shared/             # Shared TypeScript types and utilities
├── migrations/             # Database migration scripts
├── .github/                # GitHub workflows and templates
└── docs/                   # Project documentation
```

### Development Features

- **Native TypeScript**: Uses Node.js v23+ native TypeScript support (no compilation needed)
- **Hot Reloading**: Frontend and workers restart automatically on changes
- **Shared Types**: Common TypeScript interfaces between frontend and backend
- **Database Migrations**: Version-controlled schema changes with TypeScript runner
- **CI/CD**: Automated testing and deployment workflows

### Cloudflare Resources

The project uses these Cloudflare services:

- **Pages**: Frontend hosting with automatic deployments
- **Workers**: Serverless backend API
- **D1**: SQLite database for metadata storage
- **KV**: Key-value store for sessions and caching
- **R2**: Object storage for artwork photos

### Setup Time Goals

- **15 minutes**: Complete development environment setup
- **5 minutes**: Deploy changes to production

## 🤝 Contributing

Everyone is welcome to contribute to this project. See the CONTRIBUTING.md for guidelines. All metadata is licensed CC0, making it freely reusable for the commons.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make changes using TypeScript (leverages Node.js v23+ native support)
4. Run tests: `npm test`
5. Submit a pull request

### Code Standards

- **TypeScript**: Strict mode enabled for better code quality
- **ESLint**: Configured with Vue/TypeScript rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Use `feat:`, `fix:`, `refactor:`, etc.
