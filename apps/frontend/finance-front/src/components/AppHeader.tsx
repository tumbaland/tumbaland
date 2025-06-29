import React from 'react';
import { AppBar, Toolbar, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListIcon from '@mui/icons-material/List';
import { useEffect, useState } from 'react';
import { AccountCircle, Login, Logout } from '@mui/icons-material';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { authService, User } from '../services/authService';

const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { authenticated, user } = await authService.checkAuth();
        setIsAuthenticated(authenticated);
        setUser(user);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleLogin = () => {
    authService.redirectToLogin();
  };
  const handleLogout = async () => {
    setIsLoading(true);
    await authService.logout();
    handleMenuClose();
  };

  const menuItems = [
    {
      label: 'Dashboard',
      icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
      onClick: () => navigate('/'),
    },
    {
      label: 'Records',
      icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
      onClick: () => navigate('/records'),
    },
    {
      label: 'Tracked Tickers',
      icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
      onClick: () => navigate('/tracked-tickers'),
    },
    {
      label: 'User Portfolio',
      icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
      onClick: () => navigate('/user-portfolio'),
    },
    {
      label: 'Ticker Price History',
      icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
      onClick: () => navigate('/ticker-price-history'),
    },
  ];

  const renderAuthSection = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CircularProgress size={24} color="inherit" />
        </Box>
      );
    }
    if (isAuthenticated && user) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            onClick={handleMenuOpen}
            color="inherit"
            startIcon={user.picture ? <Avatar src={user.picture} sx={{ width: 32, height: 32 }} /> : <AccountCircle />}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {user.name}
          </Button>
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            MenuListProps={{ 'aria-labelledby': 'account-button' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 'bold' }}>{user.name}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{user.email}</span>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      );
    }
    return (
      <Button
        color="inherit"
        onClick={handleLogin}
        variant="outlined"
        startIcon={<Login />}
        sx={{
          borderColor: 'rgba(255, 255, 255, 0.3)',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.7)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)'
          }
        }}
      >
        Login
      </Button>
    );
  };

  return (
    <AppBar position="static" elevation={2} sx={{ background: '#fff', color: '#222', boxShadow: '0 2px 8px 0 rgba(0,0,0,0.03)' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {menuItems.map((item) => (
            <Button
              key={item.label}
              color="inherit"
              startIcon={item.icon}
              onClick={item.onClick}
              sx={{
                fontWeight: 500,
                textTransform: 'none',
                background: 'none',
                '&:hover': { background: 'rgba(0,0,0,0.04)' },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {renderAuthSection()}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
