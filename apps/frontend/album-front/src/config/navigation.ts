import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import GridOnIcon from '@mui/icons-material/GridOn';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { AuthHeaderNavigationItem } from '@tumbaland/components';

export const navigationItems: AuthHeaderNavigationItem[] = [
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
