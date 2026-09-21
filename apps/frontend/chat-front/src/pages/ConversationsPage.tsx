import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
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

export interface ConversationsPageProps {
  currentUserId: string;
}

export default function ConversationsPage({ currentUserId }: ConversationsPageProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    chatApi
      .listConversations()
      .then((list) => {
        if (!active) return;
        setConversations(list);

        // With one conversation the list is a screen that exists only to be
        // tapped through, so it is skipped. That is the normal case for two
        // people, which is what this is for.
        if (list.length === 1) {
          navigate(appPath(`/${list[0]!.id}`), { replace: true });
        }
      })
      .catch((cause: Error) => active && setError(cause.message))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [navigate]);

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
          No conversations yet
        </Typography>
        <Typography variant="body2" sx={{ color: ink.muted }}>
          Chat happens inside a group. Create one, add the person you want to talk to, and the
          conversation appears here.
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ py: 0 }}>
      {conversations.map((conversation) => {
        const name = conversationName(conversation, currentUserId);
        return (
          <ListItemButton
            key={conversation.id}
            onClick={() => navigate(appPath(`/${conversation.id}`))}
            sx={{
              minHeight: TOUCH_TARGET + 16,
              gap: 1.5,
              borderBottom: `1px solid ${surface.sunken}`
            }}
          >
            <Avatar sx={{ bgcolor: brand.pinkInk }}>{name.charAt(0).toUpperCase()}</Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{ fontWeight: conversation.unreadCount > 0 ? 700 : 500 }}
              >
                {name}
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
