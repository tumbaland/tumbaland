import { useState, useEffect, useMemo, useCallback } from 'react';
import { Album } from '../types';
import { albumService } from '../services/albumService';

export const useAlbums = (params?: { page?: number; limit?: number; search?: string; isPublic?: boolean; groupId?: string }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Memoize params to prevent unnecessary re-renders
  const memoizedParams = useMemo(() => params, [params?.page, params?.limit, params?.search, params?.isPublic, params?.groupId]);

  const fetchAlbums = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await albumService.getAlbums(memoizedParams);
      setAlbums(response.data.albums || []);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch albums');
    } finally {
      setLoading(false);
    }
  }, [memoizedParams]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const createAlbum = async (albumData: {
    name: string;
    description?: string;
    isPublic?: boolean;
    tags?: string[];
    groupId?: string;
  }) => {
    try {
      const response = await albumService.createAlbum(albumData);
      await fetchAlbums(); // Refresh the list
      return response.data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create album');
    }
  };

  const updateAlbum = async (id: string, albumData: Partial<Album>) => {
    try {
      const response = await albumService.updateAlbum(id, albumData);
      await fetchAlbums(); // Refresh the list
      return response.data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update album');
    }
  };

  const deleteAlbum = async (id: string) => {
    try {
      await albumService.deleteAlbum(id);
      await fetchAlbums(); // Refresh the list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete album');
    }
  };

  return {
    albums,
    loading,
    error,
    pagination,
    fetchAlbums,
    createAlbum,
    updateAlbum,
    deleteAlbum
  };
};
