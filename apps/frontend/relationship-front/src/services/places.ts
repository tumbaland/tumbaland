import { relationshipApi } from './relationshipApi';
import { ApiResponse, GetPlacesFilters, Place, PlaceVisit } from './types';

/**
 * Every distinct place in scope with its visit count — the map's pins, and
 * the day editor's "places you've been" suggestions.
 */
export const getPlaces = async (filters?: GetPlacesFilters): Promise<Place[]> => {
  const params = new URLSearchParams();
  if (filters?.groupId) params.append('groupId', filters.groupId);
  if (filters?.typeId) params.append('typeId', filters.typeId);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await relationshipApi.get<ApiResponse<Place[]>>(
    `/places${params.size ? `?${params.toString()}` : ''}`
  );
  return response.data;
};

/**
 * The individual visits behind one pin, newest first.
 */
export const getPlaceVisits = async (
  lat: number,
  lng: number,
  options?: { groupId?: string; limit?: number }
): Promise<PlaceVisit[]> => {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (options?.groupId) params.append('groupId', options.groupId);
  if (options?.limit) params.append('limit', String(options.limit));

  const response = await relationshipApi.get<ApiResponse<PlaceVisit[]>>(
    `/places/visits?${params.toString()}`
  );
  return response.data;
};
