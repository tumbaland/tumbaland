import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import GroupsIcon from '@mui/icons-material/Groups';

export interface ModuleAction {
  label: string;
  /** Shell route; child paths ride along into the embedded app. */
  route: string;
}

export interface HomeModule {
  key: string;
  name: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ sx?: object }>;
  /** Primary destination when the card itself is clicked. */
  route: string;
  actions: ModuleAction[];
}

/**
 * Names and colours mirror config/apps.ts. Every route here is a real child
 * route of the embedded app — see each front's own router — so the deep links
 * land on a page rather than the app's default view.
 */
export const HOME_MODULES: HomeModule[] = [
  {
    key: 'album',
    name: 'Album',
    description: 'Photos, collages and automatic tagging.',
    color: '#3b82f6',
    icon: AlbumIcon,
    route: '/album/albums',
    actions: [
      { label: 'Albums', route: '/album/albums' },
      { label: 'Collages', route: '/album/collages' }
    ]
  },
  {
    // `key` is the route segment, which kept the old name: moduleForRoute
    // matches on it, so it must not follow the display name.
    key: 'finance',
    name: 'Money',
    description: 'Net worth, cash flow, holdings and the planner.',
    color: '#22c55e',
    icon: AttachMoneyIcon,
    route: '/finance/dashboard',
    actions: [
      { label: 'Net worth', route: '/finance/net-worth' },
      { label: 'Cash flow', route: '/finance/cash-flow' }
    ]
  },
  {
    key: 'relationship',
    name: 'Journal',
    description: 'Write down what you did together, and see where the time went.',
    color: '#ef4444',
    icon: FavoriteIcon,
    route: '/relationship/journal',
    actions: [
      { label: 'Entries', route: '/relationship/journal' },
      { label: 'Map', route: '/relationship/map' }
    ]
  },
  {
    key: 'groups',
    name: 'Groups',
    description: 'Share any of it with your household.',
    color: '#7c3aed',
    icon: GroupsIcon,
    route: '/groups',
    actions: [{ label: 'Manage groups', route: '/groups' }]
  }
];

/** Human label for a stored last-visited route, e.g. `/finance/net-worth`. */
export function moduleForRoute(route: string | null): HomeModule | null {
  if (!route) return null;
  return HOME_MODULES.find((m) => route === `/${m.key}` || route.startsWith(`/${m.key}/`)) ?? null;
}
