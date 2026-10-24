import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { TOUCH_TARGET, ink, surface } from '@tumbaland/frontend-core';
import type { VoiceMessage } from '../../hooks/useVoiceMessage';
import { MAX_VOICE_MS, formatDuration } from '../../services/voice';

/** There for a screen reader, not on screen. */
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap'
} as const;

/**
 * The composer's row while a voice message is being recorded, sent or held: the
 * timer, the status in words, and Send in place of the text box.
 */
export function VoiceRow({ voice, accent }: { voice: VoiceMessage; accent: string }) {
  const sendingVoice = voice.progress != null;
  const nearLimit = voice.state === 'recording' && voice.elapsedMs >= MAX_VOICE_MS - 30_000;
  const showLevels = voice.state === 'recording' && voice.levels.some((level) => level > 0.02);
  const voiceStatus = sendingVoice
    ? voice.progress
      ? `Sending ${voice.progress}%`
      : 'Sending'
    : voice.held?.reason === 'failed'
      ? 'Not sent. Press send to try again'
      : voice.held
        ? 'Recording stopped. Send it?'
        : voice.state === 'starting'
          ? 'Waiting for the microphone'
          : 'Recording';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 1 }}>
      <IconButton
        aria-label="Discard voice message"
        onClick={voice.discard}
        disabled={sendingVoice}
        sx={{ color: ink.muted, width: TOUCH_TARGET, height: TOUCH_TARGET }}
      >
        <DeleteOutlineIcon />
      </IconButton>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: TOUCH_TARGET,
          px: 1.5,
          borderRadius: 3,
          bgcolor: surface.sunken
        }}
      >
        {voice.state === 'recording' && (
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: 'error.main',
              animation: 'voice-pulse 1.2s ease-in-out infinite',
              '@keyframes voice-pulse': { '50%': { opacity: 0.3 } }
            }}
          />
        )}
        <Typography
          variant="body2"
          sx={{
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
            color: nearLimit ? 'error.main' : 'inherit'
          }}
        >
          {formatDuration(voice.held ? voice.held.recording.durationMs : voice.elapsedMs)}
        </Typography>
        {/* The bars once the microphone is heard; the words until then, and
            for a screen reader always. Only the words are announced: the
            timer would be read out ten times a second. */}
        {showLevels && <LevelBars levels={voice.levels} />}
        <Typography
          variant="body2"
          noWrap
          role="status"
          sx={{
            color: voice.held && !sendingVoice ? 'error.main' : ink.muted,
            ...(showLevels ? visuallyHidden : {})
          }}
        >
          {voiceStatus}
        </Typography>
        {nearLimit && (
          <Typography variant="caption" noWrap sx={{ flexShrink: 0, ml: 'auto', color: 'error.main' }}>
            {formatDuration(MAX_VOICE_MS - voice.elapsedMs)} left
          </Typography>
        )}
      </Box>

      <IconButton
        aria-label="Send voice message"
        onClick={() => void voice.finish()}
        disabled={voice.state === 'starting' || sendingVoice}
        aria-busy={sendingVoice || undefined}
        sx={{
          width: TOUCH_TARGET,
          height: TOUCH_TARGET,
          color: '#fff',
          bgcolor: accent,
          '&:hover': { bgcolor: accent, filter: 'brightness(0.94)' },
          '&.Mui-disabled': { bgcolor: surface.sunken, color: ink.muted }
        }}
      >
        {sendingVoice ? (
          <CircularProgress
            size={18}
            color="inherit"
            // Indeterminate until the first byte is counted, so a slow start still moves.
            variant={voice.progress ? 'determinate' : 'indeterminate'}
            value={voice.progress ?? 0}
          />
        ) : (
          <SendIcon fontSize="small" />
        )}
      </IconButton>
    </Box>
  );
}

/**
 * The microphone's loudness as a row of bars, newest on the right, so a
 * person can see they are being heard.
 */
function LevelBars({ levels }: { levels: number[] }) {
  return (
    <Box
      aria-hidden
      sx={{
        flex: 1,
        minWidth: 0,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '2px',
        overflow: 'hidden'
      }}
    >
      {levels.map((level, index) => (
        <Box
          key={index}
          sx={{
            flexShrink: 0,
            width: 3,
            height: `${Math.max(12, level * 100)}%`,
            borderRadius: 1,
            bgcolor: ink.muted,
            opacity: 0.75
          }}
        />
      ))}
    </Box>
  );
}
