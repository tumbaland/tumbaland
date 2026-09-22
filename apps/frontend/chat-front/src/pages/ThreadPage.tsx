import { useState } from 'react';
import { useParams } from 'react-router';
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
import UndoIcon from '@mui/icons-material/Undo';
import { surface } from '@tumbaland/frontend-core';
import { Composer } from '../components/thread/Composer';
import { EmojiPicker, type MessageAction } from '../components/thread/EmojiPicker';
import { FullEmojiPicker } from '../components/thread/FullEmojiPicker';
import { MessageList } from '../components/thread/MessageList';
import { canChange } from '../components/thread/MessageBubble';
import { TypingIndicator } from '../components/thread/TypingIndicator';
import { Lightbox } from '../components/thread/Lightbox';
import { useAttachmentUploads } from '../hooks/useAttachmentUploads';
import { useChatThread } from '../hooks/useChatThread';
import { useCurrentUser } from '../hooks/useCurrentUser';
import type { Attachment, ThreadMessage } from '../types';

export interface ThreadPageProps {
  /** Given by the side panel, which has no route to read it from. */
  conversationId?: string;
}

export default function ThreadPage({ conversationId: given }: ThreadPageProps = {}) {
  const params = useParams<{ conversationId: string }>();
  const conversationId = given ?? params.conversationId;
  const { user, loading: loadingUser } = useCurrentUser();
  const [picker, setPicker] = useState<{ messageId: string; anchor: HTMLElement } | null>(null);
  // The full picker, once someone asks for an emoji the quick row does not
  // have. It remembers which message it was opened for.
  const [morePicker, setMorePicker] = useState<{ messageId: string; anchor: HTMLElement } | null>(null);
  const [viewing, setViewing] = useState<{ attachments: Attachment[]; index: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [unsending, setUnsending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  /** Edit and Unsend, for the sender's own stored messages only. */
  const pickedMessage = find(picker?.messageId);
  const actions: MessageAction[] =
    pickedMessage && canChange(pickedMessage, pickedMessage.senderId === user?.id)
      ? [
          { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => setEditingId(pickedMessage.id) },
          { label: 'Unsend', icon: <UndoIcon fontSize="small" />, onClick: () => setUnsending(pickedMessage.id), danger: true }
        ]
      : [];

  const send = (body: string) => {
    // `take` empties the queue, so the attachments and the text leave together
    // and a second press cannot send the same files twice.
    void thread.send(body, uploads.take());
  };

  const openMedia = (message: ThreadMessage, index: number) =>
    setViewing({ attachments: message.attachments, index });

  if (loadingUser || (thread.loading && thread.messages.length === 0)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: surface.default }}>
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
        attachments={viewing?.attachments ?? []}
        index={viewing?.index ?? null}
        onClose={() => setViewing(null)}
      />
    </Box>
  );
}
