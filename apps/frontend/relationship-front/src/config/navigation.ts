import DashboardIcon from '@mui/icons-material/Dashboard';
import TimelineIcon from '@mui/icons-material/Timeline';
import MapIcon from '@mui/icons-material/Map';
import SettingsIcon from '@mui/icons-material/Settings';
import { AuthHeaderNavigationItem } from '@tumbaland/components';

export const navigationItems: AuthHeaderNavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: DashboardIcon
  },
  {
    label: 'Journal',
    path: '/journal',
    icon: TimelineIcon
  },
  {
    label: 'Map',
    path: '/map',
    icon: MapIcon
  },
  {
    label: 'Types',
    path: '/activity-types',
    icon: SettingsIcon
  }
];
