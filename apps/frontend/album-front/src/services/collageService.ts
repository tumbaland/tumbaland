import { Collage, CollageInput } from '../types/collage';
import type { ServerChange } from '../components/collage/collageChanges';
import type { MovingItem } from '../hooks/useCollageMotion';
import { albumApi } from './albumApi';
import { getGlobalConfig } from '../config/ConfigProvider';
import { ApiResponse, Photo } from '../types';

export const collageService = {
  // Create a new collage
  async createCollage(collageData: CollageInput): Promise<Collage> {
    const response = await albumApi.post<ApiResponse<Collage>>('/collages', collageData);
    return response.data; // New format: { success: true, data: collage }
  },

  // Get all collages with optional filtering
  async getCollages(params?: { albumId?: string; groupId?: string }): Promise<Collage[]> {
    const searchParams = new URLSearchParams();
    if (params?.albumId) searchParams.set('albumId', params.albumId);
    if (params?.groupId) searchParams.set('groupId', params.groupId);

    const response = await albumApi.get<ApiResponse<Collage[]>>(`/collages?${searchParams.toString()}`);
    return response.data; // New format: { success: true, data: [...] }
  },

  // Get collage by ID (returns collage and albumPhotos)
  async getCollageById(id: string): Promise<{ collage: Collage; albumPhotos: Photo[] }> {
    const response = await albumApi.get<ApiResponse<{ collage: Collage; photos: Photo[] }>>(`/collages/${id}`);
    const { collage, photos } = response.data;
    return { collage, albumPhotos: photos }; // New format: { success: true, data: { collage, photos } }
  },

  // Update collage. Leave `config` out to change only the collage's details:
  // with someone editing it, a whole config would overwrite their work.
  async updateCollage(id: string, collageData: Partial<CollageInput>): Promise<Collage> {
    const response = await albumApi.put<ApiResponse<Collage>>(`/collages/${id}`, collageData);
    return response.data; // New format: { success: true, data: collage }
  },

  // Apply a batch of small changes (autosave). Answers with the new revision.
  async applyChanges(id: string, changes: ServerChange[], session?: string): Promise<{ revision: number }> {
    const response = await albumApi.post<ApiResponse<{ revision: number }>>(`/collages/${id}/changes`, {
      changes,
      ...(session ? { session } : {})
    });
    return response.data;
  },

  // What this tab has selected, for the others to see outlined.
  async setPresence(id: string, session: string, selection: string | null): Promise<void> {
    await albumApi.post(`/collages/${id}/presence`, { session, selection });
  },

  // Where an item is while this tab drags it (null: let go). Not saved.
  async reportMoving(id: string, session: string, item: MovingItem | null): Promise<void> {
    await albumApi.post(`/collages/${id}/moving`, { session, item });
  },

  // The live stream of what others with this collage open are doing.
  liveUrl(id: string, session: string): string {
    return `${getGlobalConfig().ALBUM_API_URL}/api/collages/${encodeURIComponent(id)}/live?session=${encodeURIComponent(session)}`;
  },

  // Delete collage
  async deleteCollage(id: string): Promise<void> {
    await albumApi.delete(`/collages/${id}`);
  }
};
