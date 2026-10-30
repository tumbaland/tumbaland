import { useCallback, useState } from 'react';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { ThreadHeader } from './ThreadHeader';
import { ThemePicker } from './ThemePicker';
import { AlbumPicker } from './AlbumPicker';
import { AlbumCollageDialog } from './AlbumCollageDialog';
import { AssistantsDialog } from './AssistantsDialog';
import { BotEditorDialog } from './BotEditorDialog';
import { chatColors, themeById } from './themes';
import { chatApi } from '../../services/chatApi';
import { requestCall } from '../../services/callBus';
import { isGeolocationSupported } from '../../services/live';
import type { UseChatThreadResult } from '../../hooks/useChatThread';

/** Under "Assistants" in the menu: where things stand, in a few words. */
export function assistantsSummary(view: UseChatThreadResult['assistants']): string | undefined {
  if (!view) return undefined;
  if (view.lockedOff) return 'Turned off by an admin';
  if (!view.enabled) return 'Off';
  const active = view.bots.filter((bot) => !bot.paused).map((bot) => bot.name);
  if (active.length === 0) return view.bots.length === 0 ? 'On, none added yet' : 'On, all paused';
  return active.length <= 2 ? active.join(' and ') : `${active.slice(0, 2).join(', ')} and ${active.length - 2} more`;
}

interface Props {
  conversationId: string | undefined;
  currentUserId: string;
  thread: Pick<
    UseChatThreadResult,
    | 'members'
    | 'title'
    | 'presence'
    | 'typingNames'
    | 'reads'
    | 'messages'
    | 'appearance'
    | 'photoAlbum'
    | 'setAppearance'
    | 'setPhotoAlbum'
    | 'startCollage'
    | 'assistants'
    | 'refreshAssistants'
    | 'assistantActions'
  >;
  onBack?: () => void;
  onSearch: () => void;
  onLocation: () => void;
  sharing: boolean;
  onRecordVoice?: () => void;
  recordingVoice: boolean;
  choosingAlbum: boolean;
  onCloseAlbum: () => void;
  onOpenCollage: (collageId: string) => void;
  /** An assistant whose name was tapped in the thread: its settings are open. */
  openBotId?: string | null;
  onCloseBot?: () => void;
}

/** The thread header, calls and conversation settings. Message-level album changes live with media. */
export function ThreadToolbar({
  conversationId,
  currentUserId,
  thread,
  onBack,
  onSearch,
  onLocation,
  sharing,
  onRecordVoice,
  recordingVoice,
  choosingAlbum,
  onCloseAlbum,
  onOpenCollage,
  openBotId = null,
  onCloseBot = () => {}
}: Props) {
  const [choosingTheme, setChoosingTheme] = useState(false);
  const [albumAndCollage, setAlbumAndCollage] = useState(false);
  const [assistantsOpen, setAssistantsOpen] = useState(false);
  // Gone from the view, removed here or by someone else, and the dialog closes.
  const tappedBot = (openBotId && thread.assistants?.bots.find((bot) => bot.id === openBotId)) || null;
  const loadAlbums = useCallback(
    () => (conversationId ? chatApi.listAlbums(conversationId) : Promise.resolve([])),
    [conversationId]
  );
  const theme = themeById(thread.appearance.theme);
  const albumLabel =
    thread.photoAlbum.mode === 'album'
      ? (thread.photoAlbum.albumName ?? 'An album')
      : thread.photoAlbum.mode === 'off'
        ? 'Not saving to Album'
        : 'Not chosen yet';

  // Presence falls back to the newest stored message or read receipt.
  const lastSeen: Record<string, string> = {};
  const note = (userId: string, iso: string | null | undefined) => {
    if (iso && (!lastSeen[userId] || new Date(iso) > new Date(lastSeen[userId]!))) lastSeen[userId] = iso;
  };
  for (const read of Object.values(thread.reads)) note(read.userId, read.lastReadAt);
  for (const message of thread.messages) {
    if (message.kind !== 'system' && message.delivery !== 'pending' && message.delivery !== 'failed')
      note(message.senderId, message.createdAt);
  }
  const others = thread.members.filter((member) => member.userId !== currentUserId);
  const callable =
    currentUserId && conversationId && others.length === 1
      ? {
          userId: others[0]!.userId,
          name: others[0]!.name || others[0]!.email,
          picture: others[0]!.picture ?? null
        }
      : null;
  const startCollage = async (title: string, clientId: string) => {
    const card = await thread.startCollage(title, clientId);
    if (card?.collage) onOpenCollage(card.collage.id);
  };

  return (
    <>
      <ThreadHeader
        members={thread.members}
        currentUserId={currentUserId}
        title={thread.title}
        presence={thread.presence}
        typingNames={thread.typingNames}
        onBack={onBack}
        background={chatColors.header}
        accent={chatColors.headerAccent}
        lastSeen={lastSeen}
        onCall={callable ? () => requestCall({ conversationId: conversationId!, peer: callable }) : undefined}
        onRecordVoice={onRecordVoice}
        recordingVoice={recordingVoice}
        onLocation={isGeolocationSupported() ? onLocation : undefined}
        sharingLocation={sharing}
        menu={[
          { label: 'Search messages', icon: <SearchIcon fontSize="small" />, onClick: onSearch },
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
          },
          {
            label: 'Assistants',
            secondary: assistantsSummary(thread.assistants),
            icon: <AutoAwesomeOutlinedIcon fontSize="small" />,
            onClick: () => setAssistantsOpen(true)
          }
        ]}
      />
      <AssistantsDialog
        open={assistantsOpen}
        onClose={() => setAssistantsOpen(false)}
        view={thread.assistants}
        onRefresh={thread.refreshAssistants}
        actions={thread.assistantActions}
      />
      {thread.assistants && (
        <BotEditorDialog
          open={tappedBot !== null}
          onClose={onCloseBot}
          bot={tappedBot}
          view={thread.assistants}
          onCreate={thread.assistantActions.createBot}
          onUpdate={thread.assistantActions.updateBot}
          onDelete={thread.assistantActions.deleteBot}
          onChangeSettings={thread.assistantActions.change}
          onOpenSettings={() => {
            onCloseBot();
            setAssistantsOpen(true);
          }}
        />
      )}
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
      <AlbumPicker
        open={choosingAlbum}
        onClose={onCloseAlbum}
        current={thread.photoAlbum}
        loadAlbums={loadAlbums}
        onChoose={thread.setPhotoAlbum}
      />
    </>
  );
}
