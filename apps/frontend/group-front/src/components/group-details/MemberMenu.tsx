import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import {
  PersonRemove as PersonRemoveIcon,
  AdminPanelSettings as AdminPanelSettingsIcon
} from '@mui/icons-material';
import { GroupMember } from '../../types';

interface MemberMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  selectedMember: GroupMember | null;
  currentUserRole?: string;
  onChangeRole: () => void;
  onRemoveMember: (email: string) => void;
}

const MemberMenu: React.FC<MemberMenuProps> = ({
  anchorEl,
  open,
  onClose,
  selectedMember,
  currentUserRole,
  onChangeRole,
  onRemoveMember
}) => {
  if (!selectedMember) return null;

  const canManageRole = currentUserRole === 'owner' || (currentUserRole === 'admin' && selectedMember.role !== 'owner');
  const canRemove = currentUserRole === 'owner' || (currentUserRole === 'admin' && selectedMember.role !== 'owner');

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
    >
      {canManageRole && selectedMember.role !== 'owner' && (
        <MenuItem
          onClick={() => {
            onChangeRole();
            onClose();
          }}
        >
          <ListItemIcon>
            <AdminPanelSettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change Role</ListItemText>
        </MenuItem>
      )}
      {canRemove && selectedMember.role !== 'owner' && (
        <MenuItem
          onClick={() => {
            onRemoveMember(selectedMember.email);
            onClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <PersonRemoveIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Remove from Group</ListItemText>
        </MenuItem>
      )}
    </Menu>
  );
};

export default MemberMenu;
