import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import GridOnIcon from '@mui/icons-material/GridOn';
import DashboardIcon from '@mui/icons-material/Dashboard';

export interface NavigationItem {
  label: string;
  path: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

export const navigationItems: Omit<NavigationItem, 'onClick'>[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: DashboardIcon
  },
  {
    label: 'Albums',
    path: '/albums',
    icon: PhotoAlbumIcon
  },
  {
    label: 'Collages',
    path: '/collages',
    icon: GridOnIcon
  }
];

export const createNavigationItems = (navigate: (path: string) => void): NavigationItem[] => {
  return navigationItems.map((item) => ({
    ...item,
    onClick: () => navigate(item.path)
  }));
};
