import React from 'react';
import { Avatar, Box, Button, Chip, IconButton, Paper, Typography } from '@mui/material';
import { Add as AddIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { Group, GroupMember } from '../../types';
import { initials, tintFor } from '../groups/groupAvatar';

interface GroupMembersListProps {
  group: Group;
  currentUserRole?: string;
  currentUserEmail?: string;
  onAddMember: () => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, member: GroupMember) => void;
}

/** "test.user@example.com" becomes "Test User": the part of an address a person reads as a name. */
export const nameFromEmail = (email: string): string =>
  email
    .split('@')[0]
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ') || email;

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Estonian style, 13.09.2026, in the viewer's own time zone. Built from the
 * parts rather than through toLocaleString('et-EE'), whose separators depend on
 * the locale data a browser happens to ship.
 *
 * A day, not a timestamp: nobody needs the hour someone joined.
 */
export const formatDay = (value?: string): string | null => {
  if (!value) return null;
  const d = new Date(value);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/** 13.09.2026 21:22. Last activity is recent enough that the time matters; the seconds never do. */
export const formatDateTime = (value?: string): string | null => {
  if (!value) return null;
  const d = new Date(value);
  return `${formatDay(value)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ROLE_CHIP: Record<GroupMember['role'], { color: 'primary' | 'default'; variant: 'filled' | 'outlined' }> = {
  owner: { color: 'primary', variant: 'filled' },
  admin: { color: 'primary', variant: 'outlined' },
  member: { color: 'default', variant: 'outlined' }
};

const GroupMembersList: React.FC<GroupMembersListProps> = ({
  group,
  currentUserRole,
  currentUserEmail,
  onAddMember,
  onMenuOpen
}) => {
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const members = group.members ?? [];

  const canEditMember = (member: GroupMember) => {
    if (!canManageMembers) return false;
    if (member.email === currentUserEmail) return false; // Can't edit self via this menu
    if (member.role === 'owner') return false; // Can't edit owner
    if (currentUserRole === 'admin' && member.role === 'admin') return false; // Admin can't edit other admin
    return true;
  };

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Box
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2
        }}
      >
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          Members
        </Typography>
        {canManageMembers && (
          <Button
            variant="contained"
            size="small"
            disableElevation
            startIcon={<AddIcon />}
            onClick={onAddMember}
            sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Add member
          </Button>
        )}
      </Box>

      {members.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 6, px: 2 }}>No members yet</Typography>
      ) : (
        // A list rather than a table: five columns never fit a phone, and a
        // table there scrolled sideways with half of each row out of view.
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {members.map((member) => {
            const name = nameFromEmail(member.email);
            const tint = tintFor(member.email);
            const isYou = member.email === currentUserEmail;
            const joined = formatDay(member.joinedAt);
            const active = formatDateTime(member.lastActivity);
            const activity = [joined && `Joined ${joined}`, active && `Active ${active}`].filter(
              (part): part is string => Boolean(part)
            );
            const chip = ROLE_CHIP[member.role] ?? ROLE_CHIP.member;

            return (
              <Box
                component="li"
                key={member.email}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: { xs: 1.5, sm: 2 },
                  py: 1.5,
                  '&:not(:first-of-type)': { borderTop: '1px solid', borderColor: 'divider' }
                }}
              >
                <Avatar
                  sx={{ width: 40, height: 40, bgcolor: `${tint}1f`, color: tint, fontWeight: 700, fontSize: '0.95rem' }}
                >
                  {initials(name)}
                </Avatar>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600 }}>
                      {name}
                    </Typography>
                    {isYou && <Chip label="You" size="small" sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }} />}
                  </Box>
                  <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
                    {member.email}
                  </Typography>
                  {activity.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {/* Each phrase stays whole, so a narrow screen breaks the
                          line between them rather than inside a date. */}
                      {activity.map((part, index) => (
                        <React.Fragment key={part}>
                          {index > 0 && ' · '}
                          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                            {part}
                          </Box>
                        </React.Fragment>
                      ))}
                    </Typography>
                  )}
                </Box>

                <Chip
                  label={member.role}
                  size="small"
                  color={chip.color}
                  variant={chip.variant}
                  sx={{ flexShrink: 0, height: 22, fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize' }}
                />

                {/* The same slot on every row keeps the role badges lined up
                    whether or not a row has an options menu. */}
                {canManageMembers && (
                  <Box sx={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    {canEditMember(member) && (
                      <IconButton
                        size="small"
                        aria-label={`Options for ${member.email}`}
                        onClick={(e) => onMenuOpen(e, member)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

export default GroupMembersList;
