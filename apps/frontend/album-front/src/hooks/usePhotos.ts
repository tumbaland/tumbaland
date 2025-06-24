import { useState, useEffect } from 'react';
import { Photo } from '../types';
import { photoService } from '../services/photoService';

export const usePhotos = (albumId: string, params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const fetchPhotos = async () => {
    if (!albumId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await photoService.getPhotosByAlbum(albumId, params);
      setPhotos(response.data.photos || []);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [albumId, params?.page, params?.limit, params?.search]);

  const updatePhoto = async (id: string, photoData: Partial<Photo>) => {
    try {
      const response = await photoService.updatePhoto(id, photoData);
      await fetchPhotos(); // Refresh the list
      return response.data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update photo');
    }
  };

  const deletePhoto = async (id: string) => {
    try {
      await photoService.deletePhoto(id);
      await fetchPhotos(); // Refresh the list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete photo');
    }
  };

  return {
    photos,
    loading,
    error,
    pagination,
    fetchPhotos,
    updatePhoto,
    deletePhoto
  };
};
