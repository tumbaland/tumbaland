import { useCallback, useState } from 'react';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { ThreadHeader } from './ThreadHeader';
import { ThemePicker } from './ThemePicker';
import { AlbumPicker } from './AlbumPicker';
import { AlbumCollageDialog } from './AlbumCollageDialog';
import { chatColors, themeById } from './themes';
import { chatApi } from '../../services/chatApi';
import { requestCall } from '../../services/callBus';
import { isGeolocationSupported } from '../../services/live';
import type { UseChatThreadResult } from '../../hooks/useChatThread';

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
  onOpenCollage
}: Props) {
  const [choosingTheme, setChoosingTheme] = useState(false);
  const [albumAndCollage, setAlbumAndCollage] = useState(false);
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
          }
        ]}
      />
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
