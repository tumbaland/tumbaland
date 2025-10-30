import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Album, PaginatedResponse } from '../types';
import { albumService } from '../services/albumService';

const albumKeys = {
  all: ['albums'] as const,
  list: (params: Record<string, unknown>) => [...albumKeys.all, params] as const
};

const normalizeParams = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  isPublic?: boolean;
  groupId?: string;
  includeCover?: boolean;
}) => {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );
};

export const useAlbums = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  isPublic?: boolean;
  groupId?: string;
  includeCover?: boolean;
}) => {
  const queryClient = useQueryClient();

  const memoizedParams = useMemo(
    () => normalizeParams(params),
    [params?.page, params?.limit, params?.search, params?.isPublic, params?.groupId, params?.includeCover]
  );

  const query = useQuery<PaginatedResponse<Album>>({
    queryKey: albumKeys.list(memoizedParams),
    queryFn: () => albumService.getAlbums(memoizedParams),
    placeholderData: keepPreviousData
  });

  const createMutation = useMutation({
    mutationFn: async (albumData: {
      name: string;
      description?: string;
      isPublic?: boolean;
      tags?: string[];
      groupId?: string;
    }) => {
      const response = await albumService.createAlbum(albumData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.all });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Album> }) => {
      const response = await albumService.updateAlbum(id, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: albumKeys.all });
      queryClient.invalidateQueries({ queryKey: ['album', variables.id] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await albumService.deleteAlbum(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: albumKeys.all });
    }
  });

  const pagination = query.data?.pagination ?? {
    page: (memoizedParams.page as number) || 1,
    limit: (memoizedParams.limit as number) || 10,
    total: 0,
    pages: 0
  };

  const errorMessage = query.error instanceof Error ? query.error.message : null;

  return {
    albums: query.data?.albums || [],
    loading: query.isPending,
    isFetching: query.isFetching,
    error: errorMessage,
    pagination,
    fetchAlbums: query.refetch,
    createAlbum: createMutation.mutateAsync,
    updateAlbum: (id: string, data: Partial<Album>) => updateMutation.mutateAsync({ id, data }),
    deleteAlbum: deleteMutation.mutateAsync
  };
};
