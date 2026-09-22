import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CallIcon from '@mui/icons-material/Call';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import type { ReactNode } from 'react';
import { MemberAvatar } from '../thread/MemberAvatar';
import type { CallState } from '../../services/callEngine';

export interface CallScreenProps {
  state: CallState;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onDismiss: () => void;
  /** Shrunk to a bar, so the rest of Tumbaland can be used while talking. */
  minimized?: boolean;
  onMinimize?: () => void;
  onExpand?: () => void;
}

/** "3:07", or "1:02:07" past the hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Ticks once a second while a call is connected. */
function useElapsed(since: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since === null ? null : formatElapsed(now - since);
}

/** What the line under the name says. */
export function statusText(state: CallState, elapsed: string | null): string {
  switch (state.phase) {
    case 'outgoing':
      return state.call ? 'Ringing…' : 'Calling…';
    case 'incoming':
      return 'Calling you';
    case 'connecting':
      return 'Connecting…';
    case 'active':
      return state.reconnecting ? 'Reconnecting…' : (elapsed ?? '0:00');
    case 'ended':
      return state.message ?? 'Call ended';
    default:
      return '';
  }
}

function RoundButton({
  label,
  color,
  onClick,
  children
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <ButtonBase
        aria-label={label}
        onClick={onClick}
        sx={{
          width: 68,
          height: 68,
          borderRadius: '50%',
          bgcolor: color,
          color: '#fff',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          '& svg': { fontSize: 30 }
        }}
      >
        {children}
      </ButtonBase>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
        {label}
      </Typography>
    </Box>
  );
}

const RED = '#dc2626';
const GREEN = '#16a34a';
const GLASS = 'rgba(255,255,255,0.18)';

/**
 * The call as a small bar at the bottom of the screen, clear of the chat
 * composer and the phone's tab bar, so a call can run while the rest of the
 * app is used. Tapping the name brings the full screen back.
 */
function CallBar({
  state,
  elapsed,
  onHangUp,
  onToggleMute,
  onExpand
}: {
  state: CallState;
  elapsed: string | null;
  onHangUp: () => void;
  onToggleMute: () => void;
  onExpand?: () => void;
}) {
  const name = state.peer?.name || 'Call';
  const talking = state.phase === 'connecting' || state.phase === 'active';
  return (
    <Box
      role="region"
      aria-label={`Call with ${name}`}
      sx={{
        position: 'fixed',
        zIndex: 1600,
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: { xs: 'calc(env(safe-area-inset-bottom) + 88px)', sm: 24 },
        width: 'min(360px, calc(100vw - 32px))',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 0.75,
        pr: 0.75,
        py: 0.75,
        borderRadius: 999,
        background: 'linear-gradient(165deg, #134e4a 0%, #0f172a 100%)',
        color: '#fff',
        boxShadow: '0 10px 30px rgba(15,23,42,0.35)'
      }}
    >
      <ButtonBase
        onClick={onExpand}
        aria-label="Open call"
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          justifyContent: 'flex-start',
          borderRadius: 999
        }}
      >
        <MemberAvatar name={name} picture={state.peer?.picture ?? null} size={36} />
        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, lineHeight: 1.25 }}>
            {name}
          </Typography>
          <Typography
            variant="caption"
            noWrap
            component="p"
            sx={{ color: 'rgba(255,255,255,0.8)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}
          >
            {statusText(state, elapsed)}
          </Typography>
        </Box>
      </ButtonBase>
      {talking && (
        <IconButton
          aria-label={state.muted ? 'Unmute' : 'Mute'}
          onClick={onToggleMute}
          sx={{
            color: state.muted ? '#0f172a' : '#fff',
            bgcolor: state.muted ? '#fff' : GLASS,
            '&:hover': { bgcolor: state.muted ? '#fff' : GLASS }
          }}
        >
          {state.muted ? <MicOffIcon /> : <MicIcon />}
        </IconButton>
      )}
      <IconButton aria-label="End" onClick={onHangUp} sx={{ color: '#fff', bgcolor: RED, '&:hover': { bgcolor: RED } }}>
        <CallEndIcon />
      </IconButton>
    </Box>
  );
}

/**
 * The whole screen during a call, over whatever page is open.
 *
 * Also where the other person's audio plays: an `<audio>` element is the one
 * thing every browser, iOS included, reliably plays a WebRTC stream through.
 */
export function CallScreen({
  state,
  onAccept,
  onDecline,
  onHangUp,
  onToggleMute,
  onDismiss,
  minimized = false,
  onMinimize,
  onExpand
}: CallScreenProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const elapsed = useElapsed(state.phase === 'active' ? state.connectedAt : null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = state.remoteStream;
    if (state.remoteStream) void element.play().catch(() => undefined);
  }, [state.remoteStream]);

  if (state.phase === 'idle') return null;

  const name = state.peer?.name || 'Call';
  const talking = state.phase === 'connecting' || state.phase === 'active';
  // A ringing call or an ending one always gets the whole screen.
  const asBar = minimized && (talking || state.phase === 'outgoing');

  // The audio element comes first and in the same place either way, so
  // switching between the bar and the full screen never interrupts the sound.
  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />
      {asBar ? (
        <CallBar state={state} elapsed={elapsed} onHangUp={onHangUp} onToggleMute={onToggleMute} onExpand={onExpand} />
      ) : (
        <Box
          role="dialog"
          aria-label={`Call with ${name}`}
          sx={{
            position: 'fixed',
            inset: 0,
            // Above MUI's dialogs, snackbars and tooltips: nothing else belongs on
            // top of a call.
            zIndex: 1600,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pt: 'calc(env(safe-area-inset-top) + 72px)',
            pb: 'calc(env(safe-area-inset-bottom) + 56px)',
            background: 'linear-gradient(165deg, #134e4a 0%, #0f172a 75%)',
            color: '#fff'
          }}
        >
          {onMinimize && (talking || state.phase === 'outgoing') && (
            <IconButton
              aria-label="Minimize call"
              onClick={onMinimize}
              sx={{
                position: 'absolute',
                top: 'calc(env(safe-area-inset-top) + 12px)',
                left: 12,
                color: '#fff'
              }}
            >
              <CloseFullscreenIcon />
            </IconButton>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
            <MemberAvatar name={name} picture={state.peer?.picture ?? null} size={112} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {name}
            </Typography>
            <Typography
              variant="body1"
              aria-live="polite"
              sx={{ color: 'rgba(255,255,255,0.8)', fontVariantNumeric: 'tabular-nums', maxWidth: 320 }}
            >
              {statusText(state, elapsed)}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {state.phase === 'incoming' && (
              <>
                <RoundButton label="Decline" color={RED} onClick={onDecline}>
                  <CallEndIcon />
                </RoundButton>
                <RoundButton label="Answer" color={GREEN} onClick={onAccept}>
                  <CallIcon />
                </RoundButton>
              </>
            )}

            {(talking || state.phase === 'outgoing') && (
              <>
                {talking && (
                  <RoundButton
                    label={state.muted ? 'Unmute' : 'Mute'}
                    color={state.muted ? '#fff' : GLASS}
                    onClick={onToggleMute}
                  >
                    {state.muted ? <MicOffIcon sx={{ color: '#0f172a' }} /> : <MicIcon />}
                  </RoundButton>
                )}
                <RoundButton label="End" color={RED} onClick={onHangUp}>
                  <CallEndIcon />
                </RoundButton>
              </>
            )}

            {state.phase === 'ended' && (
              <RoundButton label="Close" color={GLASS} onClick={onDismiss}>
                <CallEndIcon />
              </RoundButton>
            )}
          </Box>
        </Box>
      )}
    </>
  );
}
