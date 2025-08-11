import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Menu as MuiMenu,
  MenuItem as MuiMenuItem,
  CircularProgress,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { AccountCircle, Login, Logout, Assignment, ListAlt, Payments } from '@mui/icons-material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { User } from '../types';

interface MenuItemDef { label: string; path: string; icon: React.ReactNode; }
const menuItems: MenuItemDef[] = [
  { label: 'Plans', path: '/', icon: <Assignment fontSize="small" sx={{ mr: 1 }} /> },
  { label: 'Subscription', path: '/subscription', icon: <Payments fontSize="small" sx={{ mr: 1 }} /> },
  { label: 'Payments', path: '/payments', icon: <ListAlt fontSize="small" sx={{ mr: 1 }} /> }
];

const AuthHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const check = async () => {
      try {
        const { authenticated, user } = await authService.checkAuth();
        setIsAuthenticated(authenticated);
        setUser(user);
      } finally {
        setIsLoading(false);
      }
    };
    check();
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => setMobileMenuAnchor(event.currentTarget);
  const handleMobileMenuClose = () => setMobileMenuAnchor(null);

  const handleLogin = () => authService.redirectToLogin();
  const handleLogout = async () => { await authService.logout(); handleMenuClose(); };

  const currentMenuLabel = () => {
    let best = menuItems[0];
    let bestLen = -1;
    for (const item of menuItems) {
      if (location.pathname === item.path && item.path.length > bestLen) { best = item; bestLen = item.path.length; }
      else if (item.path !== '/' && location.pathname.startsWith(item.path) && item.path.length > bestLen) { best = item; bestLen = item.path.length; }
    }
    return best.label;
  };

  const authSection = () => {
    if (isLoading) return <CircularProgress size={24} color="inherit" />;
    if (isAuthenticated && user) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            onClick={handleMenuOpen}
            color="inherit"
            startIcon={<AccountCircle />}
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
                <span style={{ fontWeight: 'bold' }}>{user.email}</span>
                {user.email && <span style={{ fontSize: 12, color: '#888' }}>{user.email}</span>}
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout fontSize="small" style={{ marginRight: 8 }} /> Logout
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
          borderColor: 'rgba(0,0,0,0.3)',
          color: '#222',
          '&:hover': { borderColor: 'rgba(0,0,0,0.6)', backgroundColor: 'rgba(0,0,0,0.04)' }
        }}
      >
        Login
      </Button>
    );
  };

  return (
    <AppBar position="static" elevation={2} sx={{ background: '#fff', color: '#222', boxShadow: '0 2px 8px 0 rgba(0,0,0,0.03)' }}>
      <Toolbar>
        {isMobile ? (
          <>
            <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center', minHeight: 56 }}>
              <Button
                color="inherit"
                onClick={handleMobileMenuOpen}
                endIcon={<ExpandMoreIcon />}
                sx={{
                  fontWeight: 500,
                  textTransform: 'none',
                  background: 'none',
                  px: 1.5,
                  minWidth: 0,
                  borderRadius: 2,
                  '&:hover': { background: 'rgba(0,0,0,0.04)' },
                  maxWidth: '70vw',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
              >
                {currentMenuLabel()}
              </Button>
            </Box>
            <MuiMenu
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={handleMobileMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              {menuItems.map((item) => (
                <MuiMenuItem
                  key={item.label}
                  selected={location.pathname === item.path}
                  onClick={() => {
                    navigate(item.path);
                    handleMobileMenuClose();
                  }}
                >
                  {item.icon}
                  {item.label}
                </MuiMenuItem>
              ))}
            </MuiMenu>
          </>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.label}
                color="inherit"
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                sx={{
                  fontWeight: 500,
                  textTransform: 'none',
                  background: 'none',
                  '&:hover': { background: 'rgba(0,0,0,0.04)' },
                  ...(location.pathname === item.path && { fontWeight: 600, background: 'rgba(0,0,0,0.04)' })
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {authSection()}
      </Toolbar>
    </AppBar>
  );
};

export default AuthHeader;
