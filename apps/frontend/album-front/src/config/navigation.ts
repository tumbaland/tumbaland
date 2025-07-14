import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import GridOnIcon from '@mui/icons-material/GridOn';

export interface NavigationItem {
  label: string;
  path: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

export const navigationItems: Omit<NavigationItem, 'onClick'>[] = [
  {
    label: 'Albums',
    path: '/albums',
    icon: PhotoAlbumIcon
  },
  {
    label: 'Collage',
    path: '/collage',
    icon: GridOnIcon
  }
];

export const createNavigationItems = (navigate: (path: string) => void): NavigationItem[] => {
  return navigationItems.map((item) => ({
    ...item,
    onClick: () => navigate(item.path)
  }));
};
