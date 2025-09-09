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
  if (payload.artworkType) formData.append('type_id', payload.artworkType);
  if (payload.notes) formData.append('note', payload.notes);
  // Future: send tags as JSON if we map description/materials -> tags
  payload.photos.forEach(file => formData.append('photos', file));
  const resp = await apiService.postRaw<SubmitArtworkResponse>('/artworks/fast', formData);
  return resp;
    } catch (e) {
      return { id: crypto.randomUUID(), message: 'Submission failed offline' };
    }
  },
};
