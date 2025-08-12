import { useEffect, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, TextField, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useParams } from 'react-router-dom';
import { groupApi } from '../services/groupApi';
import { Group, GroupMember } from '../types';

const GroupDetailsPage = () => {
  const { id } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [openInvite, setOpenInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = async () => {
    const data = await groupApi.getGroup(id!);
    setGroup(data);
  };

  useEffect(() => { if (id) load(); }, [id]);

  const invite = async () => {
    const { token } = await groupApi.inviteMember(id!, inviteEmail, inviteRole);
    if (token) {
      const url = `${window.location.origin}/#/accept?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id!)}`;
      setInviteLink(url);
    }
  };

  const copy = async () => { if (inviteLink) await navigator.clipboard.writeText(inviteLink); };

  const roleChip = (m: GroupMember) => <Chip size="small" label={m.role} color={m.role === 'owner' ? 'warning' : m.role === 'admin' ? 'info' : 'default'} sx={{ ml: 1 }} />;

  if (!group) return <Box sx={{ p: 3 }}>Loading...</Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>{group.name}</Typography>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Members</Typography>
      {(group.members || []).map((m) => (
        <Box key={m.email} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography sx={{ minWidth: 320 }}>{m.email}</Typography>
          {roleChip(m)}
        </Box>
      ))}
      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => setOpenInvite(true)}>Invite Member</Button>
      </Box>

      <Dialog open={openInvite} onClose={() => setOpenInvite(false)}>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogContent>
          <TextField label="Email" fullWidth sx={{ mt: 1 }} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} sx={{ mt: 2, width: '100%' }}>
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
          {inviteLink && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
              <TextField fullWidth value={inviteLink} InputProps={{ readOnly: true }} />
              <IconButton onClick={copy}><ContentCopyIcon /></IconButton>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInvite(false)}>Close</Button>
          <Button onClick={invite} variant="contained" disabled={!inviteEmail}>Create Invite</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupDetailsPage;
