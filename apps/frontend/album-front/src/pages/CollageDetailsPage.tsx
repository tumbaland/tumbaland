import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Typography
} from '@mui/material';
import { CanvasText } from '../components/collage/DraggableTextBox';
import { AlbumPhoto } from '../components/collage/AlbumPhotoList';
import CollageMenu from '../components/collage/CollageMenu';
import CollageLayout from '../components/collage/CollageLayout';
import CollagePhotoEditModal from '../components/collage/CollagePhotoEditModal';
import CollageCanvas from '../components/collage/CollageCanvas';
import CollageSidebar from '../components/collage/CollageSidebar';
import CollageTextEditor from '../components/collage/CollageTextEditor';
import { CanvasPhoto } from '../components/collage/CollageCanvasPhoto';
import { Collage } from '../types/collage';
import { useCollageDetails, useCollageMutations } from '../hooks/useCollage';

const CollageDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get('mode') || 'edit';
  const isViewMode = mode === 'view';
  const collageQuery = useCollageDetails(id);
  const { updateCollage } = useCollageMutations();
  const isLoading = collageQuery.isPending;
  const loadError = collageQuery.error ? 'Failed to load collage' : null;
  const [collage, setCollage] = useState<Collage | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [canvasPhotos, setCanvasPhotos] = useState<CanvasPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const displayError = error || loadError;
  const [saving, setSaving] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState<string>('#111');
  const [photoTransparencyMode, setPhotoTransparencyMode] = useState<boolean>(true);
  const [borderColor, setBorderColor] = useState<string>('#fff');
  
  // Viewport state: initialize from browser window size
  const getInitialViewport = () => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 1200, height: 800 };
  };
  const [viewport, setViewport] = useState<{ width: number; height: number }>(getInitialViewport());
  
  // Caption edit state
  const [photoEditModal, setPhotoEditModal] = useState<{ open: boolean; photoIndex: number | null }>({
    open: false,
    photoIndex: null
  });
  
  // Text box state
  const [canvasTexts, setCanvasTexts] = useState<CanvasText[]>([]);
  const [textEditIdx, setTextEditIdx] = useState<number | null>(null);
  const [textEditValue, setTextEditValue] = useState('');

  // Custom drag/resize state
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizePhotoId, setResizePhotoId] = useState<string | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Disable drag/resize if any modal is open
  const isModalOpen = photoEditModal.open || textEditIdx !== null;

  // Add new text box to canvas
  const handleAddTextBox = () => {
    setCanvasTexts((prev) => [
      ...prev,
      {
        id: 'text-' + Date.now(),
        text: 'Double-click to edit',
        x: 200 + Math.random() * 100,
        y: 200 + Math.random() * 100,
        width: 180,
        height: 48
      }
    ]);
  };

  // Double-click to edit text box
  const handleTextBoxDoubleClick = (idx: number) => {
    setTextEditIdx(idx);
    setTextEditValue(canvasTexts[idx]?.text || '');
  };

  // Save text box edit
  const handleTextSave = () => {
    if (textEditIdx === null) return;
    setCanvasTexts((prev) => prev.map((t, idx) => (idx === textEditIdx ? { ...t, text: textEditValue } : t)));
    setTextEditIdx(null);
    setTextEditValue('');
  };

  const handleTextCancel = () => {
    setTextEditIdx(null);
    setTextEditValue('');
  };

  // Delete text box
  const handleDeleteTextBox = () => {
    if (textEditIdx === null) return;
    setCanvasTexts((prev) => prev.filter((_, idx) => idx !== textEditIdx));
    setTextEditIdx(null);
    setTextEditValue('');
  };

  // Open caption edit dialog
  const handlePhotoDoubleClick = (idx: number) => {
    setPhotoEditModal({ open: true, photoIndex: idx });
  };

  // Save photo properties from edit modal
  const handlePhotoSave = (photoId: string, data: { caption?: string; transparentBackground?: boolean; showBorder?: boolean; rotation?: number }) => {
    // Find photo index by ID
    const photoIndex = canvasPhotos.findIndex(p => p.id === photoId);
    if (photoIndex === -1) return;

    setCanvasPhotos((prev) => 
      prev.map((p, idx) => 
        idx === photoIndex 
          ? { 
              ...p, 
              caption: data.caption, 
              transparentBackground: data.transparentBackground, 
              showBorder: data.showBorder,
              rotation: data.rotation !== undefined ? data.rotation : p.rotation
            }
          : p
      )
    );

    // Also update collage.config.photos in memory for immediate UI feedback
    if (collage && collage.config && collage.config.photos && collage.config.photos[photoIndex]) {
      if (data.caption !== undefined) {
        collage.config.photos[photoIndex].caption = data.caption;
      }
      if (data.transparentBackground !== undefined) {
        collage.config.photos[photoIndex].transparentBackground = data.transparentBackground;
      }
      if (data.showBorder !== undefined) {
        collage.config.photos[photoIndex].frameVisible = data.showBorder;
      }
      if (data.rotation !== undefined) {
        collage.config.photos[photoIndex].rotation = data.rotation;
      }
      setCollage({ ...collage });
    }
  };

  // Delete photo from canvas
  const handleDeletePhoto = (photoId: string) => {
    const photoIndex = canvasPhotos.findIndex(p => p.id === photoId);
    if (photoIndex === -1) return;
    
    setCanvasPhotos((prev) => prev.filter((_, idx) => idx !== photoIndex));
    // Also update collage.config.photos in memory for immediate UI feedback
    if (collage && collage.config && collage.config.photos) {
      collage.config.photos.splice(photoIndex, 1);
      setCollage({ ...collage });
    }
    setPhotoEditModal({ open: false, photoIndex: null });
  };

  const handleCaptionCancel = () => {
    setPhotoEditModal({ open: false, photoIndex: null });
  };

  const handleSave = async () => {
    if (!collage) return;
    setSaving(true);
    try {
      const photos = canvasPhotos.map((p, idx) => {
        // Use stored fileId, or extract from URL as fallback
        const photoId = p.fileId || (p.src.includes('/serve/') 
          ? p.src.split('/serve/')[1]?.split('?')[0] 
          : '');
        
        return {
          photoId, // Use photoId for the collage config
          filename: photoId, // Keep filename for backward compatibility
          position: { left: p.x, top: p.y },
          width: p.width,
          height: p.height,
          rotation: p.rotation || 0,
          transparentBackground: p.transparentBackground,
          frameVisible: p.showBorder,
          caption:
            p.caption !== undefined ? p.caption : (collage?.config?.photos && collage.config.photos[idx]?.caption) || ''
        };
      });
      // Save text boxes to config
      const texts = canvasTexts.map((t) => ({
        id: t.id,
        text: t.text,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height
      }));
      // Save viewport to config
      const viewportConfig = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      await updateCollage(collage._id, {
        ...collage,
        config: {
          ...collage.config,
          photos,
          texts,
          backgroundColor,
          photoTransparencyMode,
          borderColor,
          viewport: viewportConfig
        },
        albumIds: collage.albumIds
      });
      await collageQuery.refetch();
    } catch (e) {
      setError('Failed to save collage');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const data = collageQuery.data;
    if (!data || !data.collage) {
      return;
    }

    const fetchedCollage = data.collage;
    const fetchedAlbumPhotos = (data.albumPhotos || []) as AlbumPhoto[];

    setCollage(fetchedCollage);
    setAlbumPhotos(fetchedAlbumPhotos);

    if (fetchedCollage.config?.photos) {
      setCanvasPhotos(
        fetchedCollage.config.photos.map((p: any, idx: number) => {
          const albumPhoto = fetchedAlbumPhotos.find((ap: any) => ap._id === p.photoId);
          return {
            id: p.photoId + '-' + idx,
            fileId: p.photoId,
            src: albumPhoto ? albumPhoto.signedUrl : p.filename,
            x: p.position?.left || 100,
            y: p.position?.top || 100,
            width: p.width || 120,
            height: p.height || 120,
            rotation: p.rotation || 0,
            transparentBackground: p.transparentBackground,
            showBorder: p.frameVisible ?? true,
            caption: p.caption || ''
          };
        })
      );
    } else {
      setCanvasPhotos([]);
    }

    if (fetchedCollage.config?.texts) {
      setCanvasTexts(
        fetchedCollage.config.texts.map((t: any) => ({
          id: t.id,
          text: t.text,
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height
        }))
      );
    } else {
      setCanvasTexts([]);
    }

    setBackgroundColor(fetchedCollage.config?.backgroundColor ?? '#111');
    setPhotoTransparencyMode(
      fetchedCollage.config?.photoTransparencyMode !== undefined
        ? fetchedCollage.config.photoTransparencyMode
        : true
    );
    setBorderColor(fetchedCollage.config?.borderColor ?? '#fff');

    if (fetchedCollage.config?.viewport?.width && fetchedCollage.config.viewport?.height) {
      setViewport({ width: fetchedCollage.config.viewport.width, height: fetchedCollage.config.viewport.height });
    } else if (typeof window !== 'undefined') {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    } else {
      setViewport({ width: 1200, height: 800 });
    }

    setError(null);
  }, [collageQuery.data]);

  // Add photo from album to canvas
  const handleAddPhoto = (photo: AlbumPhoto) => {
    setCanvasPhotos((prev) => [
      ...prev,
      {
        id: photo._id + '-' + Date.now(),
        fileId: photo._id, // Store the photo's database ID for saving
        src: photo.signedUrl,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        width: photo.width || 120,
        height: photo.height || 120,
        rotation: 0,
        transparentBackground: photoTransparencyMode,
        showBorder: false
      }
    ]);
  };

  // Handle drag start from sidebar
  const handlePhotoDragStart = (photo: AlbumPhoto, e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(photo));
  };

  // Handle drop on canvas
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const photo: AlbumPhoto = JSON.parse(e.dataTransfer.getData('application/json'));
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setCanvasPhotos((prev) => [
        ...prev,
        {
          id: photo._id + '-' + Date.now(),
          fileId: photo._id,
          src: photo.signedUrl,
          x: x - (photo.width || 120) / 2, // Center the photo on the drop point
          y: y - (photo.height || 120) / 2,
          width: photo.width || 120,
          height: photo.height || 120,
          rotation: 0,
          transparentBackground: photoTransparencyMode,
          showBorder: false
        }
      ]);
    } catch (error) {
      console.error('Failed to parse dropped photo data:', error);
    }
  };

  // Start drag or resize mode on click (disabled in view mode or when modal open)
  const handlePhotoMouseDown = (e: React.MouseEvent, photo: CanvasPhoto) => {
    if (isViewMode || isModalOpen) return;
    setDragPhotoId(photo.id);
    setDragOffset({
      x: e.clientX - photo.x,
      y: e.clientY - photo.y
    });
  };

  const handlePhotoResizeMouseDown = (e: React.MouseEvent, photo: CanvasPhoto) => {
    if (isViewMode || isModalOpen) return;
    setResizePhotoId(photo.id);
    setResizeOrigin({ x: e.clientX, y: e.clientY });
    setResizeStart({ width: photo.width, height: photo.height });
  };

  // Move photo with mouse when in drag mode (disabled in view mode)
  useEffect(() => {
    if (isViewMode || isModalOpen) return;
    if (!dragPhotoId) return;
    const handleMouseMove = (e: MouseEvent) => {
      setCanvasPhotos((prev) =>
        prev.map((p) => (p.id === dragPhotoId ? { ...p, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y } : p))
      );
    };
    const handleMouseUp = () => {
      setDragPhotoId(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragPhotoId, dragOffset, isViewMode, isModalOpen]);

  // Resize photo with mouse when in resize mode (disabled in view mode)
  useEffect(() => {
    if (isViewMode || isModalOpen) return;
    if (!resizePhotoId) return;
    const handleMouseMove = (e: MouseEvent) => {
      setCanvasPhotos((prev) =>
        prev.map((p) =>
          p.id === resizePhotoId
            ? {
                ...p,
                width: Math.max(40, resizeStart.width + (e.clientX - resizeOrigin.x)),
                height: Math.max(40, resizeStart.height + (e.clientY - resizeOrigin.y))
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
  }, [resizePhotoId, resizeOrigin, resizeStart, isViewMode, isModalOpen]);

  return (
    <CollageLayout>
      {/* Hide menu in view mode */}
      {!isViewMode && (
        <Box sx={{ position: 'absolute', top: 16, right: 24, zIndex: 20 }}>
          <CollageMenu
            onSave={handleSave}
            disabled={saving || collageQuery.isFetching || !collage}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
            onAddTextBox={handleAddTextBox}
            photoTransparencyMode={photoTransparencyMode}
            onPhotoTransparencyModeChange={setPhotoTransparencyMode}
            borderColor={borderColor}
            onBorderColorChange={setBorderColor}
          />
        </Box>
      )}
      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      ) : displayError ? (
        <Typography color="error">{displayError}</Typography>
      ) : collage ? (
        <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
          {/* Sidebar: Album Photos (hide in view mode) */}
          {!isViewMode && (
            <CollageSidebar albumPhotos={albumPhotos} onPhotoClick={handleAddPhoto} onPhotoDragStart={handlePhotoDragStart} />
          )}
          
          {/* Canvas Area */}
          <CollageCanvas
            canvasPhotos={canvasPhotos}
            canvasTexts={canvasTexts}
            viewport={viewport}
            backgroundColor={backgroundColor}
            isViewMode={isViewMode}
            dragPhotoId={dragPhotoId}
            resizePhotoId={resizePhotoId}
            photoTransparencyMode={photoTransparencyMode}
            borderColor={borderColor}
            onPhotoMouseDown={handlePhotoMouseDown}
            onPhotoResizeMouseDown={handlePhotoResizeMouseDown}
            onPhotoContextMenu={(e, idx) => {
              if (!isViewMode) {
                e.preventDefault();
                setPhotoEditModal({ open: true, photoIndex: idx });
              }
            }}
            onPhotoDoubleClick={handlePhotoDoubleClick}
            setTextBoxes={isViewMode || isModalOpen ? () => {} : setCanvasTexts}
            onTextBoxDoubleClick={isViewMode || isModalOpen ? () => {} : handleTextBoxDoubleClick}
            onDrop={isViewMode ? undefined : handleCanvasDrop}
            collageConfigPhotos={collage.config?.photos}
          />

          {/* Photo Edit Modal (edit mode only) */}
          {!isViewMode && (
            <CollagePhotoEditModal
              open={photoEditModal.open}
              photo={photoEditModal.photoIndex !== null ? canvasPhotos[photoEditModal.photoIndex] : null}
              onClose={handleCaptionCancel}
              onSave={handlePhotoSave}
              onDelete={handleDeletePhoto}
              globalTransparencyMode={photoTransparencyMode}
              borderColor={borderColor}
              globalBackgroundColor={backgroundColor}
            />
          )}
          
          {/* Text Box Edit Dialog (edit mode only) */}
          {!isViewMode && (
            <CollageTextEditor
              open={textEditIdx !== null}
              text={textEditValue}
              onTextChange={setTextEditValue}
              onSave={handleTextSave}
              onCancel={handleTextCancel}
              onDelete={handleDeleteTextBox}
            />
          )}
        </Box>
      ) : (
        <Typography>No collage found.</Typography>
      )}
    </CollageLayout>
  );
};

export default CollageDetailsPage;
