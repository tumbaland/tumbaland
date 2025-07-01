import DashboardIcon from '@mui/icons-material/Dashboard';
import ListIcon from '@mui/icons-material/List';

export const menuItems = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/',
  },
  {
    label: 'Records',
    icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/records',
  },
  {
    label: 'Tracked Tickers',
    icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/tracked-tickers',
  },
  {
    label: 'User Portfolio',
    icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/user-portfolio',
  },
  {
    label: 'Ticker Price History',
    icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/ticker-price-history',
  },
];
