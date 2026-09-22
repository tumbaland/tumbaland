import { Suspense, useState } from 'react';
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

interface ChatPanelProps {
  onClose: () => void;
}

/**
 * Chat docked on the right of a desktop screen, so a conversation stays in
 * view while the rest of Tumbaland is used on the left.
 *
 * Narrow on purpose: it is for keeping up with what comes in and answering
 * quickly. The full page is one click away for anything longer.
 */
export function ChatPanel({ onClose }: ChatPanelProps) {
  const [attempt, setAttempt] = useState(0);
  const Remote = remoteComponent(chat, CHAT_PANEL_MODULE);

  return (
    <Box
      component="aside"
      aria-label="Chat"
      sx={{
        width: 'clamp(300px, 26vw, 380px)',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: `1px solid ${surface.chromeEdge}`,
        bgcolor: surface.default
      }}
    >
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
        <Tooltip title="Open full page">
          <IconButton component={Link} to={CHAT_APP.route} size="small" aria-label="Open chat full page">
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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
