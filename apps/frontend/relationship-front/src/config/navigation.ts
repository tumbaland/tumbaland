import DashboardIcon from '@mui/icons-material/Dashboard';
import TimelineIcon from '@mui/icons-material/Timeline';

export interface NavigationItem {
  label: string;
  path: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

export const navigationItems: Omit<NavigationItem, 'onClick'>[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: DashboardIcon
  },
  {
    label: 'Activities',
    path: '/activities',
    icon: TimelineIcon
  }
];

export const createNavigationItems = (navigate: (path: string) => void): NavigationItem[] => {
  return navigationItems.map((item) => ({
    ...item,
    onClick: () => navigate(item.path)
  }));
};
