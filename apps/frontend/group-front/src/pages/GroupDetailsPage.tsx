import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
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
  List,
  ListItem,
  ListItemText,
  Avatar,
  Menu
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { groupApi } from '../services/groupApi';
import { authService } from '../services/authService';
import { Group, GroupMember } from '../types';

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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'error';
      case 'admin': return 'warning';
      default: return 'default';
    }
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
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/')} size="large">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h4" component="h1">
              {group.name}
            </Typography>
            {canManageMembers() && (
              <IconButton
                size="small"
                onClick={openEditGroup}
                sx={{ color: 'text.secondary' }}
              >
                <EditIcon />
              </IconButton>
            )}
          </Stack>
          <Typography variant="body1" color="text.secondary">
            {group.members?.length || 0} members
          </Typography>
        </Box>
        {canManageMembers() && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setAddMemberOpen(true)}
          >
            Add Member
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Members List */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Members
          </Typography>
          
          <List>
            {(group.members || []).map((member, index) => (
              <ListItem
                key={member.email}
                divider={index < (group.members?.length || 0) - 1}
                sx={{ px: 0 }}
              >
                <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                  <PersonIcon />
                </Avatar>
                <ListItemText
                  primary={member.email}
                  secondary={member.joinedAt ? `Joined ${new Date(member.joinedAt).toLocaleDateString()}` : 'Joined recently'}
                />
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip
                    label={member.role}
                    color={getRoleColor(member.role) as any}
                    size="small"
                  />
                  {canRemoveMember(member) && (
                    <IconButton
                      size="small"
                      onClick={(e) => openMemberMenu(e, member)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </Stack>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

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
  );
};

export default GroupDetailsPage;
