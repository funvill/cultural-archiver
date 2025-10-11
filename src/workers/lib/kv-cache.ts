export interface SnapshotMetadata {
  latest: string;
  generatedAt: number;
  etag: string;
  size?: number;
}

export function hashContent(content: string): string {
  // Simple hash fallback for Workers - use crypto.subtle in production
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = (h << 5) - h + content.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36).substring(0, 12);
}

export function canonicalize(url: URL): string {
  const clean = new URL(url.toString());
  ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(p => clean.searchParams.delete(p));
  return clean.pathname;
}

export async function getSnapshot(canonical: string, PRERENDER_INDEX: KVNamespace, PRERENDER_SNAPSHOTS: KVNamespace): Promise<{ html: string; etag: string } | null> {
  const indexKey = `prerender:index:${canonical}`;
  const metaJson = await PRERENDER_INDEX.get(indexKey);
  if (!metaJson) return null;
  try {
    const meta: SnapshotMetadata = JSON.parse(metaJson);
    const html = await PRERENDER_SNAPSHOTS.get(meta.latest);
    if (!html) return null;
    return { html, etag: meta.etag };
  } catch (e) {
    console.warn('Failed to parse snapshot metadata', e);
    return null;
  }
}

export async function saveSnapshot(canonical: string, html: string, PRERENDER_INDEX: KVNamespace, PRERENDER_SNAPSHOTS: KVNamespace): Promise<void> {
  const contentHash = hashContent(html);
  const versionedKey = `prerender:${canonical}:v${contentHash}`;
  const size = new TextEncoder().encode(html).byteLength;
  if (size > 25 * 1024 * 1024) {
    console.warn('Snapshot too large for KV, skipping');
    return;
  }
  await PRERENDER_SNAPSHOTS.put(versionedKey, html, { expirationTtl: 60 * 60 * 24 * 7 });
  const metadata: SnapshotMetadata = { latest: versionedKey, generatedAt: Date.now(), etag: contentHash, size };
  await PRERENDER_INDEX.put(`prerender:index:${canonical}`, JSON.stringify(metadata));
}
