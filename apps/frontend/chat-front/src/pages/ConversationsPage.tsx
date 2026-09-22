import { useEffect, useState } from 'react';
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
import type { Conversation } from '../types';

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

  useEffect(() => {
    let active = true;

    // Ensures before listing: a group made in Groups has no conversation until
    // something creates one, so listing alone shows an empty screen with no way
    // forward. Idempotent, so this is safe on every open.
    //
    // The list is always shown, even with a single conversation: it is what
    // the header's Chat button promises, and the way back out of a thread.
    chatApi
      .ensureMyConversations()
      .then((list) => active && setConversations(list))
      .catch((cause: Error) => active && setError(cause.message))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

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
            <Avatar
              src={group ? undefined : otherPicture(conversation, currentUserId)}
              alt=""
              sx={{ bgcolor: group ? brand.purple : brand.pinkInk }}
              aria-hidden
            >
              {group ? <GroupsIcon /> : name.charAt(0).toUpperCase()}
            </Avatar>

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
              <Typography variant="body2" noWrap sx={{ color: ink.muted }}>
                {conversation.lastMessagePreview || 'No messages yet'}
              </Typography>
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
