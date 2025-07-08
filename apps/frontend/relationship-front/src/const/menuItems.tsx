import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';

export const menuItems = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/',
  },
  {
    label: 'Activities',
    icon: <DirectionsRunIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/activities',
  },
];
