import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  Card,
  CardContent,
  Stack,
  Divider,
  Alert,
  Avatar,
  Menu,
  Paper,
  Fade
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  WorkspacePremium as WorkspacePremiumIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Email as EmailIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { groupApi } from '../services/groupApi';
import { authService } from '../services/authService';
import { Group, GroupMember } from '../types';

const formatLastActivity = (lastActivity?: string): string => {
  if (!lastActivity) return 'Never';
  
  const now = new Date();
  const activityDate = new Date(lastActivity);
  const diffMs = now.getTime() - activityDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  
  return activityDate.toLocaleDateString();
};

const GroupDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  
  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  
  // Edit group dialog
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupLoading, setEditGroupLoading] = useState(false);
  
  // Member menu
  const [memberMenuAnchorEl, setMemberMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [groupData, currentUser] = await Promise.all([
        groupApi.getGroup(id),
        authService.getCurrentUser()
      ]);
      setGroup(groupData);
      setCurrentUserEmail(currentUser?.email?.toLowerCase() || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (id) load(); 
  }, [id]);

  const handleAddMember = async () => {
    if (!id || !memberEmail.trim()) return;
    
    setAddMemberLoading(true);
    try {
      const updatedGroup = await groupApi.addMember(id, memberEmail.trim(), memberRole);
      setGroup(updatedGroup);
      setAddMemberOpen(false);
      setMemberEmail('');
      setMemberRole('member');
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleEditGroup = async () => {
    if (!id || !editGroupName.trim()) return;
    
    setEditGroupLoading(true);
    try {
      const updatedGroup = await groupApi.updateGroup(id, { name: editGroupName.trim() });
      setGroup(updatedGroup);
      setEditGroupOpen(false);
      setEditGroupName('');
    } catch (err: any) {
      setError(err.message || 'Failed to update group name');
    } finally {
      setEditGroupLoading(false);
    }
  };

  const openEditGroup = () => {
    if (group) {
      setEditGroupName(group.name);
      setEditGroupOpen(true);
    }
  };

  const handleRemoveMember = async (member: GroupMember) => {
    if (!id) return;
    
    try {
      const updatedGroup = await groupApi.removeMember(id, member.email);
      setGroup(updatedGroup);
      closeMemberMenu();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (member: GroupMember, newRole: 'owner' | 'admin' | 'member') => {
    if (!id) return;
    
    try {
      const updatedGroup = await groupApi.updateMemberRole(id, member.email, newRole);
      setGroup(updatedGroup);
      closeMemberMenu();
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    }
  };

  const openMemberMenu = (event: React.MouseEvent<HTMLElement>, member: GroupMember) => {
    setMemberMenuAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const closeMemberMenu = () => {
    setMemberMenuAnchorEl(null);
    setSelectedMember(null);
  };

  const getUserRole = (): string => {
    if (!currentUserEmail || !group) return 'member';
    
    const member = group.members?.find(m => m.email.toLowerCase() === currentUserEmail);
    return member?.role || 'member';
  };

  const canManageMembers = (): boolean => {
    const role = getUserRole();
    return role === 'owner' || role === 'admin';
  };

  const canRemoveMember = (member: GroupMember): boolean => {
    const currentUserRole = getUserRole();
    
    // Can't remove yourself if you're the owner
    if (member.email.toLowerCase() === currentUserEmail && member.role === 'owner') {
      return false;
    }
    
    // Owners can remove anyone except other owners
    if (currentUserRole === 'owner') {
      return member.role !== 'owner' || member.email.toLowerCase() === currentUserEmail;
    }
    
    // Admins can only remove members
    if (currentUserRole === 'admin') {
      return member.role === 'member';
    }
    
    // Members can only remove themselves
    return member.email.toLowerCase() === currentUserEmail;
  };

  if (loading) return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6" color="text.secondary">
        Loading group...
      </Typography>
    </Box>
  );

  if (!group) return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6" color="error">
        Group not found
      </Typography>
      <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
        Back to Groups
      </Button>
    </Box>
  );

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
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 0 }}>
            <IconButton onClick={() => navigate('/groups')} size="large" sx={{ color: 'white' }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                  <GroupIcon sx={{ fontSize: 24 }} />
                </Avatar>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
                      {group.name}
                    </Typography>
                    {canManageMembers() && (
                      <IconButton
                        size="small"
                        onClick={openEditGroup}
                        sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                      >
                        <EditIcon />
                      </IconButton>
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    {group.members?.length || 0} members • Created {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'recently'}
                  </Typography>
                </Box>
              </Stack>
            </Box>
            {canManageMembers() && (
              <Button
                variant="contained"
                size="medium"
                startIcon={<PersonAddIcon />}
                onClick={() => setAddMemberOpen(true)}
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
                Add Member
              </Button>
            )}
          </Stack>
        </Box>
      </Paper>

      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, pb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Section */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 3,
            mb: 4
          }}
        >
          <Paper
            sx={{
              p: 3,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
              color: 'white',
              borderRadius: 2
            }}
          >
            <PersonIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {group.members?.length || 0}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Total Members
            </Typography>
          </Paper>
          <Paper
            sx={{
              p: 3,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              borderRadius: 2
            }}
          >
            <AdminPanelSettingsIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {group.members?.filter(m => m.role === 'admin' || m.role === 'owner').length || 0}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Admins
            </Typography>
          </Paper>
          <Paper
            sx={{
              p: 3,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              borderRadius: 2
            }}
          >
            <WorkspacePremiumIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {group.members?.filter(m => m.role === 'owner').length || 0}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Owners
            </Typography>
          </Paper>
        </Box>

        {/* Members Section */}
        <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600, color: 'text.primary' }}>
          Team Members
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 3
          }}
        >
          {(group.members || []).map((member, index) => (
            <Fade in timeout={500 + index * 100} key={member.email}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: (theme) => theme.shadows[8]
                  },
                  position: 'relative'
                }}
              >
                {/* Role-based gradient header */}
                <Box
                  sx={{
                    height: 60,
                    background: member.role === 'owner'
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : member.role === 'admin'
                      ? 'linear-gradient(135deg, #764ba2 0%, #4facfe 100%)'
                      : 'linear-gradient(135deg, #4facfe 0%, #667eea 100%)',
                    position: 'relative'
                  }}
                >
                  {canRemoveMember(member) && (
                    <IconButton
                      size="small"
                      onClick={(e) => openMemberMenu(e, member)}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.3)'
                        }
                      }}
                    >
                      <MoreVertIcon sx={{ color: 'white', fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>

                <CardContent sx={{ flexGrow: 1, pt: 2, textAlign: 'center' }}>
                  {/* Avatar positioned over gradient */}
                  <Box sx={{ position: 'relative', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: member.role === 'owner' ? 'error.main' : member.role === 'admin' ? 'warning.main' : 'primary.main',
                        width: 64,
                        height: 64,
                        border: '4px solid white',
                        position: 'absolute',
                        top: -32,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        boxShadow: 2
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Box>

                  {/* Member info */}
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                      {member.email.split('@')[0]}
                    </Typography>

                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 2 }}>
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {member.email}
                      </Typography>
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                      {member.role}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'recently'}
                    </Typography>
                    
                    <Divider sx={{ my: 1.5 }} />
                    
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                      <AccessTimeIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        Active {formatLastActivity(member.lastActivity)}
                      </Typography>
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          ))}
        </Box>

        {/* Member Menu */}
        <Menu
          anchorEl={memberMenuAnchorEl}
          open={Boolean(memberMenuAnchorEl)}
          onClose={closeMemberMenu}
        >
          {selectedMember && getUserRole() === 'owner' && selectedMember.role !== 'owner' && (
            [
              <MenuItem key="make-admin" onClick={() => selectedMember && handleUpdateRole(selectedMember, 'admin')}>
                Make Admin
              </MenuItem>,
              <MenuItem key="make-member" onClick={() => selectedMember && handleUpdateRole(selectedMember, 'member')}>
                Make Member
              </MenuItem>,
              <Divider key="divider" />
            ]
          )}
          <MenuItem 
            onClick={() => selectedMember && handleRemoveMember(selectedMember)}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
            Remove from Group
          </MenuItem>
        </Menu>

        {/* Add Member Dialog */}
        <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Member</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              label="Email Address"
              fullWidth
              variant="outlined"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              sx={{ mt: 2, mb: 2 }}
              placeholder="Enter member's email address"
              type="email"
            />
            
            <Select
              fullWidth
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as any)}
              displayEmpty
            >
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              {getUserRole() === 'owner' && (
                <MenuItem value="owner">Owner</MenuItem>
              )}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddMember}
              variant="contained"
              disabled={!memberEmail.trim() || addMemberLoading}
            >
              {addMemberLoading ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Group Dialog */}
        <Dialog open={editGroupOpen} onClose={() => setEditGroupOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Group Name</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              label="Group Name"
              fullWidth
              variant="outlined"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              sx={{ mt: 2 }}
              placeholder="Enter new group name"
              onKeyPress={(e) => e.key === 'Enter' && handleEditGroup()}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditGroupOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleEditGroup}
              variant="contained"
              disabled={!editGroupName.trim() || editGroupLoading}
            >
              {editGroupLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default GroupDetailsPage;
