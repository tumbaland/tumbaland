import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import { ink, surface } from '@tumbaland/frontend-core';
import { formatDuration } from '../../services/voice';
import type { Attachment } from '../../types';

export interface VoiceNoteProps {
  attachment: Attachment;
  /** Drawn in white on your own coloured bubble. */
  mine: boolean;
}

/**
 * The one voice message playing. Starting another stops it, as in every other
 * chat app: two at once is never what was meant.
 */
let playing: HTMLAudioElement | null = null;

/** What the speed button steps through. */
const SPEEDS = [1, 1.5, 2] as const;

/**
 * A voice message in a bubble: play or pause, how far through, and how long.
 *
 * The length comes from the message, timed while it was recorded, because a
 * browser-made WebM carries none and its player reports Infinity.
 */
export function VoiceNote({ attachment, mine }: VoiceNoteProps) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [failed, setFailed] = useState(false);
  const [mediaMs, setMediaMs] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  /**
   * The link the player loaded. Every update to the message (a reaction, an
   * edit) arrives with a freshly signed link, and handing that to the element
   * would reload it and stop the message mid-sentence. A new link is taken
   * only when there was none yet, or when the old one stops working.
   */
  const [src, setSrc] = useState(attachment.url ?? null);
  if (!src && attachment.url) setSrc(attachment.url);

  const totalMs = attachment.durationMs || mediaMs;
  const started = isPlaying || positionMs > 0;

  // Scrolling it out of the thread, or unsending it, stops it.
  useEffect(
    () => () => {
      if (playing === audio.current) playing = null;
      audio.current?.pause();
    },
    []
  );

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    if (playing && playing !== element) playing.pause();
    playing = element;
    element.playbackRate = speed;
    element.play().catch((error: DOMException) => {
      // Interrupted by a pause or a new link, not a file that cannot play.
      if (error.name !== 'AbortError') setFailed(true);
    });
  };

  const seek = (ms: number) => {
    const element = audio.current;
    if (!element || !totalMs) return;
    element.currentTime = ms / 1000;
    setPositionMs(ms);
  };

  const nextSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const colour = mine ? '#fff' : ink.body;
  const track = mine ? 'rgba(255,255,255,0.35)' : surface.sunken;
  // Still sending has no link yet, and that is not worth a word: the bubble is
  // already drawn faint. A stored message without one is unavailable.
  const unavailable = !src || failed;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 240, maxWidth: '100%', my: 0.25 }}>
      <IconButton
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        disabled={unavailable}
        onClick={toggle}
        sx={{
          flexShrink: 0,
          width: 40,
          height: 40,
          color: colour,
          bgcolor: track,
          '&:hover': { bgcolor: track },
          '&.Mui-disabled': { color: colour, opacity: 0.5 }
        }}
      >
        {isPlaying ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
      </IconButton>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Slider
          size="small"
          aria-label="Position in voice message"
          aria-valuetext={`${formatDuration(positionMs)} of ${formatDuration(totalMs)}`}
          value={Math.min(positionMs, totalMs)}
          max={totalMs || 1}
          disabled={unavailable || !totalMs}
          onChange={(_, value) => seek(value as number)}
          // A long press on the bubble opens the reaction picker; dragging the
          // position must not.
          onTouchStart={(event) => event.stopPropagation()}
          sx={{
            display: 'block',
            color: colour,
            py: 1,
            '@media (pointer: coarse)': { py: 1.25 },
            '& .MuiSlider-rail': { bgcolor: track, opacity: 1 },
            '& .MuiSlider-thumb': { width: 12, height: 12, boxShadow: 'none' },
            '& .MuiSlider-thumb:hover, & .MuiSlider-thumb.Mui-focusVisible': { boxShadow: 'none' },
            '&.Mui-disabled': { color: colour, opacity: 0.6 }
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: -0.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: mine ? 'inherit' : ink.muted,
              opacity: mine ? 0.85 : 1,
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {failed
              ? 'Cannot play this here'
              : !src && attachment.url === null
                ? 'Not available'
                : formatDuration(started ? positionMs : totalMs)}
          </Typography>
          {started && !failed && (
            <Box
              component="button"
              type="button"
              aria-label={`Playback speed ${speed}×`}
              onClick={nextSpeed}
              sx={{
                border: 'none',
                borderRadius: 2,
                px: 0.75,
                py: 0,
                font: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.6,
                cursor: 'pointer',
                color: colour,
                bgcolor: track
              }}
            >
              {speed}×
            </Box>
          )}
        </Box>
      </Box>

      {src && (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(event) => setPositionMs(event.currentTarget.currentTime * 1000)}
          onLoadedMetadata={(event) => {
            const seconds = event.currentTarget.duration;
            if (Number.isFinite(seconds)) setMediaMs(seconds * 1000);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setPositionMs(0);
            if (playing === audio.current) playing = null;
          }}
          onError={() => {
            // An hour on, the signed link has expired. The message has a fresh
            // one by now if anything has touched it; try that before giving up.
            if (attachment.url && attachment.url !== src) setSrc(attachment.url);
            else setFailed(true);
          }}
        />
      )}
    </Box>
  );
}
