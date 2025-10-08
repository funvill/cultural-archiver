#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';

// This script converts the Vancouver open data artists JSON located at
// src/lib/data-collection/vancouver-open-data/public-art-artists.json
// into the standardized artist-json importer format and writes the result to
// src/lib/data-collection/vancouver-open-data/artists.json

type SourceArtist = Record<string, unknown>;

interface OutArtist {
  source: string;
  source_url?: string;
  name: string;
  type: string;
  biography?: string;
  'birth date'?: string;
  'death date'?: string;
  websites?: string;
  artists_id?: string;
}

function normalizeName(name: string | undefined): string {
  if (!name) return '';
  // Convert "Last, First" to "First Last"
  const commaIndex = name.indexOf(',');
  if (commaIndex > 0) {
    const parts = name.split(',').map((p) => p.trim());
    if (parts.length >= 2) return `${parts[1]} ${parts[0]}`;
  }
  return name.trim();
}

async function main(): Promise<void> {
  // Use process.cwd() so this works when executed with tsx from repo root
  const repoRoot = process.cwd();
  const inputPath = path.join(repoRoot, 'src', 'lib', 'data-collection', 'vancouver-open-data', 'public-art-artists.json');
  const outDir = path.join(repoRoot, 'src', 'lib', 'data-collection', 'vancouver-open-data');
  const outputPath = path.join(outDir, 'artists.json');

  const raw = await fs.readFile(inputPath, 'utf-8');
  let src: SourceArtist[];
  try {
    src = JSON.parse(raw) as SourceArtist[];
  } catch (err) {
    // Attempt a simple repair: remove trailing commas before object/array closers
    const repaired = raw.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    try {
      src = JSON.parse(repaired) as SourceArtist[];
      console.warn('Input JSON was invalid; applied simple repair for trailing commas.');
    } catch (err2) {
      throw err; // rethrow original parse error
    }
  }

  const out: OutArtist[] = src.map((s) => {
    // Heuristics to find fields used in Vancouver Open Data
    const firstname = (s['firstname'] as string) || (s['firstName'] as string) || '';
    const lastname = (s['lastname'] as string) || (s['lastName'] as string) || '';
    const nameRaw = (s['name'] as string) || (s['artistName'] as string) || (s['artist'] as string) || (s['fullName'] as string) || `${firstname} ${lastname}`.trim();
    const name = normalizeName(nameRaw);
    const bio = (s['biography'] as string) || (s['description'] as string) || (s['artistBiography'] as string) || (s['notes'] as string) || '';
    const websites = (s['website'] as string) || (s['websites'] as string) || (s['url'] as string) || '';
    const birth = (s['birthYear'] as string) || (s['birth_date'] as string) || (s['birthDate'] as string) || '';
    const death = (s['deathYear'] as string) || (s['death_date'] as string) || (s['deathDate'] as string) || '';
    const source = (s['source'] as string) || 'https://vancouver.ca';
    const source_url = (s['source_url'] as string) || (s['url'] as string) || (s['artisturl'] as string) || (s['artistUrl'] as string) || undefined;
    
    // Extract artist ID from source (artistid field or artists array if it exists)
    const artistId = (s['artistid'] as number) || (s['artistId'] as number) || undefined;
    const artistsArray = (s['artists'] as string[]) || undefined;
    // Convert to comma-separated string
    const artists_id = artistsArray 
      ? artistsArray.join(',') 
      : (artistId ? String(artistId) : undefined);

    return {
      source,
      source_url,
      name,
      type: 'Artist',
      biography: (bio || undefined),
      'birth date': birth || undefined,
      'death date': death || undefined,
      websites: websites || undefined,
      artists_id: artists_id || undefined,
    };
  }).map(a => ({ ...a, name: a.name.replace(/\s+/g, ' ').trim() }))
    .filter(a => a.name && a.name.length > 0);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(out, null, 2), 'utf-8');

  console.log(`Converted ${src.length} source records to ${out.length} artists`);
  console.log(`Wrote: ${outputPath}`);
}

main().catch((err) => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
