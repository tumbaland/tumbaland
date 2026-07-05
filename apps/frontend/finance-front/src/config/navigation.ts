import DashboardIcon from '@mui/icons-material/Dashboard';
import SavingsIcon from '@mui/icons-material/Savings';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CalculateIcon from '@mui/icons-material/Calculate';
import TuneIcon from '@mui/icons-material/Tune';
import { AuthHeaderNavigationItem } from '@tumbaland/components';

export const navigationItems: AuthHeaderNavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: DashboardIcon
  },
  {
    label: 'Net Worth',
    path: '/net-worth',
    icon: SavingsIcon
  },
  {
    label: 'Investments',
    path: '/investments',
    icon: ShowChartIcon
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
