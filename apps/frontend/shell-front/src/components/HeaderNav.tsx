import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Typography,
  Divider,
  CircularProgress
} from '@mui/material';
import { AccountCircle, Login, Logout, Person, Groups, Payment } from '@mui/icons-material';
import { authService } from '../services/authService';
import { User } from '../types';

interface HeaderNavProps {
  currentRoute?: string;
}

export function HeaderNav({ currentRoute }: HeaderNavProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
              <Avatar src={user.picture} alt={user.name} sx={{ width: 32, height: 32 }} />
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
                <Typography variant="body2" fontWeight="bold">
                  {user.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { navigate('/account'); handleMenuClose(); }}>
              <Person fontSize="small" sx={{ mr: 1 }} />
              Account
            </MenuItem>
            <MenuItem onClick={() => { navigate('/groups'); handleMenuClose(); }}>
              <Groups fontSize="small" sx={{ mr: 1 }} />
              Groups
            </MenuItem>
            <MenuItem onClick={() => { navigate('/payments'); handleMenuClose(); }}>
              <Payment fontSize="small" sx={{ mr: 1 }} />
              Billing
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
          borderColor: 'rgba(0, 0, 0, 0.3)',
          '&:hover': {
            borderColor: 'rgba(0, 0, 0, 0.7)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        Login
      </Button>
    );
  };

  // Only show header nav for account management routes
  const isAccountManagementRoute = currentRoute?.startsWith('/account') ||
                                   currentRoute?.startsWith('/groups') ||
                                   currentRoute?.startsWith('/payments');

  if (!isAccountManagementRoute) {
    return null;
  }

  // On mobile, show compact header with contextual title (no back arrow to avoid burger menu overlap)
  if (isMobile) {
    return (
      <Box
        sx={{
          height: 56,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          zIndex: 1000,
          position: 'relative',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, pl: 5 }}>
        </Box>

        <Box sx={{ flexGrow: 0 }}>
          {renderAuthSection()}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: 64,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        px: 3,
        zIndex: 1000,
        position: 'relative',
        marginLeft: '60px', // Account for fixed sidemenu width
        width: 'calc(100% - 60px)', // Ensure header spans remaining width
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
      </Box>

      <Box sx={{ flexGrow: 0 }}>
        {renderAuthSection()}
      </Box>
    </Box>
  );
}
