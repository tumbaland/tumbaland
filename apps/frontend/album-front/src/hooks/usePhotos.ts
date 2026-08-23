import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Photo, PaginatedResponse } from '../types';
import { photoService, PhotoQueryParams } from '../services/photoService';
import { albumTagKeys } from './useAlbumTags';

const photoKeys = {
  all: ['photos'] as const,
  album: (albumId: string) => [...photoKeys.all, albumId] as const,
  list: (albumId: string, params: Record<string, unknown>) => [...photoKeys.album(albumId), params] as const
};

const normalizeParams = (params?: PhotoQueryParams) => {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      // An empty tag selection means "no filter" — keep it out of the query key
      // so clearing the filter reuses the unfiltered result already in cache.
      return !(Array.isArray(value) && value.length === 0);
    })
  );
};

export interface UsePhotosOptions {
  /** Skip the fetch entirely (on top of the albumId check). Default true. */
  enabled?: boolean;
}

export const usePhotos = (albumId: string, params?: PhotoQueryParams, options?: UsePhotosOptions) => {
  const queryClient = useQueryClient();
  const tagsKey = params?.tags?.join(',');
  const memoizedParams = useMemo(
    () => normalizeParams(params),
    [params?.page, params?.limit, params?.search, tagsKey, params?.tagMatch]
  );

  const query = useQuery<PaginatedResponse<Photo>>({
    queryKey: photoKeys.list(albumId, memoizedParams),
    queryFn: () => photoService.loadPhotosWithThumbnails(albumId, memoizedParams as PhotoQueryParams),
    enabled: Boolean(albumId) && options?.enabled !== false,
    placeholderData: keepPreviousData
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Photo> }) => {
      return await photoService.updatePhoto(id, data);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: photoKeys.album(albumId) });
      queryClient.invalidateQueries({ queryKey: ['photo', variables.id] });
      // An edit that touched tags changes the album's vocabulary and what the
      // filter row shows counts for.
      if (variables.data.tags) {
        queryClient.invalidateQueries({ queryKey: albumTagKeys.album(albumId) });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await photoService.deletePhoto(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.album(albumId) });
      queryClient.invalidateQueries({ queryKey: ['album', albumId] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
    }
  });

  const pagination = query.data?.pagination ?? {
    page: (memoizedParams.page as number) || 1,
    limit: (memoizedParams.limit as number) || 20,
    total: 0,
    pages: 0
  };

  const errorMessage = query.error instanceof Error ? query.error.message : null;

  return {
    photos: query.data?.photos || [],
    loading: query.isPending,
    error: errorMessage,
    pagination,
    fetchPhotos: query.refetch,
    updatePhoto: (id: string, data: Partial<Photo>) => updateMutation.mutateAsync({ id, data }),
    deletePhoto: deleteMutation.mutateAsync
  };
};
