import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import GroupsIcon from '@mui/icons-material/Groups';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import MapIcon from '@mui/icons-material/Map';

type IconComponent = React.ComponentType<{ sx?: object }>;

export interface HomeModule {
  key: string;
  name: string;
  /** One line: it is cut off rather than wrapped on a phone. */
  description: string;
  color: string;
  icon: IconComponent;
  /** Where opening the module lands. */
  route: string;
}

/**
 * Names, colours and order mirror config/apps.ts, so the list on the home page
 * reads in the same order as the tab bar under it. Every route is a real child
 * route of the embedded app, so it lands on a page rather than the app's
 * default view.
 */
export const HOME_MODULES: HomeModule[] = [
  {
    // `key` is the route segment, which kept the old name: moduleForRoute
    // matches on it, so it must not follow the display name.
    key: 'relationship',
    name: 'Journal',
    description: 'What you did together, and when.',
    color: '#ef4444',
    icon: FavoriteIcon,
    route: '/relationship/journal'
  },
  {
    key: 'album',
    name: 'Album',
    description: 'Photos, albums and collages.',
    color: '#3b82f6',
    icon: AlbumIcon,
    route: '/album/albums'
  },
  {
    key: 'finance',
    name: 'Money',
    description: 'Net worth, cash flow and holdings.',
    color: '#22c55e',
    icon: AttachMoneyIcon,
    route: '/finance/dashboard'
  },
  {
    key: 'groups',
    name: 'Groups',
    description: 'Share any of it with your household.',
    color: '#7c3aed',
    icon: GroupsIcon,
    route: '/groups'
  }
];

/** The module a stored last-visited route belongs to, e.g. `/finance/net-worth` is Money. */
export function moduleForRoute(route: string | null): HomeModule | null {
  if (!route) return null;
  return HOME_MODULES.find((m) => route === `/${m.key}` || route.startsWith(`/${m.key}/`)) ?? null;
}

/**
 * Today as the journal keys a day: the UTC date, the same way JournalPage's own
 * `todayKey` does, so "Log today" opens the day the journal itself calls today.
 */
export const journalTodayKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

export interface QuickAction {
  key: string;
  label: string;
  color: string;
  icon: IconComponent;
  /** Resolved when pressed, so "today" is the day it is tapped, not the day the page loaded. */
  route: () => string;
}

/** One tap each, for the things people open the app to do. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'log-today',
    label: 'Log today',
    color: '#ef4444',
    icon: EditCalendarIcon,
    // The journal opens its day editor for a `?date=` link.
    route: () => `/relationship/journal?date=${journalTodayKey()}`
  },
  { key: 'albums', label: 'Albums', color: '#3b82f6', icon: PhotoLibraryIcon, route: () => '/album/albums' },
  { key: 'net-worth', label: 'Net worth', color: '#22c55e', icon: ShowChartIcon, route: () => '/finance/net-worth' },
  { key: 'map', label: 'Map', color: '#f97316', icon: MapIcon, route: () => '/relationship/map' }
];
