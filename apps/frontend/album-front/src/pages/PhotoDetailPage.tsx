import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@tumbaland/frontend-core';
import {
  Box,
  Container,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import { useParams, useNavigate } from 'react-router';
import { Photo, Album } from '../types';
import { albumService } from '../services/albumService';
import { photoService } from '../services/photoService';
import { usePhotos } from '../hooks/usePhotos';
import { useAlbumTags, albumTagKeys } from '../hooks/useAlbumTags';
import { downloadPhoto } from '../utils/downloadPhoto';
import EditPhotoDialog from '../components/EditPhotoDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import PhotoDetailHeader from '../components/photo-detail/PhotoDetailHeader';
import PhotoBasicInfo from '../components/photo-detail/PhotoBasicInfo';

const PhotoDetailPage: React.FC = () => {
  const { albumId, photoId } = useParams<{ albumId: string; photoId: string }>();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const queryClient = useQueryClient();

  // Full, unpaginated album photo order — used to find the previous/next photo
  const { photos: albumPhotos } = usePhotos(albumId || '');
  const { tags: albumTags } = useAlbumTags(albumId || '');
  const currentPhotoIndex = albumPhotos.findIndex((p) => p._id === photoId);
  const previousPhoto = currentPhotoIndex > 0 ? albumPhotos[currentPhotoIndex - 1] : null;
  const nextPhoto =
    currentPhotoIndex >= 0 && currentPhotoIndex < albumPhotos.length - 1
      ? albumPhotos[currentPhotoIndex + 1]
      : null;

  const goToPhoto = (targetPhotoId: string) => {
    navigate(`/albums/${albumId}/photos/${targetPhotoId}`);
  };
  const handlePreviousPhoto = () => previousPhoto && goToPhoto(previousPhoto._id);
  const handleNextPhoto = () => nextPhoto && goToPhoto(nextPhoto._id);

  // Keyboard navigation, mirrors the quick-view PhotoViewer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showEditDialog || showDeleteDialog) return;

      if (event.key === 'ArrowLeft' && previousPhoto) {
        event.preventDefault();
        navigate(`/albums/${albumId}/photos/${previousPhoto._id}`);
      } else if (event.key === 'ArrowRight' && nextPhoto) {
        event.preventDefault();
        navigate(`/albums/${albumId}/photos/${nextPhoto._id}`);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [previousPhoto, nextPhoto, showEditDialog, showDeleteDialog, navigate, albumId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!albumId || !photoId) return;
      try {
        setLoading(true);
        const [photoResponse, albumResponse] = await Promise.all([
          photoService.getPhotoById(photoId),
          albumService.getAlbumById(albumId)
        ]);
        setPhoto(photoResponse);
        setAlbum(albumResponse);
      } catch (err) {
        setError('Failed to load photo details');
        logger.error('Error fetching photo details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [albumId, photoId]);

  const handleEdit = () => setShowEditDialog(true);
  const handleDelete = () => setShowDeleteDialog(true);

  const handleConfirmDelete = async () => {
    if (!photo || !albumId) return;
    setDeleting(true);
    try {
      await photoService.deletePhoto(photo._id);
      navigate(`/albums/${albumId}`);
    } catch (err) {
      alert('Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };


  // This page holds the photo in local state, so the album's cached lists (and
  // its tag vocabulary) would otherwise keep showing the pre-edit values when
  // the user navigates back.
  const invalidatePhotoCaches = (tagsChanged: boolean) => {
    if (!albumId) return;
    queryClient.invalidateQueries({ queryKey: ['photos', albumId] });
    if (tagsChanged) {
      queryClient.invalidateQueries({ queryKey: albumTagKeys.album(albumId) });
    }
  };

  const handleSaveEdit = async (photoId: string, data: { title?: string; description?: string; tags?: string[] }) => {
    try {
      const response = await photoService.updatePhoto(photoId, data);
      setPhoto(response);
      invalidatePhotoCaches(data.tags !== undefined);
      setShowEditDialog(false);
    } catch (err) {
      logger.error('Failed to update photo', err);
      alert('Failed to update photo');
    }
  };


  const handleSaveTags = async (tags: string[]) => {
    if (!photo) return;
    const response = await photoService.updatePhoto(photo._id, { tags });
    setPhoto(response);
    invalidatePhotoCaches(true);
  };

  const handleDownload = () => {
    if (!photo) return;
    downloadPhoto(photo);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !photo || !album) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Photo not found'}</Alert>
        <Button onClick={() => navigate(`/albums/${albumId}`)} sx={{ mt: 2 }}>
          Back to Album
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
      <PhotoDetailHeader
        photo={photo}
        album={album}
        onNavigate={navigate}
        onDownload={handleDownload}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPrevious={handlePreviousPhoto}
        onNext={handleNextPhoto}
        hasPrevious={Boolean(previousPhoto)}
        hasNext={Boolean(nextPhoto)}
        photoPosition={
          currentPhotoIndex >= 0 ? { index: currentPhotoIndex + 1, total: albumPhotos.length } : undefined
        }
      />

      {/* Main Content */}
      <Box
        sx={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          p: { xs: 2, sm: 3 }
        }}
      >
        <PhotoBasicInfo
          photo={photo}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          onSwipeNext={nextPhoto ? handleNextPhoto : undefined}
          onSwipePrevious={previousPhoto ? handlePreviousPhoto : undefined}
          tagSuggestions={albumTags}
          onSaveTags={handleSaveTags}
        />
      </Box>
      {/* Edit Dialog */}
      <EditPhotoDialog
        open={showEditDialog}
        photo={photo}
        suggestions={albumTags}
        onClose={() => setShowEditDialog(false)}
        onSave={handleSaveEdit}
      />
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} onConfirm={handleConfirmDelete} title="Delete Photo" message="Are you sure you want to delete this photo? This action cannot be undone." confirmText="Delete Photo" cancelText="Cancel" variant="danger" loading={deleting} />
    </Container>
  );
};

export default PhotoDetailPage;
