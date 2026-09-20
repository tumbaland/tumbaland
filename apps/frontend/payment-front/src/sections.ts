import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import type { SectionBarItem } from '@tumbaland/frontend-core';
import { appPath } from './appBase';

/**
 * The pages of this app, in the order the header bar lists them.
 *
 * shell-front keeps the same list in its own `config/apps.ts`, which is what
 * draws the bar while this app runs inside the shell. This copy is what draws
 * it when the app is opened on its own.
 */
export const PAYMENT_SECTIONS: SectionBarItem[] = [
  { label: 'Plans', route: appPath('/plans'), icon: WorkspacePremiumIcon },
  { label: 'Subscriptions', route: appPath('/subscriptions'), icon: AutorenewIcon },
  { label: 'Payments', route: appPath('/history'), icon: ReceiptLongIcon }
];
