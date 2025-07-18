import { useState } from 'react';
import { Photo } from '../types';

export const usePhotoViewer = (photos: Photo[]) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const handleViewPhoto = (photo: Photo) => {
    const photoIndex = photos.findIndex((p) => p._id === photo._id);
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(photoIndex);
    setShowPhotoViewer(true);
  };

  const handlePreviousPhoto = () => {
    if (selectedPhotoIndex > 0) {
      const newIndex = selectedPhotoIndex - 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  };

  const handleNextPhoto = () => {
    if (selectedPhotoIndex < photos.length - 1) {
      const newIndex = selectedPhotoIndex + 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  };

  const handleClosePhotoViewer = () => {
    setShowPhotoViewer(false);
    setSelectedPhoto(null);
    setSelectedPhotoIndex(0);
  };

  return {
    selectedPhoto,
    selectedPhotoIndex,
    showPhotoViewer,
    handleViewPhoto,
    handlePreviousPhoto,
    handleNextPhoto,
    handleClosePhotoViewer
  };
};
