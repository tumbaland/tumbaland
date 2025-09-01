import type { ReactNode } from 'react';
import GroupsIcon from '@mui/icons-material/Groups';

export type AppMenuItem = { label: string; path: string; icon?: ReactNode };

export const menuItems: AppMenuItem[] = [
  { label: 'My Groups', path: '/', icon: <GroupsIcon fontSize="small" sx={{ mr: 1 }} /> }
];
