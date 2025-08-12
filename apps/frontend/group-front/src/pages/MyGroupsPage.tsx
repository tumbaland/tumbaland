import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import { groupApi } from '../services/groupApi';
import { Group } from '../types';

const MyGroupsPage = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
  const data = await groupApi.listMyGroups();
  setGroups(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createGroup = async () => {
    await groupApi.createGroup(name);
    setOpen(false);
    setName('');
    load();
  };

  if (loading) {
    return <Box sx={{ p: 3 }}>Loading groups...</Box>;
  }

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">My Groups</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)}>Create Group</Button>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
        {groups.map((g) => (
          <Card key={g._id}>
            <CardContent>
              <Typography variant="h6">{g.name}</Typography>
              <Typography variant="body2" color="text.secondary">Members: {g.members?.length ?? 1}</Typography>
              <Box sx={{ mt: 1 }}>
                <Button size="small" component={RouterLink} to={`/groups/${g._id}`} variant="outlined">Open</Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Create Group</DialogTitle>
        <DialogContent>
          <TextField label="Name" fullWidth value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={createGroup} variant="contained" disabled={!name}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyGroupsPage;
