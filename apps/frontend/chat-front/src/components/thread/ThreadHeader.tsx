import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import type { ReactNode } from 'react';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import type { ConversationMember, Presence } from '../../types';
import { MemberAvatar } from './MemberAvatar';
import { activeLabel } from './clock';

export interface ThreadHeaderProps {
  /** Everyone in the conversation, the caller included. */
  members: ConversationMember[];
  currentUserId: string;
  title: string;
  presence: Record<string, Presence>;
  typingNames: string[];
  /** Given where there is a list to go back to without leaving the page (the side panel). */
  onBack?: () => void;
  /** The conversation's settings, behind a ⋮ button: where photos go and the theme. */
  menu?: Array<{ label: string; secondary?: string; icon?: ReactNode; onClick: () => void }>;
  /** The bar's colour and its "typing…" colour, from the conversation's theme. */
  background?: string;
  accent?: string;
  /** When the chat last saw each person read or write, for when presence has no record of them. */
  lastSeen?: Record<string, string>;
  /** Given for a two-person conversation: calls the other person. */
  onCall?: () => void;
}

/** "Active 5 min ago" has to keep counting while the thread stays open. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** What the line under the name says: typing wins, then whether they are around. */
export function statusLine(
  others: ConversationMember[],
  presence: Record<string, Presence>,
  typingNames: string[],
  now: Date,
  lastSeen: Record<string, string> = {}
): string | null {
  if (typingNames.length > 0) {
    return others.length > 1 ? `${typingNames[0]} is typing…` : 'typing…';
  }

  /**
   * The latest sign of this person: presence when it has one, or the last
   * time the chat saw them read or write, whichever is newer. Presence has
   * nothing for someone who has not opened the app since it started being
   * recorded, and a blank header then said less than the thread itself knew.
   */
  const latest = (userId: string): string | null => {
    const times = [presence[userId]?.lastActiveAt, lastSeen[userId]].filter((time): time is string => Boolean(time));
    return times.length > 0 ? times.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null;
  };

  if (others.length === 1) {
    const userId = others[0]!.userId;
    return activeLabel(Boolean(presence[userId]?.online), latest(userId), now);
  }

  const online = others.filter((member) => presence[member.userId]?.online).length;
  if (online > 0) return `${online} online`;
  // Nobody here now: when the most recent of them was.
  const mostRecent = others
    .map((member) => latest(member.userId))
    .filter((time): time is string => Boolean(time))
    .sort()
    .pop();
  return mostRecent ? activeLabel(false, mostRecent, now) : null;
}

/** Who this conversation is with, whether they are around, and whether they are typing. */
export function ThreadHeader({
  members,
  currentUserId,
  title,
  presence,
  typingNames,
  onBack,
  menu = [],
  background = surface.paper,
  accent = brand.pinkInk,
  lastSeen,
  onCall
}: ThreadHeaderProps) {
  const now = useMinuteClock();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const others = members.filter((member) => member.userId !== currentUserId);
  const name = title || others.map((member) => member.name || member.email).join(', ');

  // Nothing to say until the members have loaded; an empty bar would just
  // push the thread down and back up.
  if (!name && !onBack) return null;

  const status = statusLine(others, presence, typingNames, now, lastSeen);
  const typing = typingNames.length > 0;
  const lead = others[0];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: onBack ? 0.5 : 1.5,
        py: 0.75,
        borderBottom: '1px solid rgba(15,23,42,0.08)',
        background,
        transition: 'background-color .2s ease',
        minHeight: 52
      }}
    >
      {onBack && (
        <IconButton size="small" aria-label="Back to conversations" onClick={onBack}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      )}
      {lead && (
        <MemberAvatar
          name={lead.name || lead.email}
          picture={others.length === 1 ? lead.picture : null}
          size={34}
          online={others.some((member) => presence[member.userId]?.online)}
        />
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" noWrap sx={{ color: ink.strong, lineHeight: 1.3 }}>
          {name || 'Chat'}
        </Typography>
        {status && (
          <Typography
            variant="caption"
            noWrap
            component="p"
            aria-live="polite"
            // The body grey rather than the muted one: it stays readable on
            // every theme's tinted bar, where the lighter grey falls short.
            sx={{ color: typing ? accent : ink.body, lineHeight: 1.3, fontStyle: typing ? 'italic' : 'normal' }}
          >
            {status}
          </Typography>
        )}
      </Box>

      {onCall && (
        <IconButton size="small" aria-label={`Call ${name || ''}`.trim()} onClick={onCall}>
          <CallOutlinedIcon fontSize="small" />
        </IconButton>
      )}

      {menu.length > 0 && (
        <>
          <IconButton
            size="small"
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={Boolean(menuAnchor)}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {menu.map((item) => (
              <MenuItem
                key={item.label}
                onClick={() => {
                  setMenuAnchor(null);
                  item.onClick();
                }}
              >
                {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                <ListItemText primary={item.label} secondary={item.secondary} />
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
}
