import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import GroupsIcon from '@mui/icons-material/Groups';
import { TOUCH_TARGET, brand, ink, surface } from '@tumbaland/frontend-core';
import { appPath } from '../appBase';
import { chatApi } from '../services/chatApi';
import { dayLabel } from '../components/thread/DaySeparator';
import { PresenceDot } from '../components/thread/PresenceDot';
import { isDocumentType } from '../services/documents';
import { useChatStream } from '../hooks/useChatStream';
import { namesTyping, useTypingTracker } from '../hooks/useTypingTracker';
import type { ChatEvent, Conversation, Message, Presence, TypingPayload } from '../types';

/** The label for a conversation with no title: whoever else is in it. */
function conversationName(conversation: Conversation, currentUserId: string): string {
  if (conversation.title) return conversation.title;

  const others = conversation.members.filter((member) => member.userId !== currentUserId);
  if (others.length === 0) return 'Just you';
  return others.map((member) => member.name || member.email).join(', ');
}

/** Two people is a direct conversation; three or more is a group chat. */
function isGroup(conversation: Conversation, currentUserId: string): boolean {
  return conversation.members.filter((member) => member.userId !== currentUserId).length > 1;
}

/** The list's one-line summary of a message, matching what the server stores. */
function previewOf(message: Message): string {
  // As the server words it, so the line does not change on the next reload.
  if (message.collage) return `Collage: ${message.collage.title}`;
  if (message.body.trim()) return message.body.trim();
  if (message.attachments.length === 0) return '';
  const [only] = message.attachments;
  if (only && message.attachments.length === 1) {
    return isDocumentType(only.mimetype) ? 'Document' : only.mimetype.startsWith('video/') ? 'Video' : 'Photo';
  }
  return `${message.attachments.length} attachments`;
}

/** Whether the other person in a direct message is online right now. */
function otherOnline(conversation: Conversation, currentUserId: string): boolean {
  return (conversation.presence ?? []).some((entry) => entry.userId !== currentUserId && entry.online);
}

/** The other person's picture in a direct message. */
function otherPicture(conversation: Conversation, currentUserId: string): string | undefined {
  return conversation.members.find((member) => member.userId !== currentUserId)?.picture || undefined;
}

export interface ConversationsPageProps {
  currentUserId: string;
  /** Opens a conversation in place, for the side panel. Without it a row navigates. */
  onOpen?: (conversationId: string) => void;
}

export default function ConversationsPage({ currentUserId, onOpen }: ConversationsPageProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { typing, note: noteTyping, clear: clearTyping } = useTypingTracker();

  // Ensures before listing: a group made in Groups has no conversation until
  // something creates one, so listing alone shows an empty screen with no way
  // forward. Idempotent, so this is safe on every open, and on every resync.
  //
  // The list is always shown, even with a single conversation: it is what
  // the header's Chat button promises, and the way back out of a thread.
  const loaded = useRef(false);
  const load = useCallback(async () => {
    try {
      setConversations(await chatApi.ensureMyConversations());
      loaded.current = true;
      setError(null);
    } catch (cause) {
      // A failed background refresh keeps the list it already has; only a
      // first load with nothing to show becomes an error screen.
      if (!loaded.current) setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Keeps the list live: new messages, who is typing, who is online. */
  const onEvent = useCallback(
    (event: ChatEvent) => {
      switch (event.type) {
        case 'message.created': {
          const message = event.payload as Message;
          clearTyping(event.conversationId, message.senderId);
          // A note like "Irja set photos to go to Rome" is neither a preview nor unread.
          if (message.kind === 'system') break;
          setConversations((previous) =>
            previous
              .map((conversation) =>
                conversation.id === event.conversationId
                  ? {
                      ...conversation,
                      lastMessageAt: message.createdAt,
                      lastMessagePreview: previewOf(message),
                      lastMessageSender: message.senderName,
                      unreadCount: conversation.unreadCount + (message.senderId === currentUserId ? 0 : 1)
                    }
                  : conversation
              )
              // Newest activity first, as the server orders it.
              .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
          );
          break;
        }
        case 'message.updated':
        case 'message.deleted':
          // An edit or unsend may change the preview, which only the server
          // can work out; one refetch is cheaper than mirroring its rules.
          void load();
          break;
        case 'typing': {
          const payload = event.payload as TypingPayload;
          if (payload.userId !== currentUserId) noteTyping(event.conversationId, payload.userId, payload.name);
          break;
        }
        case 'presence': {
          const payload = event.payload as Presence;
          setConversations((previous) =>
            previous.map((conversation) =>
              conversation.members.some((member) => member.userId === payload.userId)
                ? {
                    ...conversation,
                    presence: [
                      ...(conversation.presence ?? []).filter((entry) => entry.userId !== payload.userId),
                      payload
                    ]
                  }
                : conversation
            )
          );
          break;
        }
        default:
          break;
      }
    },
    [currentUserId, load, noteTyping, clearTyping]
  );

  useChatStream({ onEvent, onResync: load });

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  if (conversations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
        <Typography variant="h6" gutterBottom>
          Nobody to talk to yet
        </Typography>
        <Typography variant="body2" sx={{ color: ink.muted, mb: 3 }}>
          Chat happens inside a group. Make one, add the person you want to talk to, and the
          conversation appears here on its own.
        </Typography>
        {/* A link rather than a sentence telling someone to go and find it. */}
        <Button component={Link} to="/groups" variant="contained">
          Set up a group
        </Button>
      </Box>
    );
  }

  return (
    <List sx={{ py: 0 }}>
      {conversations.map((conversation) => {
        const name = conversationName(conversation, currentUserId);
        const group = isGroup(conversation, currentUserId);
        const typers = namesTyping(typing, conversation.id);
        return (
          <ListItemButton
            key={conversation.id}
            onClick={() => (onOpen ? onOpen(conversation.id) : navigate(appPath(`/${conversation.id}`)))}
            sx={{
              minHeight: TOUCH_TARGET + 16,
              gap: 1.5,
              borderBottom: `1px solid ${surface.sunken}`
            }}
          >
            <PresenceDot online={!group && otherOnline(conversation, currentUserId)} size={40}>
              <Avatar
                src={group ? undefined : otherPicture(conversation, currentUserId)}
                alt=""
                sx={{ bgcolor: group ? brand.purple : brand.pinkInk }}
                aria-hidden
              >
                {group ? <GroupsIcon /> : name.charAt(0).toUpperCase()}
              </Avatar>
            </PresenceDot>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{ fontWeight: conversation.unreadCount > 0 ? 700 : 500 }}
              >
                {name}
              </Typography>
              <Typography variant="caption" sx={{ color: ink.muted, display: 'block' }}>
                {group ? `Group chat · ${conversation.members.length} people` : 'Direct message'}
              </Typography>
              {typers.length > 0 ? (
                <Typography variant="body2" noWrap sx={{ color: brand.pinkInk, fontStyle: 'italic' }}>
                  {group ? `${typers[0]} is typing…` : 'typing…'}
                </Typography>
              ) : (
                <Typography variant="body2" noWrap sx={{ color: ink.muted }}>
                  {conversation.lastMessagePreview || 'No messages yet'}
                </Typography>
              )}
            </Box>

            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              {conversation.lastMessageAt && (
                <Typography variant="caption" sx={{ color: ink.muted, display: 'block' }}>
                  {dayLabel(conversation.lastMessageAt)}
                </Typography>
              )}
              {conversation.unreadCount > 0 && (
                <Badge
                  badgeContent={conversation.unreadCount}
                  color="primary"
                  sx={{ mt: 1, mr: 1 }}
                  aria-label={`${conversation.unreadCount} unread`}
                />
              )}
            </Box>
          </ListItemButton>
        );
      })}
    </List>
  );
}
