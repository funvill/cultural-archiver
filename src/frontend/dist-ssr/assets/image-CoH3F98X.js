import 'exifr';
import { g as getApiBaseUrl } from '../ssr-entry-server.js';

function getImageSizedURL(originalUrl, size = "original") {
  if (size === "original") return originalUrl;
  let cleanUrl = originalUrl;
  if (originalUrl.startsWith("http://") || originalUrl.startsWith("https://") || originalUrl.startsWith("//")) {
    const allowedPrefixes = ["originals/", "photos/", "artworks/", "submissions/"];
    for (const prefix of allowedPrefixes) {
      const idx = originalUrl.indexOf(prefix);
      if (idx >= 0) {
        cleanUrl = originalUrl.substring(idx);
        break;
      }
    }
  } else {
    cleanUrl = originalUrl.replace(/^\//, "");
  }
  const apiBaseUrl = getApiBaseUrl();
  return `${apiBaseUrl}/images/${size}/${cleanUrl}`;
}

export { getImageSizedURL as g };
//# sourceMappingURL=image-CoH3F98X.js.map
