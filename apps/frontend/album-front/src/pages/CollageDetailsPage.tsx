
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import AlbumPhotoList, { AlbumPhoto } from '../components/AlbumPhotoList';
import CollageMenu from '../components/CollageMenu';
import CollageLayout from '../components/collage/CollageLayout';
// import { Rnd } from 'react-rnd';
import { Collage } from '../types/collage';
import { useCollage } from '../hooks/useCollage';

// AlbumPhoto type imported from AlbumPhotoList

interface CanvasPhoto {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  caption?: string;
}

const CollageDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getCollage, updateCollage } = useCollage();
  const [collage, setCollage] = useState<Collage | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [canvasPhotos, setCanvasPhotos] = useState<CanvasPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Caption edit state
  const [captionEditIdx, setCaptionEditIdx] = useState<number | null>(null);
  const [captionEditValue, setCaptionEditValue] = useState('');

  // Save canvas state to backend
  // Open caption edit dialog
  const handlePhotoDoubleClick = (idx: number) => {
    let currentCaption = '';
    if (collage?.config?.photos && collage.config.photos[idx] && collage.config.photos[idx].caption) {
      currentCaption = collage.config.photos[idx].caption;
    }
    setCaptionEditIdx(idx);
    setCaptionEditValue(currentCaption);
  };


  // Save caption edit
  const handleCaptionSave = () => {
    if (captionEditIdx === null) return;
    setCanvasPhotos((prev) =>
      prev.map((p, idx) =>
        idx === captionEditIdx
          ? { ...p, caption: captionEditValue }
          : p
      )
    );
    // Also update collage.config.photos in memory for immediate UI feedback
    if (collage && collage.config && collage.config.photos && collage.config.photos[captionEditIdx]) {
      collage.config.photos[captionEditIdx].caption = captionEditValue;
      setCollage({ ...collage });
    }
    setCaptionEditIdx(null);
    setCaptionEditValue('');
  };

  // Delete photo from canvas
  const handleDeletePhoto = () => {
    if (captionEditIdx === null) return;
    setCanvasPhotos((prev) => prev.filter((_, idx) => idx !== captionEditIdx));
    // Also update collage.config.photos in memory for immediate UI feedback
    if (collage && collage.config && collage.config.photos) {
      collage.config.photos.splice(captionEditIdx, 1);
      setCollage({ ...collage });
    }
    setCaptionEditIdx(null);
    setCaptionEditValue('');
  };

  const handleCaptionCancel = () => {
    setCaptionEditIdx(null);
    setCaptionEditValue('');
  };
  const handleSave = async () => {
    if (!collage) return;
    setSaving(true);
    try {
      // Save photo layout info and captions to config.photos
      const photos = canvasPhotos.map((p, idx) => ({
        filename: p.src,
        position: { left: p.x, top: p.y },
        width: p.width,
        height: p.height,
        rotation: p.rotation || 0,
        caption:
          // Prefer caption from canvasPhotos, fallback to collage.config.photos if present
          (p.caption !== undefined ? p.caption : (collage?.config?.photos && collage.config.photos[idx]?.caption) || '')
      }));
      await updateCollage(collage._id, {
        ...collage,
        config: {
          ...collage.config,
          photos,
        },
        albumId: collage.albumId,
      });
    } catch (e) {
      setError('Failed to save collage');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    // Fetch collage and album photos (backend returns both)
    getCollage(id)
      .then((data: any) => {
        if (data && data.collage) {
          setCollage(data.collage);
          setAlbumPhotos(data.albumPhotos || []);
          // Load initial canvas photos from config if present
          if (data.collage.config?.photos) {
            setCanvasPhotos(
              data.collage.config.photos.map((p: any, idx: number) => ({
                id: p.filename + '-' + idx,
                src: p.filename,
                x: p.position?.left || 100,
                y: p.position?.top || 100,
                width: p.width || 120,
                height: p.height || 120,
                rotation: p.rotation || 0
              }))
            );
          }
        }
      })
      .catch(() => setError('Failed to load collage'))
      .finally(() => setLoading(false));
  }, [id, getCollage]);

  // Add photo from album to canvas
  const handleAddPhoto = (photo: AlbumPhoto) => {
    setCanvasPhotos((prev) => [
      ...prev,
      {
        id: photo._id + '-' + Date.now(),
        src: photo.signedUrl,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        width: photo.width || 120,
        height: photo.height || 120,
        rotation: 0
      }
    ]);
  };

  // Custom drag/resize state
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizePhotoId, setResizePhotoId] = useState<string | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Start drag or resize mode on click
  const handlePhotoClick = (id: string, e: React.MouseEvent<HTMLImageElement, MouseEvent>, photo: CanvasPhoto) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    // Center 60% triggers drag, edges trigger resize
    const edgeThreshold = 0.2; // 20% on each side
    const xPercent = offsetX / rect.width;
    const yPercent = offsetY / rect.height;
    const isEdge = xPercent < edgeThreshold || xPercent > 1 - edgeThreshold || yPercent < edgeThreshold || yPercent > 1 - edgeThreshold;
    if (isEdge) {
      // Start resize mode
      setResizePhotoId(id);
      setResizeOrigin({ x: e.clientX, y: e.clientY });
      setResizeStart({ width: photo.width, height: photo.height });
    } else {
      // Start/stop drag mode
      if (dragPhotoId === id) {
        setDragPhotoId(null);
        setDragOffset({ x: 0, y: 0 });
      } else {
        setDragPhotoId(id);
        setDragOffset({
          x: e.clientX - photo.x,
          y: e.clientY - photo.y
        });
      }
    }
  };

  // Move photo with mouse when in drag mode
  useEffect(() => {
    if (!dragPhotoId) return;
    const handleMouseMove = (e: MouseEvent) => {
      setCanvasPhotos((prev) =>
        prev.map((p) =>
          p.id === dragPhotoId
            ? { ...p, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
            : p
        )
      );
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragPhotoId, dragOffset]);

  // Resize photo with mouse when in resize mode
  useEffect(() => {
    if (!resizePhotoId) return;
    const handleMouseMove = (e: MouseEvent) => {
      setCanvasPhotos((prev) =>
        prev.map((p) =>
          p.id === resizePhotoId
            ? {
                ...p,
                width: Math.max(40, resizeStart.width + (e.clientX - resizeOrigin.x)),
                height: Math.max(40, resizeStart.height + (e.clientY - resizeOrigin.y)),
              }
            : p
        )
      );
    };
    const handleMouseUp = () => {
      setResizePhotoId(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizePhotoId, resizeOrigin, resizeStart]);

  return (
    <CollageLayout>
      <Box sx={{ position: 'absolute', top: 16, right: 24, zIndex: 20 }}>
        <CollageMenu onSave={handleSave} disabled={saving || loading || !collage} />
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : collage ? (
        <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
          {/* Sidebar: Album Photos */}
          <Box sx={{ width: 110, bgcolor: '#222', color: '#fff', p: 2, borderRight: '1px solid #333', overflowY: 'auto' }}>
            <AlbumPhotoList photos={albumPhotos} onPhotoClick={handleAddPhoto} />
          </Box>
          {/* Canvas Area */}
          <Box sx={{ flex: 1, position: 'relative', bgcolor: '#111', overflow: 'auto' }}>
            {/* Canvas background and photos */}
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              {canvasPhotos.map((photo, idx) => {
                // Try to get caption from canvasPhotos first, then collage.config.photos if available
                let caption = photo.caption;
                if (!caption && collage?.config?.photos && collage.config.photos[idx] && collage.config.photos[idx].caption) {
                  caption = collage.config.photos[idx].caption;
                }
                return (
                  <Box
                    key={photo.id}
                    sx={{
                      position: 'absolute',
                      left: photo.x,
                      top: photo.y,
                      width: photo.width,
                      height: photo.height,
                      zIndex: 2,
                      border: '2px solid #fff',
                      borderRadius: 2,
                      background: '#222',
                      cursor:
                        dragPhotoId === photo.id
                          ? 'grabbing'
                          : resizePhotoId === photo.id
                          ? 'nwse-resize'
                          : 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                      <img
                        src={photo.src}
                        alt="collage"
                        onMouseDown={e => handlePhotoClick(photo.id, e, photo)}
                        onDoubleClick={() => handlePhotoDoubleClick(idx)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, cursor: dragPhotoId === photo.id ? 'grabbing' : resizePhotoId === photo.id ? 'nwse-resize' : 'pointer' }}
                        draggable={false}
                      />
                      {/* Optional: show resize handle at bottom-right corner visually */}
                      <Box
                        sx={{
                          position: 'absolute',
                          right: 0,
                          bottom: 0,
                          width: 16,
                          height: 16,
                          opacity: 0.7,
                          borderRadius: 1,
                          cursor: 'nwse-resize',
                          zIndex: 10,
                          display: 'block',
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          setResizePhotoId(photo.id);
                          setResizeOrigin({ x: e.clientX, y: e.clientY });
                          setResizeStart({ width: photo.width, height: photo.height });
                        }}
                      />
                      {caption && (
                        <Typography variant="caption" sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.6)', px: 0.5, borderRadius: 1, mt: 0.5, maxWidth: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {caption}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
      {/* Caption Edit Dialog */}
      <Dialog open={captionEditIdx !== null} onClose={handleCaptionCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Photo</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Caption"
            fullWidth
            value={captionEditValue}
            onChange={e => setCaptionEditValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeletePhoto} color="error">Delete</Button>
          <Button onClick={handleCaptionCancel}>Cancel</Button>
          <Button onClick={handleCaptionSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
            </Box>
          </Box>
        </Box>
      ) : (
        <Typography>No collage found.</Typography>
      )}
    </CollageLayout>
  );
};

export default CollageDetailsPage;
