import type { ReactNode } from 'react';
import GroupsIcon from '@mui/icons-material/Groups';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

export type AppMenuItem = { label: string; path: string; icon?: ReactNode };

export const menuItems: AppMenuItem[] = [
  { label: 'My Groups', path: '/', icon: <GroupsIcon fontSize="small" sx={{ mr: 1 }} /> },
  { label: 'Accept Invite', path: '/accept', icon: <GroupAddIcon fontSize="small" sx={{ mr: 1 }} /> }
];
