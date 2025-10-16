import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

export interface FetchCacheOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
}

/**
 * Fetch an image URL and store it in a local cache directory. If the image
 * is already cached, returns the existing path immediately.
 *
 * Returns the absolute path to the cached file, or null if the image could
 * not be downloaded or validated.
 */
export async function fetchImageToCache(
  url: string,
  cacheDir: string,
  opts: FetchCacheOptions = {}
): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxSizeBytes = opts.maxSizeBytes ?? 15 * 1024 * 1024; // 15MB default

  // Ensure cache directory exists
  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch (err) {
    // ignore, will catch on write
  }

  // Use a hash of the URL for stable unique filenames
  const hash = crypto.createHash('sha1').update(url).digest('hex');

  // Try to use URL basename for nicer filenames, but fall back to hash
  let ext = '';
  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname || '');
    if (base && base.includes('.')) {
      ext = path.extname(base);
    }
  } catch {
    // ignore invalid URL
  }

  const filename = `${hash}${ext || '.jpg'}`;
  const fullPath = path.resolve(cacheDir, filename);

  // If file exists, return it
  try {
    await fs.access(fullPath);
    // Cache hit
    // Use console.debug so normal runs stay quieter but tests can show hits
    console.debug(`[photo-cache] cache hit: ${fullPath} (url=${url})`);
    return fullPath;
  } catch (err) {
    // not found, proceed to download
  }

  // Download the image
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      maxContentLength: maxSizeBytes,
      headers: {
        'User-Agent': 'mass-import-photo-cache/1.0',
      },
      validateStatus: status => status >= 200 && status < 400,
    });

    const contentType = (response.headers && (response.headers as any)['content-type']) || '';
    if (!contentType || !String(contentType).toLowerCase().startsWith('image/')) {
      return null;
    }

    // Determine extension from content type if we don't have one
    if (!ext) {
      const ct = String(contentType).toLowerCase();
      if (ct.includes('jpeg') || ct.includes('jpg')) ext = '.jpg';
      else if (ct.includes('png')) ext = '.png';
      else if (ct.includes('webp')) ext = '.webp';
      else if (ct.includes('heic')) ext = '.heic';
      else ext = '.jpg';
    }

    // If filename didn't include ext originally, adjust
    const finalFilename = filename.endsWith(ext) ? filename : `${hash}${ext}`;
    const finalPath = path.resolve(cacheDir, finalFilename);

    await fs.writeFile(finalPath, Buffer.from(response.data));
    console.debug(`[photo-cache] downloaded and cached: ${finalPath} (url=${url})`);

    return finalPath;
  } catch (error) {
    // Download failed or validation failed
    return null;
  }
}
