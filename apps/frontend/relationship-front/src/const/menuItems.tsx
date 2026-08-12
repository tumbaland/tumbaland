import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuBookIcon from '@mui/icons-material/MenuBook';

export const menuItems = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/dashboard'
  },
  {
    label: 'Journal',
    icon: <MenuBookIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/journal'
  }
];
