import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Photo, PaginatedResponse } from '../types';
import { photoService } from '../services/photoService';

const photoKeys = {
  all: ['photos'] as const,
  album: (albumId: string) => [...photoKeys.all, albumId] as const,
  list: (albumId: string, params: Record<string, unknown>) => [...photoKeys.album(albumId), params] as const
};

const normalizeParams = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );
};

export const usePhotos = (
  albumId: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
  }
) => {
  const queryClient = useQueryClient();
  const memoizedParams = useMemo(
    () => normalizeParams(params),
    [params?.page, params?.limit, params?.search]
  );

  const query = useQuery<PaginatedResponse<Photo>>({
    queryKey: photoKeys.list(albumId, memoizedParams),
    queryFn: () => photoService.loadPhotosWithThumbnails(albumId, memoizedParams),
    enabled: Boolean(albumId),
    placeholderData: keepPreviousData
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Photo> }) => {
      return await photoService.updatePhoto(id, data);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: photoKeys.album(albumId) });
      queryClient.invalidateQueries({ queryKey: ['photo', variables.id] });
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
