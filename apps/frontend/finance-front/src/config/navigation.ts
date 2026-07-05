import DashboardIcon from '@mui/icons-material/Dashboard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CalculateIcon from '@mui/icons-material/Calculate';
import TuneIcon from '@mui/icons-material/Tune';
import CategoryIcon from '@mui/icons-material/Category';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { AuthHeaderNavigationItem } from '@tumbaland/components';

export const navigationItems: AuthHeaderNavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: DashboardIcon
  },
  {
    label: 'Allocation',
    path: '/asset-allocations',
    icon: AssessmentIcon
  },
  {
    label: 'Asset',
    path: '/asset-classes',
    icon: CategoryIcon
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
