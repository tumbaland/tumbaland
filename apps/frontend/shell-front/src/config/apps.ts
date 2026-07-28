import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HomeIcon from '@mui/icons-material/Home';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { AppConfig } from './ConfigProvider';
import GroupsIcon from '@mui/icons-material/Groups';

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

const EMBEDDABLE_APPS = [...APPS, ...USER_APPS].filter((app) => app.route !== '/');

/**
 * Match an app by route prefix, so nested child routes like
 * `/album/albums/64f2/photos/abc` still resolve to the Album app. Everything
 * after the prefix belongs to the child app's own router.
 */
export const getAppByRoute = (pathname: string) =>
  EMBEDDABLE_APPS.find((app) => pathname === app.route || pathname.startsWith(`${app.route}/`));

/** Nav highlighting: an app stays active while the user is deep inside it. */
export const isRouteActive = (route: string, pathname?: string) =>
  !!pathname && (pathname === route || (route !== '/' && pathname.startsWith(`${route}/`)));
