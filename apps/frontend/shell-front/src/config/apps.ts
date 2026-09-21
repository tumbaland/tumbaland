import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import ChatIcon from '@mui/icons-material/ChatBubble';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HomeIcon from '@mui/icons-material/Home';
import PaymentIcon from '@mui/icons-material/Payment';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import GridOnIcon from '@mui/icons-material/GridOn';
import SavingsIcon from '@mui/icons-material/Savings';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TuneIcon from '@mui/icons-material/Tune';
import TimelineIcon from '@mui/icons-material/Timeline';
import MapIcon from '@mui/icons-material/Map';
import DevicesIcon from '@mui/icons-material/Devices';
import LinkIcon from '@mui/icons-material/Link';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import HistoryIcon from '@mui/icons-material/History';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import { AppConfig } from './ConfigProvider';
import { moduleAccent } from '@tumbaland/frontend-core';
import { canOfferPurchases } from '../services/platform';

export interface AppConfigItem {
  name: string;
  route: string;
  urlKey?: keyof AppConfig; // Key to get URL from config
  /**
   * The module-federation remote's name, as its own vite config declares it.
   * The shell loads `<remote>/App` from that origin's remoteEntry.js.
   */
  remote?: string;
  icon: React.ComponentType<SvgIconProps>;
  color: string;
  /** Sells plans or takes payments, so left out where that is not allowed (see canOfferPurchases). */
  purchases?: boolean;
  menu?: ModuleMenuItem[];
}

export interface ModuleMenuItem {
  label: string;
  route: string;
  icon: React.ComponentType<SvgIconProps>;
}

/**
 * Chat's accent, pending a `@tumbaland/frontend-core` release.
 *
 * Every other module reads its colour from `moduleAccent`, which is where this
 * belongs too. It cannot live there yet: the published package is what a Docker
 * build installs (the Dockerfile copies one package.json and runs `npm i`, with
 * no workspace to link against), so adding a key to the library's source only
 * reaches production after that package is released. Editing the current
 * version in place instead would put the registry and this repo out of step,
 * which is the drift the README's release section exists to prevent.
 *
 * Teal, walked down until it clears AA against white like the rest of the set:
 * 5.47:1. Move it to `moduleAccent.chat` on the next frontend-core release.
 */
const CHAT_ACCENT = '#0f766e';

/** The modules, in the order the main navigation lists them. */
export const APPS: AppConfigItem[] = [
  {
    name: 'Home',
    route: '/',
    icon: HomeIcon,
    color: moduleAccent.home
  },
  {
    // Second, right after Home: it is the one module that earns a visit every
    // day, so it sits where a thumb reaches first on a phone.
    name: 'Chat',
    route: '/chat',
    remote: 'chat',
    urlKey: 'CHAT_FRONT_URL',
    icon: ChatIcon,
    color: CHAT_ACCENT
  },
  {
    // Shown as Journal, still served from /relationship: bookmarks, the home
    // page's "Back to" link and every service keep the original name.
    name: 'Journal',
    route: '/relationship',
    remote: 'relationship',
    urlKey: 'RELATIONSHIP_FRONT_URL',
    icon: FavoriteIcon,
    color: moduleAccent.journal,
    menu: [
      { label: 'Dashboard', route: '/relationship/dashboard', icon: DashboardIcon },
      { label: 'Entries', route: '/relationship/journal', icon: TimelineIcon },
      { label: 'Map', route: '/relationship/map', icon: MapIcon }
    ]
  },
  {
    name: 'Album',
    route: '/album',
    remote: 'album',
    urlKey: 'ALBUM_FRONT_URL',
    icon: AlbumIcon,
    color: moduleAccent.album,
    menu: [
      { label: 'Dashboard', route: '/album/dashboard', icon: DashboardIcon },
      { label: 'Albums', route: '/album/albums', icon: PhotoAlbumIcon },
      { label: 'Collages', route: '/album/collages', icon: GridOnIcon }
    ]
  },
  {
    // Shown as Money, still served from /finance.
    name: 'Money',
    route: '/finance',
    remote: 'finance',
    urlKey: 'FINANCE_FRONT_URL',
    icon: AttachMoneyIcon,
    color: moduleAccent.money,
    menu: [
      { label: 'Dashboard', route: '/finance/dashboard', icon: DashboardIcon },
      { label: 'Net Worth', route: '/finance/net-worth', icon: SavingsIcon },
      { label: 'Cash Flow', route: '/finance/cash-flow', icon: AccountBalanceWalletIcon },
      { label: 'Investments', route: '/finance/investments', icon: ShowChartIcon },
      { label: 'Planner', route: '/finance/planner', icon: TuneIcon }
    ]
  }
];

/**
 * About the person rather than their data. The navigation keeps these behind
 * its Account entry instead of listing them beside the modules.
 *
 * Their sections are listed here for the same reason every other module's are:
 * the header bar draws them. Profile and Billing each used to build their own
 * row of MUI `Tabs` inside the page, which put a second, differently styled
 * navigation under the shell's own.
 */
export const USER_APPS: AppConfigItem[] = [
  {
    name: 'Profile',
    route: '/account',
    remote: 'account',
    urlKey: 'ACCOUNT_FRONT_URL',
    icon: PersonIcon,
    color: moduleAccent.profile,
    menu: [
      { label: 'Profile', route: '/account/profile', icon: PersonIcon },
      { label: 'Devices', route: '/account/devices', icon: DevicesIcon },
      { label: 'Connections', route: '/account/connections', icon: LinkIcon },
      { label: 'API keys', route: '/account/api-keys', icon: VpnKeyIcon },
      { label: 'Activity', route: '/account/activity', icon: HistoryIcon }
    ]
  },
  {
    name: 'Groups',
    route: '/groups',
    remote: 'group',
    urlKey: 'GROUP_FRONT_URL',
    icon: GroupsIcon,
    color: moduleAccent.groups
  },
  {
    name: 'Billing',
    route: '/payments',
    remote: 'payment',
    urlKey: 'PAYMENT_FRONT_URL',
    icon: PaymentIcon,
    color: moduleAccent.billing,
    purchases: true,
    menu: [
      { label: 'Plans', route: '/payments/plans', icon: WorkspacePremiumIcon },
      { label: 'Subscriptions', route: '/payments/subscriptions', icon: AutorenewIcon },
      { label: 'Payments', route: '/payments/history', icon: ReceiptLongIcon }
    ]
  }
];

/** A module the shell can load: one with a remote to load it from. */
export type RemoteApp = AppConfigItem & { remote: string };

/**
 * The apps the shell loads as federation remotes — everything but its own Home.
 * Exported for `remotes.ts`, which registers each one's entry point.
 */
export const EMBEDDABLE_APPS: RemoteApp[] = [...APPS, ...USER_APPS].filter(
  (app): app is RemoteApp => app.route !== '/' && Boolean(app.remote)
);

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
