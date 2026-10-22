import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
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
  /**
   * Starts a voice message; the recording itself shows in the composer.
   * Absent where the browser cannot record.
   */
  onRecordVoice?: () => void;
  /** True while one cannot start: one is being recorded or sent, or an edit has the box. */
  recordingVoice?: boolean;
  /** Opens the location picker and live sharing controls. */
  onLocation?: () => void;
  sharingLocation?: boolean;
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
  onCall,
  onRecordVoice,
  recordingVoice = false,
  onLocation,
  sharingLocation = false
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
  const briefStatus = status?.startsWith('Last active ')
    ? status.slice('Last active '.length).replace(/^on /, '').replace(' at ', ', ')
    : status;
  const statusText =
    status?.startsWith('Last active ') && briefStatus
      ? briefStatus.charAt(0).toUpperCase() + briefStatus.slice(1)
      : status;

  return (
    <Box
      sx={{
        containerType: 'inline-size',
        flexShrink: 0,
        px: onBack ? 0.5 : 1.5,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        background,
        transition: 'background-color .2s ease',
        minHeight: 52
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75
        }}
      >
        {onBack && (
          <IconButton size="small" aria-label="Back to conversations" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        {lead && (
          <Box sx={{ flexShrink: 0, '@container (max-width: 340px)': { display: 'none' } }}>
            <MemberAvatar
              name={lead.name || lead.email}
              picture={others.length === 1 ? lead.picture : null}
              size={34}
              online={others.some((member) => presence[member.userId]?.online)}
            />
          </Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" noWrap title={name || 'Chat'} sx={{ color: ink.strong, lineHeight: 1.3 }}>
            {name || 'Chat'}
          </Typography>
          {status && (
            <Tooltip title={status} describeChild>
              <Typography
                variant="caption"
                component="p"
                noWrap
                aria-live="polite"
                // The body grey rather than the muted one: it stays readable on
                // every theme's tinted bar, where the lighter grey falls short.
                sx={{
                  color: typing ? accent : ink.body,
                  lineHeight: 1.3,
                  fontStyle: typing ? 'italic' : 'normal'
                }}
              >
                {statusText}
              </Typography>
            </Tooltip>
          )}
        </Box>

        <Box
          role="group"
          aria-label="Conversation actions"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
            gap: 0.5,
            '& .MuiIconButton-root': { width: 36, height: 36 },
            '& .MuiSvgIcon-root': { fontSize: 22 },
            '@container (max-width: 340px)': {
              gap: 0.25,
              '& .MuiIconButton-root': { width: 32 },
              '& .MuiSvgIcon-root': { fontSize: 20 }
            }
          }}
        >
          {/* A mic and a phone side by side read alike; the hover text tells the
          recorded message from the live call. */}
          {onRecordVoice && (
            <Tooltip title="Voice message" describeChild>
              {/* A span, because a disabled button fires no hover for the tooltip. */}
              <span>
                <IconButton
                  size="small"
                  aria-label="Record voice message"
                  onClick={onRecordVoice}
                  disabled={recordingVoice}
                >
                  <MicNoneOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {onCall && (
            <Tooltip title={name ? `Call ${name}` : 'Call'} describeChild>
              <IconButton size="small" aria-label={`Call ${name || ''}`.trim()} onClick={onCall}>
                <CallOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {onLocation && (
            <Tooltip title={sharingLocation ? 'Sharing location' : 'Share location'} describeChild>
              <IconButton
                size="small"
                aria-label={sharingLocation ? 'Manage location sharing' : 'Share location'}
                onClick={onLocation}
                sx={sharingLocation ? { color: accent } : undefined}
              >
                <NearMeOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {menu.length > 0 && (
            <>
              <Tooltip title="More options" describeChild>
                <IconButton
                  size="small"
                  aria-label="Conversation options"
                  aria-haspopup="menu"
                  aria-expanded={Boolean(menuAnchor)}
                  onClick={(event) => setMenuAnchor(event.currentTarget)}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
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
      </Box>
    </Box>
  );
}
