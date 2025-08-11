import type { ReactNode } from 'react';
import ViewListIcon from '@mui/icons-material/ViewList';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

export type AppMenuItem = { label: string; path: string; icon?: ReactNode };

export const menuItems: AppMenuItem[] = [
	{
		label: 'Plans',
		icon: <ViewListIcon fontSize="small" sx={{ mr: 1 }} />,
		path: '/'
	},
	{
		label: 'Subscription',
		icon: <CardMembershipIcon fontSize="small" sx={{ mr: 1 }} />,
		path: '/subscription'
	},
	{
		label: 'Payments',
		icon: <ReceiptLongIcon fontSize="small" sx={{ mr: 1 }} />,
		path: '/payments'
	}
];