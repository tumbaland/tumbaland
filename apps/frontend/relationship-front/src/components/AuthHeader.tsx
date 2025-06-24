import React, { useEffect, useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Avatar, 
  Box, 
  Menu, 
  MenuItem, 
  IconButton,
  CircularProgress,
  Divider
} from '@mui/material';
import { AccountCircle, Login, Logout } from '@mui/icons-material';
import { authService, User } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListIcon from '@mui/icons-material/List';

interface AuthHeaderProps {}

const AuthHeader: React.FC<AuthHeaderProps> = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();

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
    // The logout service will refresh the page, so no need to update state
  };

  const menuItems = [
    {
      label: 'Dashboard',
      icon: <DashboardIcon fontSize="small" sx={{ mr: 1 }} />,
      onClick: () => navigate('/'),
    },
    {
      label: 'Activities',
      icon: <ListIcon fontSize="small" sx={{ mr: 1 }} />,
      onClick: () => navigate('/activities'),
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
          <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
            {user.name}
          </Typography>
          <IconButton
            onClick={handleMenuOpen}
            size="large"
            edge="end"
            aria-label="account menu"
            aria-controls="account-menu"
            aria-haspopup="true"
            color="inherit"
          >
            {user.picture ? (
              <Avatar
                src={user.picture}
                alt={user.name}
                sx={{ width: 32, height: 32 }}
              />
            ) : (
              <AccountCircle />
            )}
          </IconButton>
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            MenuListProps={{
              'aria-labelledby': 'account-button',
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" fontWeight="bold">
                  {user.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
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
        {/* Menu items */}
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

export default AuthHeader;
