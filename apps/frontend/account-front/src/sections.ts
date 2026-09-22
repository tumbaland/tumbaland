import PersonIcon from '@mui/icons-material/Person';
import DevicesIcon from '@mui/icons-material/Devices';
import LinkIcon from '@mui/icons-material/Link';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import HistoryIcon from '@mui/icons-material/History';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import type { SectionBarItem } from '@tumbaland/frontend-core';
import { appPath } from './appBase';

/**
 * The pages of this app, in the order the header bar lists them.
 *
 * Keys and connections are two sections rather than one screen because they
 * are two different things a person does. A key is a secret to create, read
 * back and paste somewhere; a connection is something already approved that
 * you only ever revoke. Under one heading the "New key" button sat above a
 * list of things no key was made for.
 *
 * shell-front keeps the same list in its own `config/apps.ts`, which is what
 * draws the bar while this app runs inside the shell. This copy is what draws
 * it when the app is opened on its own.
 */
export const ACCOUNT_SECTIONS: SectionBarItem[] = [
  { label: 'Profile', route: appPath('/profile'), icon: PersonIcon },
  { label: 'Features', route: appPath('/features'), icon: ToggleOnOutlinedIcon },
  { label: 'Devices', route: appPath('/devices'), icon: DevicesIcon },
  { label: 'Connections', route: appPath('/connections'), icon: LinkIcon },
  { label: 'API keys', route: appPath('/api-keys'), icon: VpnKeyIcon },
  { label: 'Activity', route: appPath('/activity'), icon: HistoryIcon }
];
