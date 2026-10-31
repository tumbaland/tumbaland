import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
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
 *
 * **The conversation last open is shown without waiting for the list.** Asking
 * for the list first put a full round trip, and the server's writes and counts
 * behind it, ahead of the thread's own requests, which need only the id. The
 * list is fetched alongside, and settles two things when it arrives: whether
 * there is anywhere to go back to, and whether the remembered conversation
 * still exists.
 */
function Panel() {
  const { user } = useCurrentUser();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(readLastOpen);
  const [attempt, setAttempt] = useState(0);

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
        else {
          // What was remembered is gone, or never was: the list, not an error page.
          writeLastOpen(null);
          setOpenId(null);
        }
      })
      .catch((cause: Error) => active && setError(cause.message));
    return () => {
      active = false;
    };
  }, [attempt]);

  const open = (id: string | null) => {
    setOpenId(id);
    writeLastOpen(id);
  };

  // A list that cannot be loaded costs the way back, not the thread already open.
  if (error && !openId)
    return (
      <Alert
        severity="error"
        action={
          <Button
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        }
      >
        {error}
      </Alert>
    );

  if (openId) {
    return (
      // Keyed so switching conversations starts a clean thread. The thread's own
      // header carries the way back when there is a list to go back to.
      <ThreadPage
        key={openId}
        conversationId={openId}
        onBack={conversations && conversations.length > 1 ? () => open(null) : undefined}
      />
    );
  }

  if (!conversations || !user) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <ConversationsPage currentUserId={user.id} onOpen={open} initial={conversations} />
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
