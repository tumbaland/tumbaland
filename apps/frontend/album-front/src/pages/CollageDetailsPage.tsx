import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { logger } from '@tumbaland/frontend-core';
import { Alert, Box, CircularProgress, IconButton, Snackbar, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import { useCollageDetails, useCollageMutations } from '../hooks/useCollage';
import { useCollageEditor } from '../hooks/useCollageEditor';
import { EDITOR_BACKDROP, normalizeCollageConfig, serializeCollageDoc } from '../components/collage/collageDoc';
import CollageStage, { ResolvedPhoto } from '../components/collage/CollageStage';
import CollageToolbar from '../components/collage/CollageToolbar';
import CollagePhotoTray, { AlbumPhoto } from '../components/collage/CollagePhotoTray';
import CollagePhotoDialog from '../components/collage/CollagePhotoDialog';
import CollageTextDialog from '../components/collage/CollageTextDialog';
import { downloadBlob, exportCollageToPng } from '../components/collage/exportCollage';

/**
 * Longest edge of a newly placed photo, as a fraction of the canvas' shorter
 * side. Small enough that several photos fit before anyone has to resize.
 */
const PLACED_PHOTO_SCALE = 0.22;

/** Full-screen collage editor / viewer. Route: /collages/:id[?mode=view] */
const CollageDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isViewMode = searchParams.get('mode') === 'view';

  const collageQuery = useCollageDetails(id);
  const { updateCollage } = useCollageMutations();
  const editor = useCollageEditor();
  const { doc, selectedItem } = editor;

  const [zoom, setZoom] = useState(0); // 0 = fit
  const [saving, setSaving] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const collage = collageQuery.data?.collage;
  const albumPhotos = useMemo(() => (collageQuery.data?.albumPhotos ?? []) as AlbumPhoto[], [collageQuery.data]);

  // Initialize the editor once per collage; refetches only refresh photo URLs.
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (collage && initializedFor.current !== collage._id) {
      initializedFor.current = collage._id;
      editor.init(normalizeCollageConfig(collage.config));
    }
  }, [collage, editor]);

  const photoById = useMemo(() => {
    const map = new Map<string, AlbumPhoto>();
    for (const p of albumPhotos) map.set(p._id, p);
    return map;
  }, [albumPhotos]);

  const resolvePhoto = useCallback(
    (photoId: string): ResolvedPhoto | undefined => {
      const p = photoById.get(photoId);
      if (!p) return undefined;
      return {
        src: p.signedUrl,
        thumbSrc: p.thumbnailSignedUrl,
        width: p.width,
        height: p.height,
        title: p.title
      };
    },
    [photoById]
  );

  const usedPhotoIds = useMemo(() => new Set((doc?.photos ?? []).map((p) => p.photoId)), [doc?.photos]);

  const placePhoto = useCallback(
    (photo: AlbumPhoto, at?: { x: number; y: number }) => {
      if (!doc) return;
      const place = (naturalW: number, naturalH: number) => {
        const target = Math.min(doc.canvas.width, doc.canvas.height) * PLACED_PHOTO_SCALE;
        const ratio = naturalW > 0 && naturalH > 0 ? naturalW / naturalH : 4 / 3;
        const width = ratio >= 1 ? target : target * ratio;
        const height = ratio >= 1 ? target / ratio : target;
        const x = at ? at.x - width / 2 : doc.canvas.width / 2 - width / 2;
        const y = at ? at.y - height / 2 : doc.canvas.height / 2 - height / 2;
        editor.addPhoto({ photoId: photo._id, x, y, width, height, rotation: 0, caption: '' });
      };
      if (photo.width && photo.height) {
        place(photo.width, photo.height);
      } else if (photo.signedUrl || photo.thumbnailSignedUrl) {
        // older photos have no stored dimensions; read them from the image itself
        const img = new Image();
        img.onload = () => place(img.naturalWidth, img.naturalHeight);
        img.onerror = () => place(4, 3);
        img.src = (photo.signedUrl || photo.thumbnailSignedUrl) as string;
      } else {
        place(4, 3);
      }
    },
    [doc, editor]
  );

  const handleSave = useCallback(async () => {
    if (!collage || !doc) return;
    setSaving(true);
    try {
      await updateCollage(collage._id, {
        title: collage.title,
        config: serializeCollageDoc(doc, collage.config),
        albumIds: collage.albumIds,
        groupId: collage.groupId
      });
      editor.markSaved();
      setToast({ message: 'Collage saved', severity: 'success' });
    } catch (e) {
      logger.error('Failed to save collage', e);
      setToast({ message: 'Failed to save collage', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [collage, doc, editor, updateCollage]);

  const handleExport = useCallback(async () => {
    if (!doc) return;
    try {
      const blob = await exportCollageToPng(doc, resolvePhoto);
      downloadBlob(blob, `${collage?.title || 'collage'}.png`);
    } catch (e) {
      logger.error('Failed to export collage', e);
      setToast({
        message: e instanceof Error ? e.message : 'Failed to export collage',
        severity: 'error'
      });
    }
  }, [doc, collage, resolvePhoto]);

  const handleBack = useCallback(() => {
    if (editor.isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
    navigate('/collages');
  }, [editor.isDirty, navigate]);

  const setMode = useCallback(
    (view: boolean) => {
      setSearchParams(view ? { mode: 'view' } : {}, { replace: true });
    },
    [setSearchParams]
  );

  // Warn about unsaved changes on tab close / reload
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editor.isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editor.isDirty]);

  // Keyboard shortcuts (edit mode, and not while typing or in a dialog)
  useEffect(() => {
    if (isViewMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (editItemId || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editor.redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selectedId) {
        e.preventDefault();
        editor.removeItem(editor.selectedId);
      } else if (e.key === 'Escape') {
        editor.select(null);
      } else if (e.key.startsWith('Arrow') && editor.selectedId && selectedItem) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        editor.patchItem(editor.selectedId, {
          x: selectedItem.item.x + dx,
          y: selectedItem.item.y + dy
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, selectedItem, editItemId, isViewMode, handleSave]);

  const editingItem = useMemo(() => {
    if (!doc || !editItemId) return null;
    const photo = doc.photos.find((p) => p.id === editItemId);
    if (photo) return { kind: 'photo' as const, photo };
    const text = doc.texts.find((t) => t.id === editItemId);
    if (text) return { kind: 'text' as const, text };
    return null;
  }, [doc, editItemId]);

  if (collageQuery.isPending) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: EDITOR_BACKDROP
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (collageQuery.error || !collage) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default'
        }}
      >
        <Typography color="error">{collageQuery.error ? 'Failed to load collage' : 'Collage not found'}</Typography>
        <IconButton onClick={() => navigate('/collages')}>
          <ArrowBackIcon />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: EDITOR_BACKDROP
      }}
    >
      {!isViewMode && doc && (
        <CollageToolbar
          title={collage.title}
          isDirty={editor.isDirty}
          saving={saving}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          background={doc.background}
          frameColor={doc.frameColor}
          frameEnabled={doc.frameEnabled}
          zoom={zoom}
          hasSelection={Boolean(selectedItem)}
          onBack={handleBack}
          onSave={handleSave}
          onUndo={editor.undo}
          onRedo={editor.redo}
          onAddText={() => editor.addText()}
          onBackgroundChange={(background) => editor.patchDoc({ background })}
          onFrameColorChange={(frameColor) => editor.patchDoc({ frameColor })}
          onFrameEnabledChange={(frameEnabled) => editor.patchDoc({ frameEnabled })}
          onZoomChange={setZoom}
          onExport={handleExport}
          onPreview={() => setMode(true)}
          onEditSelected={() => selectedItem && setEditItemId(selectedItem.item.id)}
          onDeleteSelected={() => editor.selectedId && editor.removeItem(editor.selectedId)}
          onBringForward={() => editor.selectedId && editor.reorderItem(editor.selectedId, 1)}
          onSendBackward={() => editor.selectedId && editor.reorderItem(editor.selectedId, -1)}
        />
      )}

      {isViewMode && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 60,
            display: 'flex',
            gap: 0.5,
            opacity: 0.35,
            transition: 'opacity 0.2s',
            '&:hover': { opacity: 1 }
          }}
        >
          <Tooltip title="Edit collage">
            <IconButton size="small" onClick={() => setMode(false)} sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.4)' }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as PNG">
            <IconButton size="small" onClick={handleExport} sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.4)' }}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Back to collages">
            <IconButton size="small" onClick={handleBack} sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.4)' }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {!isViewMode && <CollagePhotoTray photos={albumPhotos} usedPhotoIds={usedPhotoIds} onAddPhoto={placePhoto} />}
        <CollageStage
          editor={editor}
          resolvePhoto={resolvePhoto}
          readOnly={isViewMode}
          zoom={isViewMode ? 0 : zoom}
          onEditItem={setEditItemId}
          onDropPhoto={(photoId, x, y) => {
            const photo = photoById.get(photoId);
            if (photo) placePhoto(photo, { x, y });
          }}
        />
      </Box>

      <CollagePhotoDialog
        open={editingItem?.kind === 'photo'}
        photo={editingItem?.kind === 'photo' ? editingItem.photo : null}
        photoSrc={
          editingItem?.kind === 'photo'
            ? resolvePhoto(editingItem.photo.photoId)?.thumbSrc || resolvePhoto(editingItem.photo.photoId)?.src
            : undefined
        }
        onClose={() => setEditItemId(null)}
        onSave={(patch) => editItemId && editor.patchItem(editItemId, patch)}
        onDelete={() => editItemId && editor.removeItem(editItemId)}
      />
      <CollageTextDialog
        open={editingItem?.kind === 'text'}
        text={editingItem?.kind === 'text' ? editingItem.text : null}
        onClose={() => setEditItemId(null)}
        onSave={(patch) => editItemId && editor.patchItem(editItemId, patch)}
        onDelete={() => editItemId && editor.removeItem(editItemId)}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'success'} variant="filled" onClose={() => setToast(null)}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CollageDetailsPage;
