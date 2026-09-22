import { useState } from 'react';
import { useParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { surface } from '@tumbaland/frontend-core';
import { Composer } from '../components/thread/Composer';
import { EmojiPicker } from '../components/thread/EmojiPicker';
import { FullEmojiPicker } from '../components/thread/FullEmojiPicker';
import { MessageList } from '../components/thread/MessageList';
import { TypingIndicator } from '../components/thread/TypingIndicator';
import { Lightbox } from '../components/thread/Lightbox';
import { useAttachmentUploads } from '../hooks/useAttachmentUploads';
import { useChatThread } from '../hooks/useChatThread';
import { useCurrentUser } from '../hooks/useCurrentUser';
import type { Attachment, ThreadMessage } from '../types';

export default function ThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, loading: loadingUser } = useCurrentUser();
  const [picker, setPicker] = useState<{ messageId: string; anchor: HTMLElement } | null>(null);
  // The full picker, once someone asks for an emoji the quick row does not
  // have. It remembers which message it was opened for.
  const [morePicker, setMorePicker] = useState<{ messageId: string; anchor: HTMLElement } | null>(null);
  const [viewing, setViewing] = useState<{ attachments: Attachment[]; index: number } | null>(null);

  const thread = useChatThread(conversationId, user?.id ?? '');
  const uploads = useAttachmentUploads(conversationId);

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
      />

      <EmojiPicker
        anchorEl={picker?.anchor ?? null}
        onClose={() => setPicker(null)}
        onPick={(emoji) => picker && void thread.react(picker.messageId, emoji)}
        onMore={() => picker && setMorePicker({ messageId: picker.messageId, anchor: picker.anchor })}
      />

      <FullEmojiPicker
        anchorEl={morePicker?.anchor ?? null}
        onClose={() => setMorePicker(null)}
        onPick={(emoji) => morePicker && void thread.react(morePicker.messageId, emoji)}
      />

      <Lightbox
        attachments={viewing?.attachments ?? []}
        index={viewing?.index ?? null}
        onClose={() => setViewing(null)}
      />
    </Box>
  );
}
