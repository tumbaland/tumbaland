import { Suspense, useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { Loader, chrome, ink, surface } from '@tumbaland/frontend-core';
import { CHAT_APP, type RemoteApp } from '../config/apps';
import { forgetRemote, remoteComponent } from '../remotes';
import { RemoteBoundary } from './RemoteBoundary';

/** The module chat-front exposes for this panel, beside its full-page `./App`. */
export const CHAT_PANEL_MODULE = './Panel';

const chat = CHAT_APP as RemoteApp;

/** How wide the side panel starts, and the range a drag can take it to. */
export const PANEL_WIDTH = { initial: 440, min: 320, maxShare: 0.6, step: 24 } as const;
/** The width someone dragged it to, kept across visits like whether it is open. */
const WIDTH_KEY = 'tumbaland.chatPanel.width';

/** Within the range, and never wider than the share of the window that leaves the page beside it usable. */
export function clampWidth(width: number, windowWidth: number): number {
  const max = Math.max(PANEL_WIDTH.min, Math.round(windowWidth * PANEL_WIDTH.maxShare));
  return Math.round(Math.min(Math.max(width, PANEL_WIDTH.min), max));
}

function readWidth(): number {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return clampWidth(saved > 0 ? saved : PANEL_WIDTH.initial, window.innerWidth);
  } catch {
    return PANEL_WIDTH.initial;
  }
}

function saveWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // Private mode: it is wide for this visit only.
  }
}

interface ChatPanelProps {
  onClose: () => void;
  /** Fills the element it is drawn in (docked in a module's page) rather than the side column. */
  fill?: boolean;
}

/**
 * Chat docked on the right of a desktop screen, so a conversation stays in
 * view while the rest of Tumbaland is used on the left.
 *
 * Wide enough to read a conversation by default, and as wide as someone likes
 * by dragging its left edge (or with the arrow keys on it), which is
 * remembered. The full page is one click away for anything longer.
 */
export function ChatPanel({ onClose, fill = false }: ChatPanelProps) {
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(readWidth);
  const [dragging, setDragging] = useState(false);
  const Remote = remoteComponent(chat, CHAT_PANEL_MODULE);

  // A smaller window takes it back within range; the saved width stays for a bigger one.
  useEffect(() => {
    if (fill) return;
    const fit = () => setWidth((current) => clampWidth(current, window.innerWidth));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fill]);

  const resize = (next: number) => {
    const clamped = clampWidth(next, window.innerWidth);
    setWidth(clamped);
    saveWidth(clamped);
  };

  // The edge follows the pointer: the panel is on the right, so moving left widens it.
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;
    handle.setPointerCapture?.(event.pointerId);
    setDragging(true);
    const move = (moved: globalThis.PointerEvent) => setWidth(clampWidth(startWidth + startX - moved.clientX, window.innerWidth));
    const stop = (ended: globalThis.PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
      setDragging(false);
      resize(startWidth + startX - ended.clientX);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  };

  const onHandleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const by = { ArrowLeft: PANEL_WIDTH.step, ArrowRight: -PANEL_WIDTH.step }[event.key];
    if (by === undefined) return;
    event.preventDefault();
    resize(width + by);
  };

  return (
    <Box
      component="aside"
      aria-label="Chat"
      sx={{
        position: 'relative',
        width: fill ? '100%' : width,
        flexShrink: 0,
        // No text gets selected while the edge is dragged across it.
        userSelect: dragging ? 'none' : undefined,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: fill ? 'none' : `1px solid ${surface.chromeEdge}`,
        bgcolor: surface.default
      }}
    >
      {!fill && (
        <Box
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat"
          aria-valuenow={width}
          aria-valuemin={PANEL_WIDTH.min}
          tabIndex={0}
          title="Drag to resize, double-click to reset"
          onPointerDown={startDrag}
          onKeyDown={onHandleKey}
          onDoubleClick={() => resize(PANEL_WIDTH.initial)}
          sx={{
            position: 'absolute',
            left: -3,
            top: 0,
            bottom: 0,
            width: 6,
            zIndex: 2,
            cursor: 'col-resize',
            touchAction: 'none',
            bgcolor: dragging ? 'primary.main' : 'transparent',
            transition: 'background-color .15s ease',
            '&:hover, &:focus-visible': { bgcolor: 'primary.main', outline: 'none' }
          }}
        />
      )}
      <Box
        sx={{
          ...chrome,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: 2,
          pr: 0.5,
          minHeight: 48,
          borderBottom: `1px solid ${surface.chromeEdge}`
        }}
      >
        <Box component="span" sx={{ flex: 1, fontSize: 15, fontWeight: 700, color: ink.strong }}>
          {CHAT_APP.name}
        </Box>
        {/* Not from inside a module's page: leaving it is that page's call. */}
        {!fill && (
          <Tooltip title="Open full page">
            <IconButton component={Link} to={CHAT_APP.route} size="small" aria-label="Open chat full page">
              <OpenInFullIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Close">
          <IconButton size="small" aria-label="Close chat" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <RemoteBoundary
          key={attempt}
          appTitle={CHAT_APP.name}
          onRetry={() => {
            forgetRemote(chat, CHAT_PANEL_MODULE);
            setAttempt((n) => n + 1);
          }}
        >
          <Suspense fallback={<Loader message="Loading chat" />}>
            {/* Cached per app and module, the same identity rule as RemoteOutlet. */}
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Remote />
          </Suspense>
        </RemoteBoundary>
      </Box>
    </Box>
  );
}

export default ChatPanel;
