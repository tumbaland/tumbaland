import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Box, Button, ButtonBase, CircularProgress, Typography } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import { glass, ink, logger, moduleAccent, surface, useTenantFilter } from '@tumbaland/frontend-core';
import { SectionLabel } from '../components/home/SectionLabel';
import { CHAT_APP } from '../config/apps';
import { useAuthState } from '../hooks/useAuthState';
import { clearShare, isMedia, readShare, sharedMessage, type SharedItem } from '../services/sharedInbox';
import {
  conversationName,
  listAlbums,
  listConversations,
  type ShareAlbum,
  type ShareConversation
} from '../services/shareApi';

/** How many photos the preview shows before it says "and 5 more". */
const PREVIEW_COUNT = 6;

interface Destination {
  key: string;
  label: string;
  detail?: string;
  onClick: () => void;
}

function DestinationList({ label, icon, accent, rows }: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  rows: Destination[];
}) {
  return (
    <Box component="section" aria-label={label}>
      <SectionLabel>{label}</SectionLabel>
      <Box sx={{ ...glass, overflow: 'hidden' }}>
        {rows.map((row, index) => (
          <ButtonBase
            key={row.key}
            onClick={row.onClick}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 1.5,
              px: 2,
              py: 1.5,
              textAlign: 'left',
              borderTop: index === 0 ? 'none' : `1px solid ${surface.divider}`,
              WebkitTapHighlightColor: 'transparent',
              '&:hover, &:active': { background: surface.hover }
            }}
          >
            <Box sx={{ color: accent, display: 'flex', flexShrink: 0 }}>{icon}</Box>
            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem', fontWeight: 600, color: ink.strong }}>
              {row.label}
            </Typography>
            {row.detail && (
              <Typography sx={{ fontSize: '0.8rem', color: ink.muted, flexShrink: 0 }}>{row.detail}</Typography>
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Where something shared from another app lands: YouTube, Instagram, the
 * gallery. It shows what came in and asks where it goes.
 *
 * Nothing is sent from here. Picking a chat opens that conversation with the
 * link in the message box and the photos on the tray, and picking an album
 * opens its upload dialog with the photos already in it, so the last step is
 * the same one the person takes when adding something by hand.
 */
export default function SharePage() {
  const navigate = useNavigate();
  const { user } = useAuthState();
  const groupId = useTenantFilter();
  const [share, setShare] = useState<SharedItem | null | undefined>(undefined);
  const [conversations, setConversations] = useState<ShareConversation[] | null>(null);
  const [albums, setAlbums] = useState<ShareAlbum[] | null>(null);

  useEffect(() => {
    let active = true;
    void readShare().then((found) => active && setShare(found));
    return () => {
      active = false;
    };
  }, []);

  const media = useMemo(() => share?.files.filter(isMedia) ?? [], [share]);
  const skipped = (share?.files.length ?? 0) - media.length;
  const message = share ? sharedMessage(share) : '';

  useEffect(() => {
    if (!share) return;
    let active = true;
    listConversations()
      .then((found) => active && setConversations(found))
      .catch((error) => {
        logger.warn('Share: could not list conversations', { error: (error as Error).message });
        if (active) setConversations([]);
      });
    return () => {
      active = false;
    };
  }, [share]);

  useEffect(() => {
    if (media.length === 0) return;
    let active = true;
    listAlbums(groupId)
      .then((found) => active && setAlbums(found))
      .catch((error) => {
        logger.warn('Share: could not list albums', { error: (error as Error).message });
        if (active) setAlbums([]);
      });
    return () => {
      active = false;
    };
  }, [media.length, groupId]);

  // Made in the effect that revokes them, so a remount never shows a revoked one.
  const [previews, setPreviews] = useState<Array<{ file: File; url: string }>>([]);
  useEffect(() => {
    const made = media.slice(0, PREVIEW_COUNT).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(made);
    return () => made.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [media]);

  const cancel = async () => {
    await clearShare();
    navigate('/', { replace: true });
  };

  if (share === undefined) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  const column = {
    maxWidth: 560,
    mx: 'auto',
    width: '100%',
    px: { xs: 0.5, md: 2 },
    pt: { xs: 2.5, md: 5 },
    pb: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 2.5
  } as const;

  if (!share || (!message && media.length === 0)) {
    return (
      <Box sx={column}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: ink.strong }}>
          Nothing came through
        </Typography>
        <Typography sx={{ color: ink.muted }}>
          {share && skipped > 0
            ? 'Only photos, videos and links can be shared to Tumbaland.'
            : 'Try sharing it again from the other app.'}
        </Typography>
        <Box>
          <Button variant="contained" onClick={() => void cancel()}>
            Go home
          </Button>
        </Box>
      </Box>
    );
  }

  // Replaced rather than pushed, so Back from the chat or album goes where it
  // came from instead of to a share that is no longer waiting.
  const chatRows: Destination[] = (conversations ?? []).map((conversation) => ({
    key: conversation.id,
    label: conversationName(conversation, user?.id ?? ''),
    onClick: () => navigate(`/chat/${conversation.id}?shared=1`, { replace: true })
  }));
  const albumRows: Destination[] = (albums ?? []).map((album) => ({
    key: album._id,
    label: album.name,
    detail: `${album.photoCount} ${album.photoCount === 1 ? 'photo' : 'photos'}`,
    onClick: () => navigate(`/album/albums/${album._id}?shared=1`, { replace: true })
  }));

  return (
    <Box sx={column}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: ink.strong }}>
        Share to Tumbaland
      </Typography>

      <Box sx={{ ...glass, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {message && (
          <Typography sx={{ color: ink.strong, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message}</Typography>
        )}
        {previews.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
            {previews.map(({ file, url }) => (
              <Box
                key={url}
                sx={{ position: 'relative', aspectRatio: '1', borderRadius: 1.5, overflow: 'hidden', background: surface.hover }}
              >
                {file.type.startsWith('video/') ? (
                  <>
                    <Box component="video" src={url} muted playsInline preload="metadata" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <PlayCircleOutlineIcon sx={{ position: 'absolute', inset: 0, m: 'auto', color: '#fff', fontSize: 36 }} />
                  </>
                ) : (
                  <Box component="img" src={url} alt={file.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </Box>
            ))}
          </Box>
        )}
        {media.length > PREVIEW_COUNT && (
          <Typography sx={{ fontSize: '0.85rem', color: ink.muted }}>and {media.length - PREVIEW_COUNT} more</Typography>
        )}
        {skipped > 0 && (
          <Typography sx={{ fontSize: '0.85rem', color: ink.muted }}>
            {skipped === 1 ? 'One file was left out.' : `${skipped} files were left out.`} Only photos and videos can
            go to chat or an album.
          </Typography>
        )}
      </Box>

      {conversations === null ? (
        <CircularProgress size={24} sx={{ alignSelf: 'center' }} />
      ) : chatRows.length > 0 ? (
        <DestinationList label="Send in chat" icon={<ChatBubbleOutlineIcon />} accent={CHAT_APP.color} rows={chatRows} />
      ) : (
        <Typography sx={{ color: ink.muted, px: 0.5 }}>Chat could not be reached. Try again in a moment.</Typography>
      )}

      {media.length > 0 &&
        (albums === null ? (
          <CircularProgress size={24} sx={{ alignSelf: 'center' }} />
        ) : albumRows.length > 0 ? (
          <DestinationList
            label="Add to an album"
            icon={<PhotoAlbumOutlinedIcon />}
            accent={moduleAccent.album}
            rows={albumRows}
          />
        ) : (
          <Typography sx={{ color: ink.muted, px: 0.5 }}>
            You have no albums yet. Make one in Album, or send these in chat.
          </Typography>
        ))}

      <Box>
        <Button onClick={() => void cancel()} sx={{ color: ink.muted }}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
