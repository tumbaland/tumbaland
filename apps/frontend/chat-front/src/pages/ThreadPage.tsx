import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
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
import { surface } from '@tumbaland/frontend-core';
import { Composer } from '../components/thread/Composer';
import { EmojiPicker, type MessageAction } from '../components/thread/EmojiPicker';
import { FullEmojiPicker } from '../components/thread/FullEmojiPicker';
import { MessageList } from '../components/thread/MessageList';
import { canChange } from '../components/thread/MessageBubble';
import { TypingIndicator } from '../components/thread/TypingIndicator';
import { ThreadHeader } from '../components/thread/ThreadHeader';
import { AlbumPicker } from '../components/thread/AlbumPicker';
import { chatApi } from '../services/chatApi';
import { Lightbox } from '../components/thread/Lightbox';
import { useAttachmentUploads } from '../hooks/useAttachmentUploads';
import { useChatThread } from '../hooks/useChatThread';
import { useCurrentUser } from '../hooks/useCurrentUser';
import type { PhotoAlbum, PhotoAlbumChoice, ThreadMessage } from '../types';

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
  const navigate = useNavigate();

  const thread = useChatThread(conversationId, user?.id ?? '');
  const uploads = useAttachmentUploads(conversationId);

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

  const send = (body: string, options?: { skipAlbum: boolean }) => {
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

  const albumLabel =
    thread.photoAlbum.mode === 'album'
      ? (thread.photoAlbum.albumName ?? 'An album')
      : thread.photoAlbum.mode === 'off'
        ? 'Not saving to Album'
        : 'Not chosen yet';

  const openMedia = (message: ThreadMessage, index: number) => setViewing({ messageId: message.id, index });

  if (loadingUser || (thread.loading && thread.messages.length === 0)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: surface.default }}>
      <ThreadHeader
        members={thread.members}
        currentUserId={user?.id ?? ''}
        title={thread.title}
        presence={thread.presence}
        typingNames={thread.typingNames}
        onBack={onBack}
        menu={[
          {
            label: 'Photos go to',
            secondary: albumLabel,
            icon: <PhotoAlbumOutlinedIcon fontSize="small" />,
            onClick: () => setChoosingAlbum(true)
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
        members={thread.members}
        reads={thread.reads}
      />

      <TypingIndicator names={thread.typingNames} />

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
      />

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
        onPick={(emoji) => picker && void thread.react(picker.messageId, emoji)}
        onMore={() => picker && setMorePicker({ messageId: picker.messageId, anchor: picker.anchor })}
        actions={actions}
      />

      <FullEmojiPicker
        anchorEl={morePicker?.anchor ?? null}
        onClose={() => setMorePicker(null)}
        onPick={(emoji) => morePicker && void thread.react(morePicker.messageId, emoji)}
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
      />
    </Box>
  );
}
