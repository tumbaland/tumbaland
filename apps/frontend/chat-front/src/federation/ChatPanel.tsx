import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ink, surface } from '@tumbaland/frontend-core';
import { ConfigProvider } from '../config/ConfigProvider';
import ConversationsPage from '../pages/ConversationsPage';
import ThreadPage from '../pages/ThreadPage';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { chatApi } from '../services/chatApi';
import type { Conversation } from '../types';

/** Which conversation the panel had open, so reopening it lands in the same place. */
const LAST_OPEN_KEY = 'tumbaland.chatPanel.conversation';

function readLastOpen(): string | null {
  try {
    return localStorage.getItem(LAST_OPEN_KEY);
  } catch {
    return null;
  }
}

function writeLastOpen(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_OPEN_KEY, id);
    else localStorage.removeItem(LAST_OPEN_KEY);
  } catch {
    // Private mode: the panel just opens on the list next time.
  }
}

/**
 * Chat as the shell's desktop side panel, beside whatever module is open.
 *
 * Not routed. The address bar belongs to the module on the left, and a second
 * router cannot be nested inside the shell's, so which conversation is open is
 * plain state here. Most people have one conversation, so the panel goes
 * straight into it; with several it starts on the list.
 */
function Panel() {
  const { user } = useCurrentUser();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    chatApi
      .ensureMyConversations()
      .then((list) => {
        if (!active) return;
        setConversations(list);
        const last = readLastOpen();
        const remembered = list.find((conversation) => conversation.id === last);
        if (remembered) setOpenId(remembered.id);
        else if (list.length === 1) setOpenId(list[0]!.id);
      })
      .catch((cause: Error) => active && setError(cause.message));
    return () => {
      active = false;
    };
  }, []);

  const open = (id: string | null) => {
    setOpenId(id);
    writeLastOpen(id);
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!conversations || !user) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!openId) {
    return (
      <Box sx={{ height: '100%', overflowY: 'auto' }}>
        <ConversationsPage currentUserId={user.id} onOpen={open} />
      </Box>
    );
  }

  const current = conversations.find((conversation) => conversation.id === openId);
  const others = current?.members.filter((member) => member.userId !== user.id) ?? [];
  const name = current?.title || others.map((member) => member.name || member.email).join(', ') || 'Chat';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {conversations.length > 1 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.5,
            py: 0.25,
            borderBottom: `1px solid ${surface.sunken}`,
            bgcolor: surface.paper
          }}
        >
          <IconButton size="small" aria-label="Back to conversations" onClick={() => open(null)}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle2" noWrap sx={{ color: ink.strong }}>
            {name}
          </Typography>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {/* Keyed so switching conversations starts a clean thread. */}
        <ThreadPage key={openId} conversationId={openId} />
      </Box>
    </Box>
  );
}

export default function ChatPanel() {
  return (
    <ConfigProvider>
      <Panel />
    </ConfigProvider>
  );
}
