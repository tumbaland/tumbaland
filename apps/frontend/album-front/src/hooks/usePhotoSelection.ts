import { useState } from 'react';
import type { Photo } from '../types';

/**
 * Picking several photos in an album to act on together: the mode, what is
 * picked, and deleting the lot. What to do with the pick (tag it, say) stays
 * with the page.
 */
export const usePhotoSelection = (photos: Photo[], deletePhoto: (id: string) => Promise<unknown>) => {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  /** Leaves select mode and forgets the pick. */
  const endSelection = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelectPhoto = (photo: Photo) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photo._id)) next.delete(photo._id);
      else next.add(photo._id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedIds(new Set(photos.map((p) => p._id)));
  };

  const confirmBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deletePhoto(id)));
      setShowBulkDeleteDialog(false);
      endSelection();
    } catch {
      alert('Failed to delete some photos');
    } finally {
      setBulkDeleting(false);
    }
  };

  return {
    selectMode,
    selectedIds,
    showBulkDeleteDialog,
    setShowBulkDeleteDialog,
    bulkDeleting,
    endSelection,
    toggleSelectMode,
    toggleSelectPhoto,
    selectAllOnPage,
    confirmBulkDelete
  };
};
