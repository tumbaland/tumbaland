import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import type { SectionBarItem } from '@tumbaland/frontend-core';
import { appPath } from './appBase';

/**
 * The pages of this app, in the order the header bar lists them.
 *
 * shell-front keeps the same list in its own `config/apps.ts`, which is what
 * draws the bar while this app runs inside the shell. This copy is what draws
 * it when the app is opened on its own.
 */
export const ADMIN_SECTIONS: SectionBarItem[] = [
  { label: 'Overview', route: appPath('/overview'), icon: DashboardIcon },
  { label: 'Users', route: appPath('/users'), icon: PeopleIcon },
  { label: 'Assistants', route: appPath('/assistants'), icon: SmartToyIcon },
  { label: 'Claude', route: appPath('/claude'), icon: AutoAwesomeIcon },
  { label: 'Deletions', route: appPath('/deletions'), icon: DeleteOutlinedIcon }
];
