# Diagnostic Logging Guide

This document explains the diagnostic logging added to help troubleshoot issues with the map features.

## Diagnostic Log Prefixes

All diagnostic logs use the prefix `[MAP DIAGNOSTIC]` or `[SITEMAP DIAGNOSTIC]` to make them easy to filter in the browser console.

## Features with Diagnostic Logging

### 1. Map Clustering Toggle

**Location**: `src/frontend/src/stores/mapSettings.ts`

**Logs**:
- `[MAP DIAGNOSTIC] Clustering setting loaded from localStorage: <boolean>` - When settings load
- `[MAP DIAGNOSTIC] No saved clustering setting, using default: <boolean>` - First time user
- `[MAP DIAGNOSTIC] Clustering toggled to: <boolean>` - When user clicks toggle
- `[MAP DIAGNOSTIC] Clustering set to: <boolean>` - When programmatically set

**How to test**:
1. Open browser DevTools Console
2. Navigate to the map page
3. Look for clustering initialization logs
4. Open Map Options and toggle clustering
5. Verify localStorage key `map_clustering_enabled` is updated

### 2. Visited/Starred Icon Display

**Location**: `src/frontend/src/components/MapWebGLLayer.vue`

**Logs**:
- `[MAP DIAGNOSTIC] Icon Atlas Status:` - Shows icon atlas state and marker counts
  - `isReady`: Whether icon atlas is initialized
  - `totalMarkers`: Total markers on map
  - `visitedOrStarred`: Count of markers that should have icons
  - `visitedCount`: Number of visited markers
  - `starredCount`: Number of starred markers
  - `iconAtlasHasIcons`: Whether visited/starred icons exist in atlas

- `[MAP DIAGNOSTIC] Icon '<name>' added to atlas at x=<position>` - When each icon is added
- `[MAP DIAGNOSTIC] Icon '<name>' NOT FOUND in icon atlas` - Warning if icon missing
- `[MAP DIAGNOSTIC] Icon Mapping Created:` - Shows the icon mapping object
- `[MAP DIAGNOSTIC] IconLayer created with <n> markers` - When IconLayer is created
- `[MAP DIAGNOSTIC] No visited or starred markers to display` - When no icons needed
- `[MAP DIAGNOSTIC] Icon Atlas not ready:` - When atlas is not initialized

**How to test**:
1. Open browser DevTools Console
2. Navigate to the map page
3. Mark an artwork as visited (requires login)
4. Look for icon atlas logs showing visitedCount > 0
5. Check if IconLayer is created
6. Verify icons are visible on map

**Common Issues**:
- If `isReady: false` - Icon atlas not initialized, check iconAtlas.ts
- If `visitedCount: 0` - No artworks marked as visited
- If icon NOT FOUND - Check icon definitions in iconAtlas.ts

### 3. User Location Marker

**Location**: `src/frontend/src/components/MapComponent.vue`

**Logs**:
- `[MAP DIAGNOSTIC] Cannot add user location marker - map not initialized` - Map not ready
- `[MAP DIAGNOSTIC] Adding user location marker:` - Shows location and heading data
  - `latitude`: GPS latitude
  - `longitude`: GPS longitude
  - `heading`: Device heading in degrees
  - `mapExists`: Whether map object exists

- `[MAP DIAGNOSTIC] Removed previous user location marker` - When updating location
- `[MAP DIAGNOSTIC] User location marker added to map` - After marker added
- `[MAP DIAGNOSTIC] User location marker z-index set to 10050` - Marker brought to front
- `[MAP DIAGNOSTIC] Error setting user marker z-index:` - If z-index fails

**How to test**:
1. Open browser DevTools Console
2. Navigate to the map page
3. Click the "Center on my location" button
4. Grant location permission if prompted
5. Look for user location marker logs
6. Verify marker appears with person icon and view cone

**Common Issues**:
- If "map not initialized" - Map hasn't loaded yet
- If no logs appear - Location permission denied or GPS unavailable
- If marker added but not visible - Check z-index logs and CSS

### 4. Sitemap Generation

**Location**: `src/workers/routes/sitemap.ts`

**Logs**:
- `[SITEMAP DIAGNOSTIC] GET /sitemap.xml requested` - When sitemap index is requested
- `[SITEMAP DIAGNOSTIC] GET /sitemap-artworks.xml requested` - Artworks sitemap
- `[SITEMAP DIAGNOSTIC] GET /sitemap-artists.xml requested` - Artists sitemap
- `[SITEMAP DIAGNOSTIC] GET /sitemap-pages.xml requested` - Pages sitemap
- `[SITEMAP DIAGNOSTIC] <Type> sitemap generated, length: <bytes>` - Success
- `[SITEMAP DIAGNOSTIC] Error generating <type> sitemap:` - Error occurred

**How to test**:
1. Start the workers dev server
2. Open browser and navigate to:
   - `http://localhost:8787/sitemap.xml`
   - `http://localhost:8787/sitemap-artworks.xml`
   - `http://localhost:8787/sitemap-artists.xml`
   - `http://localhost:8787/sitemap-pages.xml`
3. Check terminal/console for sitemap diagnostic logs
4. Verify XML is returned

**Common Issues**:
- If no logs appear - Routes not registered, check index.ts
- If error logs - Database connection issue or missing data
- If 404 - Worker not rebuilt after adding routes

## How to Enable/Disable Diagnostic Logging

To **disable** diagnostic logging (for production), search for `[MAP DIAGNOSTIC]` or `[SITEMAP DIAGNOSTIC]` in the codebase and comment out or remove the console.log statements.

To **enable** only specific diagnostics, use browser console filters:
```
Filter: [MAP DIAGNOSTIC]
Filter: [SITEMAP DIAGNOSTIC]
Filter: [MAP DIAGNOSTIC] Icon
Filter: [MAP DIAGNOSTIC] Clustering
```

## Build and Dev Server Commands

**Important**: These diagnostic logs only work if the code is built and the dev server is running with the built code.

### Recommended Development Workflow

1. **First time setup**:
   ```powershell
   npm install
   npm run build
   ```

2. **During development**:
   ```powershell
   npm run dev
   ```
   This starts both frontend (Vite) and workers (Wrangler) dev servers with hot-reload.

3. **To see diagnostic logs**:
   - Frontend logs: Open browser DevTools Console
   - Workers logs: Check terminal where `npm run dev` is running

4. **If changes don't appear**:
   - Frontend: Vite should hot-reload automatically
   - Workers: Wrangler should auto-restart
   - If not working: Stop dev server and run `npm run build && npm run dev`

### Why `npm run devout` Might Not Work

The `devout` command pipes output to a log file:
```powershell
npm run dev | Tee-Object dev-server-logs.txt
```

**Issues**:
- It doesn't rebuild before starting
- Hot-reload might not work properly
- Logs go to file instead of console

**Better alternative**:
```powershell
# Build first, then dev
npm run build
npm run dev
```

## Troubleshooting Checklist

If features aren't working:

- [ ] Run `npm run build` to ensure latest code is compiled
- [ ] Check `src/frontend/dist/` exists (frontend built)
- [ ] Check `src/workers/dist/` exists (workers built)  
- [ ] Verify `npm run dev` starts both servers without errors
- [ ] Open browser DevTools Console and filter for `[MAP DIAGNOSTIC]`
- [ ] Check for any error messages in diagnostic logs
- [ ] Verify localStorage has expected keys (F12 > Application > Local Storage)
- [ ] Hard refresh browser (Ctrl+Shift+R) to clear cache

## Quick Diagnostic Commands

```powershell
# Check if builds exist
ls src/frontend/dist
ls src/workers/dist

# Full rebuild and start
npm run build
npm run dev

# Just rebuild frontend
npm run build:frontend

# Just rebuild workers
npm run build:workers

# Run tests to verify code works
npm run test
```

## Contact

If diagnostic logs show unexpected behavior, please report:
1. The specific diagnostic log output
2. What you were trying to do
3. Expected vs actual behavior
4. Browser and version
