import Alert from '@mui/material/Alert';
import { DriveScreen } from './DriveScreen';
import { LiveBanner } from './LiveBanner';
import { LiveViewer } from './LiveViewer';
import type { useThreadLocation } from '../../hooks/useThreadLocation';
import type { LiveShare } from '../../types';

interface Props {
  conversationId: string | undefined;
  currentUserId: string;
  shares: LiveShare[];
  location: ReturnType<typeof useThreadLocation>;
}

/** The location banner and its maps share a component scope, separate from the composer. */
export function ThreadLocation({ conversationId, currentUserId, shares, location }: Props) {
  const { drive, open, ownShare, watchedShare, audience } = location;
  return (
    <>
      {drive.error && !open && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {drive.error}
        </Alert>
      )}
      <LiveBanner
        shares={shares}
        currentUserId={currentUserId}
        sending={drive.state === 'sharing'}
        onOpenOwn={location.openMap}
        onStopOwn={drive.stop}
        onOpenOther={location.watch}
      />
      {conversationId && (
        <DriveScreen
          key={conversationId}
          open={open}
          onClose={location.closeMap}
          conversationId={conversationId}
          drive={drive}
          share={ownShare}
          audience={audience}
        />
      )}
      {watchedShare && conversationId && (
        <LiveViewer
          key={`${conversationId}:${watchedShare.userId}`}
          open
          onClose={location.closeViewer}
          conversationId={conversationId}
          share={watchedShare}
          currentUserId={currentUserId}
          onShareChange={location.updateShare}
        />
      )}
    </>
  );
}
