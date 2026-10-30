import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import SelectAllOutlinedIcon from '@mui/icons-material/SelectAllOutlined';
import ReplyIcon from '@mui/icons-material/Reply';
import UndoIcon from '@mui/icons-material/Undo';
import { EmojiPicker, type MessageAction } from './EmojiPicker';
import { FullEmojiPicker } from './FullEmojiPicker';
import { canChange } from './messageBubbleUtils';
import { recordEmoji } from './recentEmoji';
import { isVisualType } from '../../services/voice';
import type { ThreadMessage } from '../../types';

export interface PickedMessage {
  messageId: string;
  anchor: HTMLElement;
}

interface Props {
  picked: PickedMessage | null;
  onClose: () => void;
  messages: ThreadMessage[];
  currentUserId: string;
  onReply: (messageId: string) => void;
  onEdit: (messageId: string) => void;
  onEditAlbum: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onUnsend: (messageId: string) => Promise<void>;
  onError: (message: string) => void;
}

/** A message's reaction menus and the confirmation before removing it for everyone. */
export function ThreadMessageActions({
  picked,
  onClose,
  messages,
  currentUserId,
  onReply,
  onEdit,
  onEditAlbum,
  onReact,
  onUnsend,
  onError
}: Props) {
  const [more, setMore] = useState<PickedMessage | null>(null);
  const [unsending, setUnsending] = useState<string | null>(null);
  /** The text of a message opened to pick part of it. */
  const [selecting, setSelecting] = useState<string | null>(null);
  const message = messages.find((entry) => entry.id === picked?.messageId);
  const stored = message && !message.deletedAt && message.delivery !== 'pending' && message.delivery !== 'failed';
  const inAlbum = Boolean(message?.attachments.some((photo) => photo.albumId));
  const actions: MessageAction[] = [
    ...(stored && message.kind !== 'system'
      ? [{ label: 'Reply', icon: <ReplyIcon fontSize="small" />, onClick: () => onReply(message.id) }]
      : []),
    // A long press opens this menu, not the browser's text selection, so a phone copies from here:
    // the whole message, or part of it picked in a plain view of its text.
    ...(stored && message.kind !== 'system' && message.body.trim()
      ? [
          { label: 'Copy', icon: <ContentCopyOutlinedIcon fontSize="small" />, onClick: () => void copy(message.body) },
          { label: 'Select text', icon: <SelectAllOutlinedIcon fontSize="small" />, onClick: () => setSelecting(message.body) }
        ]
      : []),
    ...(stored && message.attachments.some((photo) => isVisualType(photo.mimetype))
      ? [
          {
            label: inAlbum ? 'Change album…' : 'Add to album…',
            icon: <PhotoAlbumOutlinedIcon fontSize="small" />,
            onClick: () => onEditAlbum(message.id)
          }
        ]
      : []),
    ...(message && canChange(message, message.senderId === currentUserId)
      ? [
          { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(message.id) },
          {
            label: 'Unsend',
            icon: <UndoIcon fontSize="small" />,
            onClick: () => setUnsending(message.id),
            danger: true
          }
        ]
      : [])
  ];
  const react = (target: PickedMessage | null, emoji: string) => {
    if (!target) return;
    recordEmoji(emoji);
    void onReact(target.messageId, emoji);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      onError('Could not copy that message.');
    }
  };
  const unsend = async () => {
    if (!unsending) return;
    const id = unsending;
    setUnsending(null);
    try {
      await onUnsend(id);
    } catch {
      onError('Could not unsend that message. Try again.');
    }
  };

  return (
    <>
      <EmojiPicker
        anchorEl={picked?.anchor ?? null}
        onClose={onClose}
        onPick={(emoji) => react(picked, emoji)}
        onMore={() => picked && setMore(picked)}
        actions={actions}
      />
      <FullEmojiPicker
        anchorEl={more?.anchor ?? null}
        onClose={() => setMore(null)}
        onPick={(emoji) => react(more, emoji)}
      />
      <Dialog open={selecting !== null} onClose={() => setSelecting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Select text</DialogTitle>
        <DialogContent>
          {/* Nothing here listens for a long press, so the browser's own selection handles work. */}
          <DialogContentText
            component="div"
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text', WebkitUserSelect: 'text', color: 'text.primary' }}
          >
            {selecting}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelecting(null)}>Done</Button>
        </DialogActions>
      </Dialog>
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
    </>
  );
}
