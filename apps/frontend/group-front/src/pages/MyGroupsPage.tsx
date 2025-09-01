import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Avatar,
  Stack,
  Divider,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Group as GroupIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { groupApi } from '../services/groupApi';
import { authService } from '../services/authService';
import { Group } from '../types';

const MyGroupsPage = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  
  // Create group dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  
  // Edit group dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  
  // Delete confirmation dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteGroup, setDeleteGroup] = useState<Group | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuGroup, setMenuGroup] = useState<Group | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsData, currentUser] = await Promise.all([
        groupApi.listMyGroups(),
        authService.getCurrentUser()
      ]);
      setGroups(groupsData);
      if (currentUser) {
        setCurrentUserEmail(currentUser.email);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateGroup = async () => {
    if (!createName.trim()) return;
    
    setCreateLoading(true);
    try {
      await groupApi.createGroup(createName.trim());
      setCreateOpen(false);
      setCreateName('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditGroup = async () => {
    if (!editGroup?._id || !editName.trim()) return;
    
    setEditLoading(true);
    try {
      await groupApi.updateGroup(editGroup._id, { name: editName.trim() });
      setEditOpen(false);
      setEditGroup(null);
      setEditName('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update group');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroup?._id) return;
    
    setDeleteLoading(true);
    try {
      await groupApi.deleteGroup(deleteGroup._id);
      setDeleteOpen(false);
      setDeleteGroup(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openMenu = (event: React.MouseEvent<HTMLElement>, group: Group) => {
    setAnchorEl(event.currentTarget);
    setMenuGroup(group);
  };

  const closeMenu = () => {
    setAnchorEl(null);
    setMenuGroup(null);
  };

  const openEdit = (group: Group) => {
    setEditGroup(group);
    setEditName(group.name);
    setEditOpen(true);
    closeMenu();
  };

  const openDelete = (group: Group) => {
    setDeleteGroup(group);
    setDeleteOpen(true);
    closeMenu();
  };

  const getUserRole = (group: Group): string => {
    if (!currentUserEmail) return 'member';
    
    const member = group.members?.find(m => m.email.toLowerCase() === currentUserEmail.toLowerCase());
    return member?.role || 'member';
  };

  const canModifyGroup = (group: Group): boolean => {
    const role = getUserRole(group);
    return role === 'owner' || role === 'admin';
  };

  const canDeleteGroup = (group: Group): boolean => {
    return getUserRole(group) === 'owner';
  };

  if (loading && groups.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Loading your groups...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              My Groups
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your groups and collaborate with your team
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            size="large"
          >
            Create Group
          </Button>
        </Stack>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <GroupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No groups yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first group to get started collaborating
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Create Your First Group
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 3
          }}
        >
          {groups.map((group) => (
            <Card 
              key={group._id}
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: (theme) => theme.shadows[8]
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Header with menu */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                    <GroupIcon />
                  </Avatar>
                  {canModifyGroup(group) && (
                    <IconButton
                      size="small"
                      onClick={(e) => openMenu(e, group)}
                      sx={{ ml: 1 }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </Stack>

                {/* Group info */}
                <Typography variant="h6" component="h2" gutterBottom noWrap>
                  {group.name}
                </Typography>
                
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {group.members?.length || 1} member{(group.members?.length || 1) !== 1 ? 's' : ''}
                  </Typography>
                  <Chip 
                    label={getUserRole(group)} 
                    size="small" 
                    color={getUserRole(group) === 'owner' ? 'primary' : 'default'}
                  />
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Actions */}
                <Stack direction="row" spacing={1}>
                  <Button
                    component={RouterLink}
                    to={`/groups/${group._id}`}
                    variant="contained"
                    fullWidth
                  >
                    Open
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => menuGroup && openEdit(menuGroup)}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit Name
        </MenuItem>
        {menuGroup && canDeleteGroup(menuGroup) && (
          <MenuItem onClick={() => menuGroup && openDelete(menuGroup)} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
            Delete Group
          </MenuItem>
        )}
      </Menu>

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Group Name"
            fullWidth
            variant="outlined"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Enter a name for your group"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateGroup} 
            variant="contained"
            disabled={!createName.trim() || createLoading}
          >
            {createLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Group Name"
            fullWidth
            variant="outlined"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mt: 2 }}
            onKeyPress={(e) => e.key === 'Enter' && handleEditGroup()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleEditGroup} 
            variant="contained"
            disabled={!editName.trim() || editLoading}
          >
            {editLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="sm">
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteGroup?.name}"? The group will be archived and can be restored by contacting support if needed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteGroup} 
            variant="contained"
            color="error"
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyGroupsPage;
