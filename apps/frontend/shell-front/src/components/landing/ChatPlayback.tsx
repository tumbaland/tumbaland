import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography, useMediaQuery } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { brand, gradient, ink, moduleAccent } from '@tumbaland/frontend-core';
import { PhoneFrame, SCREEN } from './PhoneFrame';
import { PhotoTile, type PhotoScene } from './PhotoTile';
import { CHAT, ENTRY_CARD, STATS_CARD, type ChatTurn } from './chatScript';

/**
 * The sample exchange, played the way a real one arrives: the message is sent,
 * the connector's tools run and tick off one by one, the reply types itself
 * out, and what it found draws underneath. Older turns scroll off the top of
 * the phone as the next one lands, so what a visitor sees is a recording of
 * the thing working rather than four bubbles sitting there already answered.
 *
 * It is a recording made of markup, not a video file: a few kilobytes instead
 * of a megabyte on a phone, sharp at any size, and the copy stays greppable
 * and translatable. Where there is no room for the wait, there is no wait:
 * everything on screen is a pure function of one clock, so the finished state
 * is the clock at its end, which is what someone who asked for less motion and
 * anyone whose browser cannot start it gets.
 */

const MONO = '"SFMono-Regular", Menlo, Consolas, monospace';
/** A finished tool call, and a live connection. */
const DONE_GREEN = '#15803d';
const TOOL_MS = 620;
const WORD_MS = 42;
const CARD_MS = 1150;
const SENT_MS = 620;
const GAP_MS = 420;

interface Timed {
  start: number;
  duration: number;
}

interface TurnSchedule {
  appear: number;
  tools: (Timed & { name: string })[];
  answer: Timed;
  card?: Timed;
  done: number;
}

/** When each part of each turn starts, and how long it runs. */
function schedule(turns: ChatTurn[]): { turns: TurnSchedule[]; total: number } {
  let clock = 400;
  const scheduled = turns.map((turn) => {
    const appear = clock;
    if (turn.from === 'you') {
      clock += SENT_MS + GAP_MS;
      return { appear, tools: [], answer: { start: appear, duration: 1 }, done: clock };
    }
    const tools = (turn.tools ?? []).map((name, index) => ({
      name,
      start: appear + index * TOOL_MS,
      duration: TOOL_MS
    }));
    clock = appear + tools.length * TOOL_MS;
    const answer = { start: clock, duration: turn.text.split(' ').length * WORD_MS };
    clock += answer.duration;
    const card = turn.card ? { start: clock + 120, duration: CARD_MS } : undefined;
    if (card) clock = card.start + card.duration;
    clock += GAP_MS;
    return { appear, tools, answer, card, done: clock };
  });
  return { turns: scheduled, total: clock };
}

const progressOf = (t: number, { start, duration }: Timed) => Math.min(1, Math.max(0, (t - start) / duration));

/** Staggered reveal: item `index` of `count`, over the card's own progress. */
function stagger(progress: number, index: number, count: number): number {
  const each = 1 / (count + 1);
  return Math.min(1, Math.max(0, (progress - index * each) / each));
}

const card = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(15,23,42,0.06)',
  borderRadius: '12px',
  boxShadow: '0 8px 18px -14px rgba(31,38,135,0.6)'
} as const;

/** The evening, as the journal shows it back. The point is that it really landed. */
function EntryCard({ progress }: { progress: number }) {
  return (
    <Box sx={{ ...card, mt: '6px', p: '9px 10px' }}>
      <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: brand.violetInk, mb: '6px' }}>
        {ENTRY_CARD.date}
      </Typography>
      {ENTRY_CARD.rows.map((row, index) => {
        const shown = stagger(progress, index, ENTRY_CARD.rows.length);
        return (
          <Box
            key={row.title}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              py: '3px',
              opacity: shown,
              transform: `translateX(${(1 - shown) * 6}px)`
            }}
          >
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: moduleAccent.journal, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: ink.strong, flexGrow: 1, minWidth: 0 }}>
              {row.title}
            </Typography>
            <Typography sx={{ fontSize: 9.5, color: ink.muted }}>{row.meta}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

const TREND_MARK = { up: '↑', steady: '→', down: '↓' } as const;
const TREND_LABEL = { up: 'picking up', steady: 'steady', down: 'fading' } as const;
const TOP_COUNT = Math.max(...STATS_CARD.rows.map((row) => row.count));

/** What you have been doing together, as bars that grow in turn. */
function StatsCard({ progress }: { progress: number }) {
  return (
    <Box sx={{ ...card, mt: '6px', p: '9px 10px' }}>
      <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: moduleAccent.journal, mb: '7px' }}>
        {STATS_CARD.title}
      </Typography>
      {STATS_CARD.rows.map((row, index) => {
        const grown = stagger(progress, index, STATS_CARD.rows.length);
        return (
          <Box key={row.name} sx={{ display: 'flex', alignItems: 'center', gap: '7px', mt: index === 0 ? 0 : '6px' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: ink.strong, width: 44, flexShrink: 0 }}>{row.name}</Typography>
            <Box sx={{ flexGrow: 1, height: 7, borderRadius: 999, background: 'rgba(239,68,68,0.10)', overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${(row.count / TOP_COUNT) * 100 * grown}%`,
                  borderRadius: 999,
                  background: row.trend === 'down' ? 'rgba(239,68,68,0.45)' : moduleAccent.journal
                }}
              />
            </Box>
            <Typography
              aria-label={`${row.count}, ${TREND_LABEL[row.trend]}`}
              sx={{ fontSize: 9.5, fontFamily: MONO, color: ink.muted, width: 26, textAlign: 'right', opacity: grown }}
            >
              {row.count} {TREND_MARK[row.trend]}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

const MEMORY_SCENES: PhotoScene[] = ['coast', 'city', 'garden', 'desert'];

/** What it found in the album, a year ago today. */
function PhotosCard({ progress }: { progress: number }) {
  return (
    <Box sx={{ ...card, mt: '6px', p: '9px 10px' }}>
      <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: moduleAccent.album, mb: '7px' }}>
        Nice, a year ago
      </Typography>
      <Box sx={{ display: 'flex', gap: '5px' }}>
        {MEMORY_SCENES.map((scene, index) => {
          const shown = stagger(progress, index, MEMORY_SCENES.length);
          return (
            <PhotoTile
              key={scene}
              scene={scene}
              radius={8}
              sx={{
                flex: 1,
                aspectRatio: '1 / 1',
                opacity: shown,
                transform: `scale(${0.88 + shown * 0.12})`
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

function Card({ kind, progress }: { kind: NonNullable<ChatTurn['card']>; progress: number }) {
  if (kind === 'entry') return <EntryCard progress={progress} />;
  if (kind === 'stats') return <StatsCard progress={progress} />;
  return <PhotosCard progress={progress} />;
}

function ToolCall({ name, progress }: { name: string; progress: number }) {
  const done = progress >= 1;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: progress > 0 ? 1 : 0, transition: 'opacity .2s ease' }}>
      {done ? (
        <CheckCircleIcon sx={{ fontSize: 11, color: DONE_GREEN }} />
      ) : (
        <CircularProgress size={9} thickness={7} sx={{ color: brand.violetInk }} />
      )}
      <Typography sx={{ fontFamily: MONO, fontSize: 9.5, color: done ? ink.muted : ink.body }}>{name}</Typography>
    </Box>
  );
}

function Turn({ turn, plan, t }: { turn: ChatTurn; plan: TurnSchedule; t: number }) {
  const visible = t >= plan.appear;
  const appear = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : 'translateY(8px)',
    transition: 'opacity .3s ease, transform .3s ease'
  } as const;

  if (turn.from === 'you') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', ...appear }}>
        <Box
          sx={{
            maxWidth: '82%',
            px: '11px',
            py: '8px',
            // Squared on the speaker's own side, the way every messaging app
            // does it: the shape alone says who is talking.
            borderRadius: '13px 13px 4px 13px',
            background: gradient.brand,
            color: '#fff',
            fontSize: 11.5,
            lineHeight: 1.45,
            boxShadow: `0 8px 18px -14px ${brand.magenta}`
          }}
        >
          {turn.text}
        </Box>
      </Box>
    );
  }

  const words = turn.text.split(' ');
  const shown = Math.round(progressOf(t, plan.answer) * words.length);

  return (
    <Box sx={{ display: 'flex', gap: '7px', maxWidth: '94%', ...appear }}>
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          flexShrink: 0,
          mt: '2px',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(147,51,234,0.18)'
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 11, color: brand.violetInk }} />
      </Box>

      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        {plan.tools.length > 0 && (
          <Box sx={{ display: 'grid', gap: '3px', mb: '5px', mt: '2px' }}>
            {plan.tools.map((tool) => (
              <ToolCall key={tool.name} name={tool.name} progress={progressOf(t, tool)} />
            ))}
          </Box>
        )}

        {shown > 0 && (
          <Typography
            sx={{
              px: '11px',
              py: '8px',
              borderRadius: '13px 13px 13px 4px',
              background: 'rgba(255,255,255,0.86)',
              border: '1px solid rgba(255,255,255,0.95)',
              color: ink.strong,
              fontSize: 11.5,
              lineHeight: 1.45
            }}
          >
            {shown >= words.length ? turn.text : words.slice(0, shown).join(' ')}
          </Typography>
        )}

        {turn.card && plan.card && t >= plan.card.start && (
          <Card kind={turn.card} progress={progressOf(t, plan.card)} />
        )}
      </Box>
    </Box>
  );
}

/** The chrome that makes the screen a chat: who is connected, and a message box. */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ height: SCREEN.height, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          px: '12px',
          pt: '16px',
          pb: '8px',
          borderBottom: '1px solid rgba(124,58,237,0.10)'
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: DONE_GREEN, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 10, color: ink.muted }}>Tumbaland connected</Typography>
      </Box>

      {/* Anchored to the bottom and clipped: as each turn arrives the ones
          before it ride up out of the top of the screen, which is what a chat
          does, and the screen below never moves. */}
      <Box sx={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '9px', px: '12px', py: '10px' }}>
          {children}
        </Box>
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 26,
            background: 'linear-gradient(to bottom, #fdf2fa, rgba(253,242,250,0))'
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px', px: '12px', pb: '14px', pt: '8px' }}>
        <Box
          sx={{
            flexGrow: 1,
            px: '10px',
            py: '7px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(15,23,42,0.07)',
            fontSize: 10.5,
            color: ink.faint
          }}
        >
          Message
        </Box>
        <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: gradient.brand, flexShrink: 0 }}>
          <SendIcon sx={{ fontSize: 13, color: '#fff' }} />
        </Box>
      </Box>
    </Box>
  );
}

interface ChatPlaybackProps {
  /** Placement and width, passed through to the frame. */
  sx?: Record<string, unknown>;
  testId?: string;
}

/** The phone with the exchange playing in it, and a way to watch it again. */
export function ChatPlayback({ sx, testId }: ChatPlaybackProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const canPlay = !reducedMotion && typeof IntersectionObserver !== 'undefined';
  const { turns: plan, total } = useMemo(() => schedule(CHAT), []);

  // Infinity is the finished conversation: every progress is 1, nothing is
  // mid-word, and no clock has to run to get there.
  const [t, setT] = useState(canPlay ? 0 : Infinity);
  const [started, setStarted] = useState(false);
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  /** The pending animation frame; 0 when none, and cancelling 0 is a no-op. */
  const frame = useRef(0);

  const play = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const begin = performance.now();
    const tick = (now: number) => {
      const elapsed = now - begin;
      setT(elapsed);
      frame.current = elapsed < total ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  }, [total]);

  // Starts the first time the phone is properly on screen, so a visitor who
  // lands and reads the headline has not already missed it.
  useEffect(() => {
    if (!canPlay || started || !screen) return;
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) {
          setStarted(true);
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(screen);
    return () => observer.disconnect();
  }, [canPlay, started, screen, play]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <Box
      ref={setScreen}
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ...sx }}
    >
      <PhoneFrame sx={{ width: '100%' }}>
        <Chrome>
          {CHAT.map((turn, index) => (
            <Turn key={`${turn.from}-${index}`} turn={turn} plan={plan[index]} t={t} />
          ))}
        </Chrome>
      </PhoneFrame>

      {/* Only where it plays: with nothing to replay the row is an empty
          promise, and on a phone it is 40px of nothing above the fold. */}
      {canPlay && (
        <Box sx={{ height: 34, display: 'grid', placeItems: 'center', mt: '6px' }}>
          {started && t >= total && (
            <Button
              size="small"
              startIcon={<ReplayIcon />}
              onClick={play}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13, color: brand.violetInk }}
            >
              Watch again
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

export default ChatPlayback;
