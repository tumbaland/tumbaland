import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CategoryIcon from '@mui/icons-material/Category';

export const menuItems = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/'
  },
  {
    label: 'Journal',
    icon: <MenuBookIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/journal'
  },
  {
    label: 'Activity Types',
    icon: <CategoryIcon fontSize="small" sx={{ mr: 1 }} />,
    path: '/activity-types'
  }
];
