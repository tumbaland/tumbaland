import React from 'react';
import { AppBar, Toolbar, Button, Box, Menu, MenuItem, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { menuItems, type AppMenuItem } from '../const/menuItems.tsx';
import { useEffect, useState } from 'react';
import { AccountCircle, Login, Logout, Menu as MenuIcon } from '@mui/icons-material';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { authService } from '../services/authService';
import { User } from '../types';

const AuthHeader: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const menuItemsWithHandlers = menuItems.map((item: AppMenuItem) => ({
    ...item,
    onClick: () => navigate(item.path)
  }));

  return (
    <AppBar position="static" elevation={2} sx={{ background: 'transparent', color: '#222', boxShadow: 'none', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
      <Toolbar>
        {isMobile ? (
          <>
            <IconButton
              color="inherit"
              onClick={handleMobileMenuOpen}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <Button
                color="inherit"
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  background: 'none',
                  px: 1,
                  minWidth: 0,
                  borderRadius: 2,
                  '&:hover': { background: 'rgba(0,0,0,0.04)' }
                }}
              >
                Groups
              </Button>
            </Box>
            <Box sx={{ flexGrow: 0 }}>
              {isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={24} color="inherit" />
                </Box>
              ) : isAuthenticated && user ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    onClick={handleMenuOpen}
                    size="large"
                    edge="end"
                    aria-label="account menu"
                    aria-controls="account-menu"
                    aria-haspopup="true"
                    color="inherit"
                  >
                    {user?.picture ? (
                      <Avatar src={user.picture as string} sx={{ width: 32, height: 32 }} />
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
                      'aria-labelledby': 'account-button'
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  >
                    <MenuItem disabled>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start'
                        }}
                      >
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
              ) : (
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
              )}
            </Box>
            <Menu
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={handleMobileMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              {menuItemsWithHandlers.map((item: AppMenuItem & { onClick: () => void }) => (
                <MenuItem
                  key={item.label}
                  onClick={() => {
                    item.onClick();
                    handleMobileMenuClose();
                  }}
                >
                  {item.icon}
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {menuItemsWithHandlers.map((item: AppMenuItem & { onClick: () => void }) => (
                <Button
                  key={item.label}
                  color="inherit"
                  startIcon={item.icon}
                  onClick={item.onClick}
                  sx={{
                    fontWeight: 500,
                    textTransform: 'none',
                    background: 'none',
                    '&:hover': { background: 'rgba(0,0,0,0.04)' }
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={24} color="inherit" />
              </Box>
            ) : isAuthenticated && user ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Button
                  onClick={handleMenuOpen}
                  color="inherit"
                  startIcon={user?.picture ? <Avatar src={user.picture as string} sx={{ width: 32, height: 32 }} /> : <AccountCircle />}
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
            ) : (
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
            )}
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AuthHeader;
