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
  Alert,
  Paper,
  Fade
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Group as GroupIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  WorkspacePremium as WorkspacePremiumIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { groupApi } from '../../services/groupApi';
import { authService } from '../../services/authService';
import { Group } from '../../types';

const GroupsTab = () => {
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
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Hero Header */}
      <Paper
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 2,
          px: 3,
          mb: 2,
          borderRadius: 0
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', textAlign: 'center' }}>
          <GroupsIcon sx={{ fontSize: 40, mb: 0.5, opacity: 0.9 }} />
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            My Groups
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.9, maxWidth: 600, mx: 'auto' }}>
            Collaborate, organize, and manage your teams with powerful group tools
          </Typography>
          <Button
            variant="contained"
            size="medium"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)',
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Create New Group
          </Button>
        </Box>
      </Paper>

      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pb: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Section */}
        {groups.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
              mb: 2
            }}
          >
            <Paper
              sx={{
                p: 2,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                color: 'white',
                borderRadius: 2
              }}
            >
              <GroupIcon sx={{ fontSize: 32, mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {groups.length}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Total Groups
              </Typography>
            </Paper>
            <Paper
              sx={{
                p: 2,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                borderRadius: 2
              }}
            >
              <PersonIcon sx={{ fontSize: 32, mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {groups.reduce((acc, group) => acc + (group.members?.length || 1), 0)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Team Members
              </Typography>
            </Paper>
            <Paper
              sx={{
                p: 2,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                borderRadius: 2
              }}
            >
              <WorkspacePremiumIcon sx={{ fontSize: 32, mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {groups.filter(g => getUserRole(g) === 'owner').length}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Owned Groups
              </Typography>
            </Paper>
          </Box>
        )}

        {/* Groups Section */}
        {groups.length === 0 ? (
          <Fade in timeout={1000}>
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                borderRadius: 3,
                border: '2px dashed',
                borderColor: 'divider'
              }}
            >
              <GroupIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 3, opacity: 0.7 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                No Groups Yet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
                Start building your collaborative workspace by creating your first group.
                Invite team members and manage projects together.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Create Your First Group
              </Button>
            </Paper>
          </Fade>
        ) : (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
              Your Groups
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                gap: 2
              }}
            >
              {groups.map((group, index) => (
                <Fade in timeout={500 + index * 100} key={group._id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 3,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: (theme) => theme.shadows[8],
                        '& .group-avatar': {
                          transform: 'scale(1.05)'
                        }
                      },
                      position: 'relative'
                    }}
                    component={RouterLink}
                    to={`/groups/${group._id}`}
                  >
                    {/* Gradient Header */}
                    <Box
                      sx={{
                        height: 60,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        position: 'relative'
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          zIndex: 1
                        }}
                      >
                        {canModifyGroup(group) && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.preventDefault();
                              openMenu(e, group);
                            }}
                            sx={{
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              backdropFilter: 'blur(10px)',
                              '&:hover': {
                                backgroundColor: 'rgba(255,255,255,0.3)'
                              }
                            }}
                          >
                            <MoreVertIcon sx={{ color: 'white' }} />
                          </IconButton>
                        )}
                      </Box>
                    </Box>

                    <CardContent sx={{ flexGrow: 1, pt: 1 }}>
                      {/* Avatar positioned over gradient */}
                      <Box sx={{ position: 'relative', mb: 1 }}>
                        <Avatar
                          className="group-avatar"
                          sx={{
                            bgcolor: 'primary.main',
                            width: 48,
                            height: 48,
                            border: '3px solid white',
                            position: 'absolute',
                            top: -30,
                            left: 16,
                            transition: 'transform 0.3s ease',
                            boxShadow: 2
                          }}
                        >
                          <GroupIcon sx={{ fontSize: 24 }} />
                        </Avatar>
                      </Box>

                      {/* Group info */}
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                          {group.name}
                        </Typography>

                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <PersonIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {group.members?.length || 1} member{(group.members?.length || 1) !== 1 ? 's' : ''}
                          </Typography>
                          <Chip
                            label={getUserRole(group)}
                            size="small"
                            color={getUserRole(group) === 'owner' ? 'primary' : 'default'}
                            sx={{ ml: 'auto' }}
                          />
                        </Stack>

                        <Divider sx={{ my: 1 }} />

                        {/* Quick Actions */}
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            fullWidth
                            sx={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                              }
                            }}
                          >
                            Open Group
                          </Button>
                        </Stack>
                      </Box>
                    </CardContent>
                  </Card>
                </Fade>
              ))}
            </Box>
          </>
        )}
      </Box>

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
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AddIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Create New Group
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Give your group a descriptive name to help team members understand its purpose.
          </Typography>
          <TextField
            autoFocus
            label="Group Name"
            fullWidth
            variant="outlined"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="e.g., Marketing Team, Product Development"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateGroup}
            variant="contained"
            disabled={!createName.trim() || createLoading}
            sx={{
              borderRadius: 2,
              px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
              }
            }}
          >
            {createLoading ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Edit Group
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Group Name"
            fullWidth
            variant="outlined"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleEditGroup()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleEditGroup}
            variant="contained"
            disabled={!editName.trim() || editLoading}
            sx={{
              borderRadius: 2,
              px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
              }
            }}
          >
            {editLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        maxWidth="sm"
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DeleteIcon color="error" />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
              Delete Group
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to delete <strong>"{deleteGroup?.name}"</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. The group will be permanently deleted.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteGroup}
            variant="contained"
            color="error"
            disabled={deleteLoading}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {deleteLoading ? 'Deleting...' : 'Delete Group'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupsTab;
