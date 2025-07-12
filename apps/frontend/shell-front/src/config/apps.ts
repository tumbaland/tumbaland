import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HomeIcon from '@mui/icons-material/Home';
import { AppConfig } from './ConfigProvider';

export interface AppConfigItem {
  name: string;
  route: string;
  urlKey?: keyof AppConfig; // Key to get URL from config
  icon: React.ComponentType;
  color: string;
}

export const APPS: AppConfigItem[] = [
  {
    name: 'Home',
    route: '/',
    icon: HomeIcon,
    color: '#334155'
  },
  {
    name: 'Relationship',
    route: '/relationship',
    urlKey: 'RELATIONSHIP_URL',
    icon: FavoriteIcon,
    color: '#ef4444'
  },
  {
    name: 'Album',
    route: '/album',
    urlKey: 'ALBUM_URL',
    icon: AlbumIcon,
    color: '#3b82f6'
  },
  {
    name: 'Finance',
    route: '/finance',
    urlKey: 'FINANCE_URL',
    icon: AttachMoneyIcon,
    color: '#22c55e'
  }
];

export const getAppByRoute = (route: string) => APPS.find((app) => app.route === route);
