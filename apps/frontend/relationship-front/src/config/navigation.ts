import DashboardIcon from '@mui/icons-material/Dashboard';
import TimelineIcon from '@mui/icons-material/Timeline';
import MapIcon from '@mui/icons-material/Map';
import { AuthHeaderNavigationItem } from '@tumbaland/frontend-core';

export const navigationItems: AuthHeaderNavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: DashboardIcon
  },
  {
    label: 'Entries',
    path: '/journal',
    icon: TimelineIcon
  },
  {
    label: 'Map',
    path: '/map',
    icon: MapIcon
  }
];
