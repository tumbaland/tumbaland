import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { groupApi } from '../../services/groupApi';
import { authService } from '../../services/authService';
import { Group } from '../../types';
import GroupsHeader from '../groups/GroupsHeader';
import GroupsStats from '../groups/GroupsStats';
import GroupsList from '../groups/GroupsList';
import CreateGroupDialog from '../groups/CreateGroupDialog';
import EditGroupDialog from '../groups/EditGroupDialog';
import DeleteGroupDialog from '../groups/DeleteGroupDialog';

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
    <Box sx={{ minHeight: '100vh', backgroundColor: 'transparent' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, py: 3 }}>
        <GroupsHeader onCreateClick={() => setCreateOpen(true)} />
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <GroupsStats groups={groups} getUserRole={getUserRole} />

        <GroupsList
          groups={groups}
          canModifyGroup={canModifyGroup}
          getUserRole={getUserRole}
          onMenuOpen={openMenu}
          onCreateClick={() => setCreateOpen(true)}
        />
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

      <CreateGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateGroup}
        name={createName}
        setName={setCreateName}
        loading={createLoading}
      />

      <EditGroupDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditGroup}
        name={editName}
        setName={setEditName}
        loading={editLoading}
      />

      <DeleteGroupDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDelete={handleDeleteGroup}
        group={deleteGroup}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default GroupsTab;
