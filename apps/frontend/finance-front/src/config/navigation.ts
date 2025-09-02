import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CalculateIcon from '@mui/icons-material/Calculate';
import TuneIcon from '@mui/icons-material/Tune';

export interface NavigationItem {
  label: string;
  path: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

export const navigationItems: Omit<NavigationItem, 'onClick'>[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: DashboardIcon
  },
  {
    label: 'Records',
    path: '/records',
    icon: ReceiptLongIcon
  },
  {
    label: 'Tickers',
    path: '/tracked-tickers',
    icon: ShowChartIcon
  },
  {
    label: 'Portfolio',
    path: '/user-portfolio',
    icon: AccountBalanceWalletIcon
  },
  {
    label: 'Calculator',
    path: '/stock-growth-calculator',
    icon: CalculateIcon
  },
  {
    label: 'Optimizer',
    path: '/portfolio-optimizer',
    icon: TuneIcon
  }
];

export const createNavigationItems = (navigate: (path: string) => void): NavigationItem[] => {
  return navigationItems.map((item) => ({
    ...item,
    onClick: () => navigate(item.path)
  }));
};
