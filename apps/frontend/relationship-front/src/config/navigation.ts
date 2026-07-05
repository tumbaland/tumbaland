import DashboardIcon from '@mui/icons-material/Dashboard';
import TimelineIcon from '@mui/icons-material/Timeline';
import SettingsIcon from '@mui/icons-material/Settings';
import { AuthHeaderNavigationItem } from '@tumbaland/components';

export const navigationItems: AuthHeaderNavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: DashboardIcon
  },
  {
    label: 'Activities',
    path: '/activities',
    icon: TimelineIcon
  },
  {
    label: 'Types',
    path: '/activity-types',
    icon: SettingsIcon
  }
];
