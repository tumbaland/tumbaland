import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { logger } from '@tumbaland/frontend-core';
import { Alert, Box, CircularProgress, IconButton, Snackbar, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import { useCollageDetails, useCollageMutations } from '../hooks/useCollage';
import { useCollageEditor } from '../hooks/useCollageEditor';
import { useCollageSync } from '../hooks/useCollageSync';
import { CollageViewer, useCollageLive } from '../hooks/useCollageLive';
import { useMotionReport, useRemoteMotion } from '../hooks/useCollageMotion';
import { collageService } from '../services/collageService';
import { CollagePerson, personColour } from '../components/collage/CollagePeople';
import type { ServerChange } from '../components/collage/collageChanges';
import {
  CollageDoc,
  EDITOR_BACKDROP,
  newItemId,
  normalizeCollageConfig,
  serializeCollageDoc
} from '../components/collage/collageDoc';
import { CollageConfig } from '../types/collage';
import CollageStage, { ResolvedPhoto } from '../components/collage/CollageStage';
import CollageToolbar from '../components/collage/CollageToolbar';
import CollagePhotoTray, { AlbumPhoto } from '../components/collage/CollagePhotoTray';
import CollagePhotoDialog from '../components/collage/CollagePhotoDialog';
import CollageTextDialog from '../components/collage/CollageTextDialog';
import { downloadBlob, exportCollageToPng } from '../components/collage/exportCollage';
import { appPath } from '../appBase';

/**
 * Longest edge of a newly placed photo, as a fraction of the canvas' shorter
 * side. Small enough that several photos fit before anyone has to resize.
 */
const PLACED_PHOTO_SCALE = 0.22;

/**
 * Whether the stored collage is from before every item had an id. Autosave
 * names items by id, so such a collage is written whole once, first.
 */
/**
 * The others with the collage open, one entry a person. Your own other tabs
 * are not someone else.
 */
const othersIn = (viewers: CollageViewer[], session: string): CollagePerson[] => {
  const me = viewers.find((viewer) => viewer.session === session)?.userId;
  const people = new Map<string, CollagePerson>();
  for (const viewer of viewers) {
    if (viewer.session === session || viewer.userId === me) continue;
    const known = people.get(viewer.userId);
    // Two tabs of theirs: show the one with something selected.
    if (known?.selection) continue;
    people.set(viewer.userId, {
      userId: viewer.userId,
      name: viewer.name,
      picture: viewer.picture,
      color: personColour(viewer.userId),
      selection: viewer.selection
    });
  }
  return [...people.values()];
};

const needsIds = (config?: CollageConfig | null): boolean =>
  (config?.photos ?? []).some((photo) => !photo.id) || (config?.texts ?? []).some((text) => !text.id);

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
  // This tab, to the server: its own changes are not sent back to it.
  const [session] = useState(newItemId);
  const [viewers, setViewers] = useState<CollageViewer[]>([]);
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

  const saveWhole = useCallback(
    async (whole: CollageDoc) => {
      if (!collage) return undefined;
      const stored = await updateCollage(collage._id, {
        title: collage.title,
        config: serializeCollageDoc(whole, collage.config),
        albumIds: collage.albumIds,
        groupId: collage.groupId
      });
      return stored?.revision;
    },
    [collage, updateCollage]
  );

  const fetchLatest = useCallback(async () => {
    const { collage: fresh } = await collageService.getCollageById(id as string);
    return { doc: normalizeCollageConfig(fresh.config), revision: fresh.revision ?? 0 };
  }, [id]);

  const sync = useCollageSync({
    collageId: collage?._id,
    doc,
    revision: collage?.revision,
    session,
    paused: editor.gestureActive,
    saveWhole: collage && needsIds(collage.config) ? saveWhole : undefined,
    fetchLatest,
    onIncoming: editor.applyIncoming
  });

  const motion = useRemoteMotion();
  const { settle } = motion;
  const onChanges = useCallback(
    (rev: number, changes: ServerChange[], by: { userId: string }) => {
      sync.receive(rev, changes);
      // Their save is in: the item is where they left it, no need to follow it.
      settle(by.userId);
    },
    [sync, settle]
  );

  const live = useCollageLive({
    collageId: collage?._id,
    session,
    enabled: Boolean(doc),
    onChanges,
    onPresence: setViewers,
    onRevision: sync.checkRevision,
    onMoving: motion.onMoving
  });

  const people = useMemo(() => othersIn(viewers, session), [viewers, session]);
  // Only people still here: a tab that closed mid-drag leaves nothing behind.
  const motions = useMemo(
    () => motion.motions.filter((moving) => people.some((person) => person.userId === moving.userId)),
    [motion.motions, people]
  );

  useMotionReport({
    collageId: collage?._id,
    session,
    enabled: live.connected && !isViewMode,
    active: editor.gestureActive,
    item: selectedItem?.item
  });

  // What this tab has selected, for the others to see outlined. Sent again on
  // reconnect, since the server forgets a tab when its stream closes.
  const selectedId = isViewMode ? null : editor.selectedId;
  useEffect(() => {
    if (!collage || !live.connected) return;
    collageService.setPresence(collage._id, session, selectedId).catch(() => undefined);
  }, [collage, live.connected, session, selectedId]);

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

  const handleBack = useCallback(async () => {
    const saved = await sync.flush();
    if (!saved && !window.confirm('Your latest changes are not saved yet. Leave anyway?')) return;
    navigate(appPath('/collages'));
  }, [sync, navigate]);

  const setMode = useCallback(
    (view: boolean) => {
      setSearchParams(view ? { mode: 'view' } : {}, { replace: true });
    },
    [setSearchParams]
  );

  // Closing the tab mid-save would lose the last change: ask first.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sync.unsaved) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sync.unsaved]);

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
        // Saving happens by itself; the habit still gets an immediate save.
        e.preventDefault();
        void sync.flush();
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
  }, [editor, selectedItem, editItemId, isViewMode, sync]);

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
        <IconButton onClick={() => navigate(appPath('/collages'))}>
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
          saveStatus={sync.status}
          people={people}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          background={doc.background}
          frameColor={doc.frameColor}
          frameEnabled={doc.frameEnabled}
          zoom={zoom}
          hasSelection={Boolean(selectedItem)}
          onBack={() => void handleBack()}
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
            <IconButton
              size="small"
              onClick={() => void handleBack()}
              sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.4)' }}
            >
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
          people={people}
          motions={motions}
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

/**
 * Keyed by the collage, so opening another one starts a fresh editor and
 * autosave rather than diffing one collage against the other.
 */
const CollageDetailsRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <CollageDetailsPage key={id} />;
};

export default CollageDetailsRoute;
