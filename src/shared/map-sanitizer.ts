// Conservative sanitizer for map/leaflet/mapbox-like event objects.
// Extract only the safe fields used in diagnostics to avoid traversing host objects
// or circular references.

export interface SanitizedLatLng {
  lat: number;
  lng: number;
}

export interface SanitizedBounds {
  northEast?: SanitizedLatLng | undefined;
  southWest?: SanitizedLatLng | undefined;
}

export interface SanitizedMapEvent {
  type?: string;
  center?: SanitizedLatLng | undefined;
  latlng?: SanitizedLatLng | undefined;
  zoom?: number | undefined;
  bounds?: SanitizedBounds | undefined;
  targetId?: string | undefined;
  pointer?: { x?: number | undefined; y?: number | undefined } | undefined;
}

const safeNumber = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const pickLatLng = (obj: any): SanitizedLatLng | undefined => {
  if (!obj || typeof obj !== 'object') return undefined;
  const lat = safeNumber(obj.lat ?? obj.latitude ?? obj[0]);
  const lng = safeNumber(obj.lng ?? obj.longitude ?? obj[1]);
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  return undefined;
};

const pickBounds = (obj: any): SanitizedBounds | undefined => {
  if (!obj || typeof obj !== 'object') return undefined;
  try {
    // Leaflet uses _northEast/_southWest or getNorthEast()/getSouthWest() methods
    const ne = pickLatLng(obj._northEast ?? (obj.getNorthEast && obj.getNorthEast()));
    const sw = pickLatLng(obj._southWest ?? (obj.getSouthWest && obj.getSouthWest()));
    if (ne || sw) {
      const out: SanitizedBounds = {};
      if (ne) out.northEast = ne;
      if (sw) out.southWest = sw;
      return out;
    }
  } catch {
    // ignore host object exceptions
  }
  return undefined;
};

export const sanitizeMapEvent = (ev: unknown): SanitizedMapEvent => {
  if (!ev || typeof ev !== 'object') return {};

  const src: any = ev as any;
  const result: SanitizedMapEvent = {};

  if (typeof src.type === 'string') result.type = src.type;
  const center = pickLatLng(src.center ?? src.target?.getCenter?.());
  if (center) result.center = center;
  const latlng = pickLatLng(src.latlng ?? src.location ?? src.point);
  if (latlng) result.latlng = latlng;
  const zoom = safeNumber(src.zoom ?? src.target?.getZoom?.());
  if (typeof zoom === 'number') result.zoom = zoom;
  const bounds = pickBounds(src.bounds ?? src.target?.getBounds?.());
  if (bounds) result.bounds = bounds;

  // target id: avoid accessing entire DOM node; prefer id if present
  try {
    const tgt = src.target;
    if (tgt && typeof tgt === 'object') {
      if (typeof tgt.id === 'string' && tgt.id.length > 0) result.targetId = tgt.id;
      else if (typeof tgt.getContainer === 'function') {
        const c = tgt.getContainer();
        if (c && typeof c.id === 'string' && c.id.length > 0) result.targetId = c.id;
      }
    }
  } catch {
    // ignore any host exceptions
  }

  // pointer coordinates from original event (mouse/touch) if present
  try {
    const point = src.originalEvent ?? src.originalEvent?.touches?.[0] ?? src.originalEvent ?? src;
    if (point && typeof point === 'object') {
      const x = safeNumber(point.clientX ?? point.x ?? point.pageX);
      const y = safeNumber(point.clientY ?? point.y ?? point.pageY);
      if (typeof x === 'number' || typeof y === 'number') {
        const p: { x?: number; y?: number } = {};
        if (typeof x === 'number') p.x = x;
        if (typeof y === 'number') p.y = y;
        result.pointer = p;
      }
    }
  } catch {
    // ignore
  }

  return result;
};

export default sanitizeMapEvent;
