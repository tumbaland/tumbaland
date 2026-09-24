import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import { Composer } from '../components/thread/Composer';
import { EmojiPicker, type MessageAction } from '../components/thread/EmojiPicker';
import { FullEmojiPicker } from '../components/thread/FullEmojiPicker';
import { MessageList } from '../components/thread/MessageList';
import { canChange } from '../components/thread/MessageBubble';
import { TypingIndicator } from '../components/thread/TypingIndicator';
import { ScreenEffect } from '../components/thread/ScreenEffect';
import { ThreadHeader } from '../components/thread/ThreadHeader';
import { AlbumPicker } from '../components/thread/AlbumPicker';
import { AlbumCollageDialog } from '../components/thread/AlbumCollageDialog';
import { SearchDialog } from '../components/thread/SearchDialog';
import { ThemePicker } from '../components/thread/ThemePicker';
import { chatColors, chatThemeVars, themeById } from '../components/thread/themes';
import { surface } from '@tumbaland/frontend-core';
import { recordEmoji } from '../components/thread/recentEmoji';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { chatApi } from '../services/chatApi';
import { requestCall } from '../services/callBus';
import { clearShare, isMedia, readShare, sharedMessage } from '../services/sharedInbox';
import { Lightbox } from '../components/thread/Lightbox';
import { useAttachmentUploads } from '../hooks/useAttachmentUploads';
import { useChatThread } from '../hooks/useChatThread';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useScreenEffects } from '../hooks/useScreenEffects';
import type { Message, PhotoAlbum, PhotoAlbumChoice, SendOptions, ThreadMessage } from '../types';

export interface ThreadPageProps {
  /** Given by the side panel, which has no route to read it from. */
  conversationId?: string;
  /** The side panel's way back to its list, drawn in the header. */
  onBack?: () => void;
}

export default function ThreadPage({ conversationId: given, onBack }: ThreadPageProps = {}) {
  const params = useParams<{ conversationId: string }>();
  const conversationId = given ?? params.conversationId;
  const { user, loading: loadingUser } = useCurrentUser();
  const [picker, setPicker] = useState<{ messageId: string; anchor: HTMLElement } | null>(null);
  // The full picker, once someone asks for an emoji the quick row does not
  // have. It remembers which message it was opened for.
  const [morePicker, setMorePicker] = useState<{ messageId: string; anchor: HTMLElement } | null>(null);
  // By message rather than a copy of its attachments, so the viewer shows an
  // album change the moment it lands.
  const [viewing, setViewing] = useState<{ messageId: string; index: number } | null>(null);
  /** A sent message's photos being moved: all of them, or the one named. */
  const [placing, setPlacing] = useState<{ messageId: string; fileId?: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [unsending, setUnsending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [choosingAlbum, setChoosingAlbum] = useState(false);
  const [choosingTheme, setChoosingTheme] = useState(false);
  const [albumAndCollage, setAlbumAndCollage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  /** The message the list scrolls to and flashes: a search result. */
  const [focus, setFocus] = useState<{ id: string; key: number } | null>(null);
  const [jumping, setJumping] = useState(false);
  const navigate = useNavigate();

  const thread = useChatThread(conversationId, user?.id ?? '');
  const uploads = useAttachmentUploads(conversationId);
  const screenEffect = useScreenEffects(conversationId, thread.messages, user?.id ?? '', !thread.loading);

  /**
   * Something shared from another app, sent here by the shell's /share page
   * with `?shared=1`. It goes into the composer, not straight out: the link
   * in the box and the photos on the tray, so the person can add a line or
   * change their mind before pressing Send.
   *
   * The side panel never takes it. It shows on desktop next to other pages,
   * and would pick up a share meant for an album.
   *
   * The share is cleared only once it is in the composer, so a render that
   * is thrown away half-way leaves it for the next one to pick up.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const sharing = !given && searchParams.has('shared');
  const [prefill, setPrefill] = useState<{ text: string; key: number } | null>(null);
  const addUploads = uploads.add;
  useEffect(() => {
    if (!sharing || !conversationId) return;
    let active = true;
    void readShare().then(async (share) => {
      if (!active) return;
      if (share) {
        const media = share.files.filter(isMedia);
        if (media.length > 0) void addUploads(media);
        const text = sharedMessage(share);
        if (text) setPrefill({ text, key: Date.now() });
        await clearShare();
      }
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete('shared');
          return next;
        },
        { replace: true }
      );
    });
    return () => {
      active = false;
    };
  }, [sharing, conversationId, addUploads, setSearchParams]);

  const find = (id: string | null | undefined) => (id ? thread.messages.find((message) => message.id === id) : undefined);

  // Unsent from another device while the edit was open: nothing left to edit.
  const editingMessage = find(editingId);
  const editing =
    editingMessage && !editingMessage.deletedAt
      ? { id: editingMessage.id, body: editingMessage.body, hasMedia: editingMessage.attachments.length > 0 }
      : null;

  const saveEdit = async (body: string) => {
    if (!editing) return;
    try {
      await thread.edit(editing.id, body);
      setEditingId(null);
    } catch {
      setActionError('Could not save the edit. Try again.');
    }
  };

  const unsend = async () => {
    if (!unsending) return;
    const id = unsending;
    setUnsending(null);
    try {
      await thread.remove(id);
      if (editingId === id) setEditingId(null);
    } catch {
      setActionError('Could not unsend that message. Try again.');
    }
  };

  /**
   * Edit and Unsend, for the sender's own stored messages only; the album for
   * anyone, since it is the group's.
   */
  const pickedMessage = find(picker?.messageId);
  const pickedStored =
    pickedMessage && !pickedMessage.deletedAt && pickedMessage.delivery !== 'pending' && pickedMessage.delivery !== 'failed';
  const inAlbum = Boolean(pickedMessage?.attachments.some((attachment) => attachment.albumId));
  const actions: MessageAction[] = [
    ...(pickedMessage && pickedStored && pickedMessage.attachments.length > 0
      ? [
          {
            label: inAlbum ? 'Change album…' : 'Add to album…',
            icon: <PhotoAlbumOutlinedIcon fontSize="small" />,
            onClick: () => setPlacing({ messageId: pickedMessage.id })
          }
        ]
      : []),
    ...(pickedMessage && canChange(pickedMessage, pickedMessage.senderId === user?.id)
      ? [
          { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => setEditingId(pickedMessage.id) },
          { label: 'Unsend', icon: <UndoIcon fontSize="small" />, onClick: () => setUnsending(pickedMessage.id), danger: true }
        ]
      : [])
  ];

  const send = (body: string, options?: SendOptions) => {
    // `take` empties the queue, so the attachments and the text leave together
    // and a second press cannot send the same files twice.
    void thread.send(body, uploads.take(), options);
  };

  const loadAlbums = useCallback(
    () => (conversationId ? chatApi.listAlbums(conversationId) : Promise.resolve([])),
    [conversationId]
  );

  const turnAlbumOff = async () => {
    try {
      await thread.setPhotoAlbum({ mode: 'off' });
    } catch {
      setActionError('Could not change that. Try again.');
    }
  };

  const viewingMessage = find(viewing?.messageId);
  const viewingStored =
    viewingMessage && !viewingMessage.deletedAt && viewingMessage.delivery !== 'pending' && viewingMessage.delivery !== 'failed';

  /** What the "Move to album" picker marks as current: the photo's album, or none. */
  const placingMessage = find(placing?.messageId);
  const placingFile = placingMessage?.attachments.find((attachment) =>
    placing?.fileId ? attachment.fileId === placing.fileId : attachment.albumId
  );
  const placingCurrent: PhotoAlbum = placingFile?.albumId
    ? { mode: 'album', albumId: placingFile.albumId, albumName: placingFile.albumName ?? null }
    : { mode: 'off', albumId: null, albumName: null };

  // Errors are left to the picker, which stays open and says so.
  const place = async (choice: PhotoAlbumChoice) => {
    if (!placing) return;
    if (choice.mode === 'off') await thread.removeFromAlbum(placing.messageId, placing.fileId);
    else
      await thread.placeInAlbum(
        placing.messageId,
        'albumId' in choice ? { albumId: choice.albumId } : { newAlbumName: choice.newAlbumName },
        placing.fileId
      );
  };

  const theme = themeById(thread.appearance.theme);

  // When the thread last saw each person: their read position or their last
  // message, whichever is later. The header falls back to it when presence
  // has no record of them.
  const lastSeen: Record<string, string> = {};
  const note = (userId: string, iso: string | undefined | null) => {
    if (iso && (!lastSeen[userId] || new Date(iso) > new Date(lastSeen[userId]!))) lastSeen[userId] = iso;
  };
  for (const read of Object.values(thread.reads)) note(read.userId, read.lastReadAt);
  for (const message of thread.messages) {
    const stored = message.delivery !== 'pending' && message.delivery !== 'failed';
    if (message.kind !== 'system' && stored) note(message.senderId, message.createdAt);
  }

  // Calls are one to one: offered only when there is exactly one other person.
  const others = thread.members.filter((member) => member.userId !== user?.id);
  const callable =
    user && conversationId && others.length === 1
      ? { userId: others[0]!.userId, name: others[0]!.name || others[0]!.email, picture: others[0]!.picture ?? null }
      : null;

  const makeBackground = async (fileId: string) => {
    try {
      await thread.setAppearance({ backgroundFileId: fileId });
      setViewing(null);
    } catch {
      setActionError('Could not set that as the background. Try again.');
    }
  };

  const albumLabel =
    thread.photoAlbum.mode === 'album'
      ? (thread.photoAlbum.albumName ?? 'An album')
      : thread.photoAlbum.mode === 'off'
        ? 'Not saving to Album'
        : 'Not chosen yet';

  const openCollage = (collageId: string) => navigate(`/album/collages/${collageId}`);

  // The card is in the thread for the others; the one who made it goes straight in.
  const startCollage = async (title: string, clientId: string) => {
    const card = await thread.startCollage(title, clientId);
    if (card?.collage) openCollage(card.collage.id);
  };

  /**
   * A search result: older messages are loaded until it is in the thread,
   * then the list scrolls to it. Past the loading limit, or unsent since the
   * search, it says so instead.
   */
  const openResult = async (message: Message) => {
    setSearchOpen(false);
    setJumping(true);
    try {
      const outcome = await thread.loadUntil(message.id, message.createdAt);
      if (outcome === 'found') setFocus({ id: message.id, key: Date.now() });
      else if (outcome === 'too-far') setActionError('That message is too far back to open here.');
      else setActionError('That message is no longer in the chat.');
    } catch {
      setActionError('Could not open that message. Try again.');
    } finally {
      setJumping(false);
    }
  };

  const openMedia = (message: ThreadMessage, index: number) => setViewing({ messageId: message.id, index });

  if (loadingUser || (thread.loading && thread.messages.length === 0)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        ...chatThemeVars(theme),
        background: chatColors.background,
        position: 'relative',
        // The photo layer below sits behind everything in this box and in
        // front of nothing outside it.
        isolation: 'isolate'
      }}
    >
      {thread.appearance.backgroundUrl && (
        <Box
          aria-hidden
          data-testid="chat-background"
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            backgroundImage: `url("${thread.appearance.backgroundUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            // A veil, so the grey times and the bubbles stay readable over
            // whatever the photo is. Pale on light, dark on dark.
            '&::after': { content: '""', position: 'absolute', inset: 0, background: surface.scrim }
          }}
        />
      )}
      <ThreadHeader
        members={thread.members}
        currentUserId={user?.id ?? ''}
        title={thread.title}
        presence={thread.presence}
        typingNames={thread.typingNames}
        onBack={onBack}
        background={chatColors.header}
        accent={chatColors.headerAccent}
        lastSeen={lastSeen}
        onCall={callable ? () => requestCall({ conversationId: conversationId!, peer: callable }) : undefined}
        menu={[
          {
            label: 'Search messages',
            icon: <SearchIcon fontSize="small" />,
            onClick: () => setSearchOpen(true)
          },
          {
            label: 'Album and collage',
            secondary: albumLabel,
            icon: <PhotoAlbumOutlinedIcon fontSize="small" />,
            onClick: () => setAlbumAndCollage(true)
          },
          {
            label: 'Theme',
            secondary: thread.appearance.backgroundFileId ? `${theme.name}, with a photo` : theme.name,
            icon: <PaletteOutlinedIcon fontSize="small" />,
            onClick: () => setChoosingTheme(true)
          }
        ]}
      />

      {/* The connection banner appears only when the transport has actually
          degraded. A permanently visible status line trains people to ignore
          it, which is the opposite of what it is for. */}
      {thread.connection === 'offline' && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Reconnecting
        </Alert>
      )}
      {thread.connection === 'polling' && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Live updates are unavailable, so messages may take a few seconds to appear.
        </Alert>
      )}
      {thread.error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {thread.error}
        </Alert>
      )}

      <MessageList
        messages={thread.messages}
        currentUserId={user?.id ?? ''}
        hasOlder={thread.hasOlder}
        loadingOlder={thread.loadingOlder}
        onLoadOlder={thread.loadOlder}
        onReact={thread.react}
        onRetry={thread.retry}
        onPickEmoji={(messageId, anchor) => setPicker({ messageId, anchor })}
        onOpenMedia={openMedia}
        onOpenAlbum={(albumId) => navigate(`/album/albums/${albumId}`)}
        onEditAlbum={(messageId) => setPlacing({ messageId })}
        onOpenCollage={openCollage}
        accent={chatColors.bubble}
        members={thread.members}
        reads={thread.reads}
        focus={focus}
      />

      <TypingIndicator names={thread.typingNames} />

      {screenEffect.playing && (
        <ScreenEffect
          key={screenEffect.playing.key}
          effect={screenEffect.playing.effect}
          onDone={screenEffect.done}
        />
      )}

      <Composer
        onSend={send}
        onTyping={thread.notifyTyping}
        uploads={uploads.uploads}
        onAddFiles={uploads.add}
        onRemoveUpload={uploads.remove}
        uploading={uploads.busy}
        editing={editing}
        onSaveEdit={(body) => void saveEdit(body)}
        onCancelEdit={() => setEditingId(null)}
        photoAlbum={thread.photoAlbum}
        onChooseAlbum={() => setChoosingAlbum(true)}
        onAlbumOff={() => void turnAlbumOff()}
        accent={chatColors.bubble}
        prefill={prefill}
      />

      {conversationId && (
        <SearchDialog
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          conversationId={conversationId}
          members={thread.members}
          currentUserId={user?.id ?? ''}
          onPick={(message) => void openResult(message)}
        />
      )}

      <Snackbar open={jumping} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ width: '100%' }}>
          Finding the message…
        </Alert>
      </Snackbar>

      <ThemePicker
        open={choosingTheme}
        onClose={() => setChoosingTheme(false)}
        appearance={thread.appearance}
        onChange={thread.setAppearance}
      />

      <AlbumCollageDialog
        open={albumAndCollage}
        onClose={() => setAlbumAndCollage(false)}
        photoAlbum={thread.photoAlbum}
        loadAlbums={loadAlbums}
        onChooseAlbum={thread.setPhotoAlbum}
        onStartCollage={startCollage}
      />

      {/* On its own for the composer's "Photos go to" line, where the
          question is only where this photo goes. */}
      <AlbumPicker
        open={choosingAlbum}
        onClose={() => setChoosingAlbum(false)}
        current={thread.photoAlbum}
        loadAlbums={loadAlbums}
        onChoose={thread.setPhotoAlbum}
      />

      <AlbumPicker
        open={Boolean(placing)}
        onClose={() => setPlacing(null)}
        purpose="photo"
        current={placingCurrent}
        loadAlbums={loadAlbums}
        onChoose={place}
      />

      <EmojiPicker
        anchorEl={picker?.anchor ?? null}
        onClose={() => setPicker(null)}
        onPick={(emoji) => {
          if (!picker) return;
          recordEmoji(emoji);
          void thread.react(picker.messageId, emoji);
        }}
        onMore={() => picker && setMorePicker({ messageId: picker.messageId, anchor: picker.anchor })}
        actions={actions}
      />

      <FullEmojiPicker
        anchorEl={morePicker?.anchor ?? null}
        onClose={() => setMorePicker(null)}
        onPick={(emoji) => {
          if (!morePicker) return;
          recordEmoji(emoji);
          void thread.react(morePicker.messageId, emoji);
        }}
      />

      <Dialog open={Boolean(unsending)} onClose={() => setUnsending(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Unsend this message?</DialogTitle>
        <DialogContent>
          <DialogContentText>It will be removed for everyone in the chat.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnsending(null)}>Cancel</Button>
          <Button color="error" onClick={() => void unsend()}>
            Unsend
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={5000}
        onClose={() => setActionError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ width: '100%' }}>
          {actionError}
        </Alert>
      </Snackbar>

      <Lightbox
        attachments={viewingMessage?.attachments ?? []}
        index={viewingMessage ? (viewing?.index ?? null) : null}
        onClose={() => setViewing(null)}
        onEditAlbum={
          viewingStored ? (index) => setPlacing({ messageId: viewingMessage.id, fileId: viewingMessage.attachments[index]?.fileId }) : undefined
        }
        onUseAsBackground={
          viewingStored
            ? (index) => {
                const fileId = viewingMessage.attachments[index]?.fileId;
                if (fileId) void makeBackground(fileId);
              }
            : undefined
        }
      />
    </Box>
  );
}
