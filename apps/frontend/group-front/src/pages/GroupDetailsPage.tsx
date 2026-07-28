import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Box, Container, Alert, CircularProgress } from '@mui/material';
import { logger } from '@tumbaland/frontend-core';
import { authService } from '../services/authService';
import { groupApi } from '../services/groupApi';
import { Group, GroupMember, User } from '../types';

// Components
import GroupDetailsHeader from '../components/group-details/GroupDetailsHeader';
import GroupStats from '../components/group-details/GroupStats';
import GroupMembersList from '../components/group-details/GroupMembersList';
import MemberMenu from '../components/group-details/MemberMenu';
import AddMemberDialog from '../components/group-details/AddMemberDialog';
import ChangeRoleDialog from '../components/group-details/ChangeRoleDialog';
import EditGroupDialog from '../components/groups/EditGroupDialog';

const GroupDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const groupId = id;
  const navigate = useNavigate();
  
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { user } = await authService.checkAuth();
        setUser(user);
      } catch (err) {
        logger.error('Failed to check auth', err);
      }
    };
    init();
  }, []);

  const fetchGroupDetails = async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const data = await groupApi.getGroup(groupId);
      setGroup(data);
      setEditName(data.name);
    } catch (err) {
      logger.error('Failed to fetch group details', err);
      setError('Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
    } else {
      setLoading(false);
    }
  }, [groupId]);

  const handleUpdateGroup = async () => {
    if (!groupId || !editName.trim()) return;
    try {
      setActionLoading(true);
      await groupApi.updateGroup(groupId, { name: editName });
      await fetchGroupDetails();
      setIsEditGroupOpen(false);
    } catch (err) {
      logger.error('Failed to update group', err);
      // Could add toast notification here
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async (email: string) => {
    if (!groupId) return;
    await groupApi.addMember(groupId, email);
    await fetchGroupDetails();
  };

  const handleRemoveMember = async (email: string) => {
    if (!groupId) return;
    try {
      await groupApi.removeMember(groupId, email);
      await fetchGroupDetails();
    } catch (err) {
      logger.error('Failed to remove member', err);
    }
  };

  const handleUpdateRole = async (email: string, newRole: 'admin' | 'member') => {
    if (!groupId) return;
    try {
      await groupApi.updateMemberRole(groupId, email, newRole);
      await fetchGroupDetails();
    } catch (err) {
      logger.error('Failed to update role', err);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, member: GroupMember) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  // Only closes the menu popover — `selectedMember` must survive this, since
  // "Change Role" fires this in the same click handler as opening ChangeRoleDialog,
  // which reads `selectedMember` for its `member` prop.
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !group) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Group not found'}</Alert>
      </Container>
    );
  }

  const currentUserMember = group.members?.find(m => m.email === user?.email);
  const currentUserRole = currentUserMember?.role;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', pb: 8 }}>
      <GroupDetailsHeader 
        groupName={group.name}
        onBack={() => navigate('/')}
        onEdit={() => setIsEditGroupOpen(true)}
        currentUserRole={currentUserRole}
      />

      <Container maxWidth="lg" sx={{ mt: -4, position: 'relative', zIndex: 1 }}>
        <GroupStats group={group} />

        <GroupMembersList 
          group={group}
          currentUserRole={currentUserRole}
          currentUserEmail={user?.email}
          onAddMember={() => setIsAddMemberOpen(true)}
          onMenuOpen={handleMenuOpen}
        />
      </Container>

      {/* Dialogs */}
      <AddMemberDialog 
        open={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onAdd={handleAddMember}
      />

      <EditGroupDialog
        open={isEditGroupOpen}
        onClose={() => setIsEditGroupOpen(false)}
        onSave={handleUpdateGroup}
        name={editName}
        setName={setEditName}
        loading={actionLoading}
      />

      <MemberMenu 
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        selectedMember={selectedMember}
        currentUserRole={currentUserRole}
        onChangeRole={() => setIsChangeRoleOpen(true)}
        onRemoveMember={handleRemoveMember}
      />

      <ChangeRoleDialog
        open={isChangeRoleOpen}
        onClose={() => { setIsChangeRoleOpen(false); setSelectedMember(null); }}
        member={selectedMember}
        onSave={handleUpdateRole}
      />
    </Box>
  );
};

export default GroupDetailsPage;
