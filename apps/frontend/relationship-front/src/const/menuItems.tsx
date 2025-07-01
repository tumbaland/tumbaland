import DashboardIcon from '@mui/icons-material/Dashboard';
import ListIcon from '@mui/icons-material/List';

export const menuItems = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/',
  },
  {
    label: 'Activities',
    icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/activities',
  },
];
