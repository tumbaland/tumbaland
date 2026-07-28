import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { Group, GroupMember } from '../../types';

interface GroupMembersListProps {
  group: Group;
  currentUserRole?: string;
  currentUserEmail?: string;
  onAddMember: () => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, member: GroupMember) => void;
}

const pad = (n: number): string => String(n).padStart(2, '0');

const splitDateTime = (value?: string): { date: string; time: string } | null => {
  if (!value) return null;

  const d = new Date(value);
  return {
    date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear() % 100)}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  };
};

const DateTimeCell: React.FC<{ value?: string }> = ({ value }) => {
  const parts = splitDateTime(value);
  if (!parts) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        -
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="body2">{parts.date}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {parts.time}
      </Typography>
    </Box>
  );
};

const GroupMembersList: React.FC<GroupMembersListProps> = ({
  group,
  currentUserRole,
  currentUserEmail,
  onAddMember,
  onMenuOpen
}) => {
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  const canEditMember = (member: GroupMember) => {
    if (!canManageMembers) return false;
    if (member.email === currentUserEmail) return false; // Can't edit self via this menu
    if (member.role === 'owner') return false; // Can't edit owner
    if (currentUserRole === 'admin' && member.role === 'admin') return false; // Admin can't edit other admin
    return true;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Members
        </Typography>
        {canManageMembers && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddMember}
            sx={{ borderRadius: 2 }}
          >
            Add Member
          </Button>
        )}
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Joined Date</TableCell>
              <TableCell>Last Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {group.members?.map((member) => (
              <TableRow key={member.email} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {member.email[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {member.email.split('@')[0]}
                      </Typography>
                      <Typography variant="body2" sx={{
                        color: "text.secondary"
                      }}>
                        {member.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={member.role}
                    size="small"
                    color={
                      member.role === 'owner'
                        ? 'error'
                        : member.role === 'admin'
                        ? 'warning'
                        : 'default'
                    }
                    sx={{ textTransform: 'capitalize', fontWeight: 500 }}
                  />
                </TableCell>
                <TableCell>
                  <DateTimeCell value={member.joinedAt} />
                </TableCell>
                <TableCell>
                  <DateTimeCell value={member.lastActivity} />
                </TableCell>
                <TableCell align="right">
                  {canEditMember(member) && (
                    <IconButton
                      size="small"
                      onClick={(e) => onMenuOpen(e, member)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!group.members || group.members.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                  <Typography sx={{
                    color: "text.secondary"
                  }}>
                    No members found in this group
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default GroupMembersList;
