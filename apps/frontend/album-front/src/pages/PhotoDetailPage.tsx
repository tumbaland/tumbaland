import React, { useState, useEffect } from 'react';
import { logger } from '@tumbaland/frontend-core';
import {
  Box,
  Container,
  Button,
  Alert,
  CircularProgress,
  Tab,
  Tabs
} from '@mui/material';
import {
  SmartToy as SmartToyIcon,
  ViewInAr as ViewInArIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { Photo, Album } from '../types';
import { albumService } from '../services/albumService';
import { photoService } from '../services/photoService';
import { usePhotos } from '../hooks/usePhotos';
import EditPhotoDialog from '../components/EditPhotoDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import SegmentationView from '../components/SegmentationView';
import ObjectDetectionView from '../components/ObjectDetectionView';
import PhotoDetailHeader from '../components/photo-detail/PhotoDetailHeader';
import PhotoBasicInfo from '../components/photo-detail/PhotoBasicInfo';
import TabPanel from '../components/photo-detail/TabPanel';

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
  const [tabValue, setTabValue] = useState(0);

  // Full, unpaginated album photo order — used to find the previous/next photo
  const { photos: albumPhotos } = usePhotos(albumId || '');
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

  // Refetch photo after analysis completes
  const refetchPhoto = async () => {
    if (!photoId) return;
    try {
      const photoResponse = await photoService.getPhotoById(photoId);
      setPhoto(photoResponse);
    } catch (err) {
      setError('Failed to reload photo after analysis');
    }
  };

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

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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

  const handleSaveEdit = async (photoId: string, data: { title?: string; description?: string }) => {
    try {
      const response = await photoService.updatePhoto(photoId, data);
      setPhoto(response);
      setShowEditDialog(false);
    } catch (err) {
      logger.error('Failed to update photo', err);
      alert('Failed to update photo');
    }
  };

  const handleDownload = async () => {
    if (!photo || !photo.signedUrl) return;
    
    try {
      const response = await fetch(photo.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.originalName || `photo-${photo._id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Download failed', error);
      window.open(photo.signedUrl, '_blank');
    }
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

      {/* Main Content with Tabs */}
      <Box
        sx={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        {/* Main Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                minHeight: 64
              }
            }}
          >
            <Tab label="Basic Info" icon={<InfoIcon />} iconPosition="start" />
            <Tab label="Object Detection" icon={<SmartToyIcon />} iconPosition="start" />
            <Tab label="Segmentation" icon={<ViewInArIcon />} iconPosition="start" />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={0}>
          <PhotoBasicInfo
            photo={photo}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
          />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <ObjectDetectionView
            photo={photo}
            formatDate={formatDate}
            onAnalysisComplete={refetchPhoto}
          />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <SegmentationView
            photo={photo}
            formatDate={formatDate}
            onAnalysisComplete={refetchPhoto}
          />
        </TabPanel>
      </Box>
      {/* Edit Dialog */}
      <EditPhotoDialog open={showEditDialog} photo={photo} onClose={() => setShowEditDialog(false)} onSave={handleSaveEdit} />
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} onConfirm={handleConfirmDelete} title="Delete Photo" message="Are you sure you want to delete this photo? This action cannot be undone." confirmText="Delete Photo" cancelText="Cancel" variant="danger" loading={deleting} />
    </Container>
  );
};

export default PhotoDetailPage;
