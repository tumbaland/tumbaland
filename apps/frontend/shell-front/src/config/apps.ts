import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HomeIcon from '@mui/icons-material/Home';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { AppConfig } from './ConfigProvider';
import GroupsIcon from '@mui/icons-material/Groups';
import VisibilityIcon from '@mui/icons-material/Visibility';

export interface AppConfigItem {
  name: string;
  route: string;
  urlKey?: keyof AppConfig; // Key to get URL from config
  icon: React.ComponentType;
  color: string;
  external?: boolean; // For external links
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
    urlKey: 'RELATIONSHIP_FRONT_URL',
    icon: FavoriteIcon,
    color: '#ef4444'
  },
  {
    name: 'Album',
    route: '/album',
    urlKey: 'ALBUM_FRONT_URL',
    icon: AlbumIcon,
    color: '#3b82f6'
  },
  {
    name: 'Finance',
    route: '/finance',
    urlKey: 'FINANCE_FRONT_URL',
    icon: AttachMoneyIcon,
    color: '#22c55e'
  },
  {
    name: 'Vision',
    route: 'https://vision.tumbaland.eu',
    icon: VisibilityIcon,
    color: '#f59e0b',
    external: true
  }
];

export const USER_APPS: AppConfigItem[] = [
  {
    name: 'Payments',
    route: '/payments',
    urlKey: 'PAYMENT_FRONT_URL',
    icon: PaymentIcon,
    color: '#6366f1'
  },
  {
    name: 'Groups',
    route: '/groups',
    urlKey: 'GROUP_FRONT_URL',
    icon: GroupsIcon,
    color: '#7c3aed'
  },
  {
    name: 'Account',
    route: '/account',
    urlKey: 'ACCOUNT_FRONT_URL',
    icon: AccountCircleIcon,
    color: '#0f172a'
  }
];

export const getAppByRoute = (route: string) => {
  return [...APPS, ...USER_APPS].find((app) => app.route === route);
};
