import { apiService } from './api';
// Use shared consent version constant so backend validation matches
import { CONSENT_VERSION } from '../../../shared/consent';

interface SubmitArtworkRequest {
  userToken: string;
  title?: string; // optional in fast workflow
  description?: string;
  artist?: string;
  materials?: string;
  artworkType?: string;
  access?: string;
  condition: string;
  latitude: number;
  longitude: number;
  notes?: string;
  photos: File[];
}

interface SubmitArtworkResponse {
  id: string;
  message?: string | null;
  status?: string | null;
}

// Uses fast artwork submission endpoint when title provided, fallback to basic logbook if not.
export const artworkSubmissionService = {
  async submitArtwork(payload: SubmitArtworkRequest): Promise<SubmitArtworkResponse> {
    try {
      // Always attempt fast workflow endpoint (supports optional title & multipart now)
      const formData = new FormData();
      formData.append('lat', payload.latitude.toString());
      formData.append('lon', payload.longitude.toString());
      formData.append('consent_version', CONSENT_VERSION);
      if (payload.title) formData.append('title', payload.title);
      if (payload.notes) formData.append('notes', payload.notes);
      // Build lightweight structured tags from provided optional metadata so backend can retain it later
      const tagPayload: Record<string, string | number> = {};
      if (payload.artworkType) tagPayload.artwork_type = payload.artworkType;
      if (payload.description) tagPayload.description = payload.description;
      if (payload.artist) tagPayload.artist_name = payload.artist;
      if (payload.materials) tagPayload.material = payload.materials; // singular consistent with schema
      if (payload.access) tagPayload.access = payload.access; // expects yes/no or public/private mapping later
      if (payload.condition) tagPayload.condition = payload.condition;
      if (Object.keys(tagPayload).length > 0) {
        try {
          formData.append('tags', JSON.stringify(tagPayload));
        } catch (err) {
          // Non-fatal; continue without tags
          console.warn('[FAST SUBMIT] Failed to serialize tags payload', err);
        }
      }

      // Photos
      payload.photos.forEach(file => formData.append('photos', file));

      interface FastSubmitApiEnvelope {
        success?: boolean;
        message?: string | null;
        data?: {
          id?: string;
          submission_type?: 'new_artwork' | 'logbook_entry';
          status?: string;
          message?: string;
          artwork_id?: string;
        };
      }
      const raw = await apiService.postRaw<FastSubmitApiEnvelope>('/artworks/fast', formData);
      // Expected shape: { success: boolean, data: { id, submission_type, artwork_id? ... }, message }
      const data: FastSubmitApiEnvelope['data'] | undefined = raw?.data;
      const resolvedId = data?.artwork_id || data?.id;
      if (!resolvedId) {
        console.warn('[FAST SUBMIT] API response missing artwork/logbook id', raw);
      }
      return {
        id: resolvedId || 'unknown',
        message: data?.message ?? raw?.message ?? null,
        status: data?.status ?? null,
      };
    } catch (e) {
      console.error('[FAST SUBMIT] Submission failed', e);
      return { id: crypto.randomUUID(), message: 'Submission failed offline' };
    }
  },
};
