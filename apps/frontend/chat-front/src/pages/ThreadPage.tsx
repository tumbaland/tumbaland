import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import { surface } from '@tumbaland/frontend-core';
import { Composer } from '../components/thread/Composer';
import { MessageList } from '../components/thread/MessageList';
import { TypingIndicator } from '../components/thread/TypingIndicator';
import { ScreenEffect } from '../components/thread/ScreenEffect';
import { ThreadToolbar } from '../components/thread/ThreadToolbar';
import { ThreadMessageActions, type PickedMessage } from '../components/thread/ThreadMessageActions';
import { ThreadLocation } from '../components/live/ThreadLocation';
import { AlbumPicker } from '../components/thread/AlbumPicker';
import { ChoosePhotosDialog } from '../components/thread/ChoosePhotosDialog';
import { Lightbox } from '../components/thread/Lightbox';
import { SearchDialog } from '../components/thread/SearchDialog';
import { chatColors, chatThemeVars, themeById } from '../components/thread/themes';
import { useChatThread } from '../hooks/useChatThread';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useScreenEffects } from '../hooks/useScreenEffects';
import { useThreadComposer } from '../hooks/useThreadComposer';
import { useThreadLocation } from '../hooks/useThreadLocation';
import { useThreadMedia } from '../hooks/useThreadMedia';
import { useThreadSearch } from '../hooks/useThreadSearch';

export interface ThreadPageProps {
  /** Given by the side panel, which has no route to read it from. */
  conversationId?: string;
  /** The side panel's way back to its list, drawn in the header. */
  onBack?: () => void;
}

/** A conversation change resets its state and isolates any requests still in flight. */
export default function ThreadPage({ conversationId: given, onBack }: ThreadPageProps = {}) {
  const params = useParams<{ conversationId: string }>();
  const conversationId = given ?? params.conversationId;
  return <ThreadContent key={conversationId} conversationId={conversationId} onBack={onBack} acceptShared={!given} />;
}

/** Compose the thread's features; each feature owns its interaction state and dialogs. */
function ThreadContent({ conversationId, onBack, acceptShared }: ThreadPageProps & { acceptShared: boolean }) {
  const { user, loading: loadingUser } = useCurrentUser();
  const currentUserId = user?.id ?? '';
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedMessage | null>(null);
  const [choosingAlbum, setChoosingAlbum] = useState(false);

  const thread = useChatThread(conversationId, currentUserId);
  const composer = useThreadComposer({
    conversationId,
    currentUserId,
    thread,
    acceptShared,
    onError: setActionError
  });
  const media = useThreadMedia({ conversationId, thread, onError: setActionError });
  const location = useThreadLocation(conversationId, currentUserId, thread);
  const search = useThreadSearch(conversationId, currentUserId, thread, setActionError);
  const screenEffect = useScreenEffects(conversationId, thread.messages, currentUserId, !thread.loading);
  const theme = themeById(thread.appearance.theme);
  const voice = composer.props.voice;
  const openCollage = (id: string) => navigate(`/album/collages/${id}`);

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
        ...(thread.appearance.backgroundUrl
          ? { '--chat-meta-halo': `0 0 3px ${surface.paper}, 0 0 8px ${surface.paper}` }
          : {}),
        background: chatColors.background,
        position: 'relative',
        // Keep the background photo behind this thread without affecting the shell.
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
            '&::after': { content: '""', position: 'absolute', inset: 0, background: surface.scrim }
          }}
        />
      )}

      <ThreadToolbar
        conversationId={conversationId}
        currentUserId={currentUserId}
        thread={thread}
        onBack={onBack}
        onSearch={search.open}
        onLocation={location.openMap}
        sharing={location.drive.state === 'sharing' || Boolean(location.ownShare)}
        onRecordVoice={voice.supported ? () => void voice.start() : undefined}
        recordingVoice={voice.active || Boolean(composer.props.editing)}
        choosingAlbum={choosingAlbum}
        onCloseAlbum={() => setChoosingAlbum(false)}
        onOpenCollage={openCollage}
      />

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

      <ThreadLocation
        conversationId={conversationId}
        currentUserId={currentUserId}
        shares={thread.live}
        members={thread.members}
        location={location}
      />

      <MessageList
        messages={thread.messages}
        currentUserId={currentUserId}
        hasOlder={thread.hasOlder}
        loadingOlder={thread.loadingOlder}
        onLoadOlder={thread.loadOlder}
        onReact={thread.react}
        onRetry={thread.retry}
        onPickEmoji={(messageId, anchor) => setPicked({ messageId, anchor })}
        onReply={composer.reply}
        onOpenQuote={(messageId, createdAt) => void search.jumpTo(messageId, createdAt)}
        onOpenMedia={media.openMedia}
        onOpenAlbum={(id) => navigate(`/album/albums/${id}`)}
        onEditAlbum={media.editAlbum}
        onRemoveFromAlbum={media.removeAlbum}
        onOpenCollage={openCollage}
        onOpenPlan={(id) => navigate(`/relationship/journal?view=calendar&plan=${encodeURIComponent(id)}`)}
        accent={chatColors.bubble}
        members={thread.members}
        bots={thread.assistants?.bots}
        reads={thread.reads}
        focus={search.focus}
      />
      <TypingIndicator names={thread.typingNames} assistants={thread.assistantsWorking} />

      {screenEffect.playing && (
        <ScreenEffect key={screenEffect.playing.key} effect={screenEffect.playing.effect} onDone={screenEffect.done} />
      )}

      {/* Only a conversation change resets the draft, never a stream update or an open dialog. */}
      <Composer
        key={conversationId}
        {...composer.props}
        photoAlbum={thread.photoAlbum}
        bots={thread.assistants?.bots}
        onChooseAlbum={() => setChoosingAlbum(true)}
        accent={chatColors.bubble}
      />

      {conversationId && <SearchDialog {...search.dialog} />}
      <Snackbar open={search.jumping} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ width: '100%' }}>
          Finding the message…
        </Alert>
      </Snackbar>

      <ThreadMessageActions
        picked={picked}
        onClose={() => setPicked(null)}
        messages={thread.messages}
        currentUserId={currentUserId}
        onReply={composer.reply}
        onEdit={composer.edit}
        onEditAlbum={media.editAlbum}
        onReact={thread.react}
        onUnsend={async (id) => {
          await thread.remove(id);
          composer.cancelEditFor(id);
        }}
        onError={setActionError}
      />
      <ChoosePhotosDialog {...media.photoSelection} />
      <AlbumPicker {...media.albumPicker} />
      <Lightbox {...media.lightbox} />

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
    </Box>
  );
}
