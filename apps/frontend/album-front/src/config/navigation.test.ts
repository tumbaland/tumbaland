import DashboardIcon from '@mui/icons-material/Dashboard';
import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import GridOnIcon from '@mui/icons-material/GridOn';
import { navigationItems } from './navigation';

it('defines Dashboard, Albums, and Collages nav items with their paths and icons', () => {
  expect(navigationItems).toEqual([
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Albums', path: '/albums', icon: PhotoAlbumIcon },
    { label: 'Collages', path: '/collages', icon: GridOnIcon }
  ]);
});
