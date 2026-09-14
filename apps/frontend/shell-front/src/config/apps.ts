import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HomeIcon from '@mui/icons-material/Home';
import PaymentIcon from '@mui/icons-material/Payment';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import { AppConfig } from './ConfigProvider';
import { brand } from '../theme/tokens';
import { canOfferPurchases } from '../services/platform';

export interface AppConfigItem {
  name: string;
  route: string;
  urlKey?: keyof AppConfig; // Key to get URL from config
  icon: React.ComponentType<SvgIconProps>;
  color: string;
  /** Sells plans or takes payments, so left out where that is not allowed (see canOfferPurchases). */
  purchases?: boolean;
}

/** The modules, in the order the main navigation lists them. */
export const APPS: AppConfigItem[] = [
  {
    name: 'Home',
    route: '/',
    icon: HomeIcon,
    color: brand.purple
  },
  {
    // Shown as Journal, still served from /relationship: bookmarks, the home
    // page's "Back to" link and every service keep the original name.
    name: 'Journal',
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
    // Shown as Money, still served from /finance.
    name: 'Money',
    route: '/finance',
    urlKey: 'FINANCE_FRONT_URL',
    icon: AttachMoneyIcon,
    color: '#22c55e'
  }
];

/**
 * About the person rather than their data. The navigation keeps these behind
 * its Account entry instead of listing them beside the modules.
 */
export const USER_APPS: AppConfigItem[] = [
  {
    name: 'Profile',
    route: '/account',
    urlKey: 'ACCOUNT_FRONT_URL',
    icon: PersonIcon,
    color: '#0f172a'
  },
  {
    name: 'Groups',
    route: '/groups',
    urlKey: 'GROUP_FRONT_URL',
    icon: GroupsIcon,
    color: '#7c3aed'
  },
  {
    name: 'Billing',
    route: '/payments',
    urlKey: 'PAYMENT_FRONT_URL',
    icon: PaymentIcon,
    color: '#6366f1',
    purchases: true
  }
];

const EMBEDDABLE_APPS = [...APPS, ...USER_APPS].filter((app) => app.route !== '/');

/** Whether this platform may show the app at all: a native app lists no billing. */
const isOffered = (app: AppConfigItem) => !app.purchases || canOfferPurchases();

/** The account entries to list on this platform. */
export const getUserApps = () => USER_APPS.filter(isOffered);

/**
 * Match an app by route prefix, so nested child routes like
 * `/album/albums/64f2/photos/abc` still resolve to the Album app. Everything
 * after the prefix belongs to the child app's own router.
 */
export const getAppByRoute = (pathname: string) =>
  EMBEDDABLE_APPS.find(
    // Checked here too, or a link or bookmark would still frame Billing in an app.
    (app) => isOffered(app) && (pathname === app.route || pathname.startsWith(`${app.route}/`))
  );

/** Nav highlighting: an app stays active while the user is deep inside it. */
export const isRouteActive = (route: string, pathname?: string) =>
  !!pathname && (pathname === route || (route !== '/' && pathname.startsWith(`${route}/`)));
