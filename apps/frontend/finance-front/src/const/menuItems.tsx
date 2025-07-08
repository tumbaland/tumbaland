import DashboardIcon from '@mui/icons-material/Dashboard';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PieChartIcon from '@mui/icons-material/PieChart';

export const menuItems = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/',
  },
  {
    label: 'Old Records',
    icon: <HistoryIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/records',
  },
  {
    label: 'Tickers',
    icon: <TrendingUpIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/tracked-tickers',
  },
  {
    label: 'Portfolio',
    icon: <PieChartIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/user-portfolio',
  },
];
