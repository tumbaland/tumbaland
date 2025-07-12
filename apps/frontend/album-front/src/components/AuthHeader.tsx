
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
  Divider,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AccountCircle, Login, Logout } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { User } from '../types';
import { navigationItems } from '../config/navigation';

interface AuthHeaderProps {}

const AuthHeader: React.FC<AuthHeaderProps> = () => {
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
    // The logout service will refresh the page, so no need to update state
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

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };
  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  return (
    <AppBar
      position="static"
      elevation={2}
      sx={{
        background: '#fff',
        color: '#222',
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.03)'
      }}
    >
      <Toolbar>
        {isMobile ? (
          <>
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minHeight: 56, pl: 4 }}>
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
                  textOverflow: 'ellipsis',
                  ml: 2 // push menu button slightly right
                }}
              >
                {/* Show current route label, fallback to first menu item */}
                {(() => {
                  let bestMatch = null;
                  let bestLength = -1;
                  for (const item of navigationItems) {
                    if (item.path === '/' && location.pathname === '/' && bestLength < 1) {
                      bestMatch = item;
                      bestLength = 1;
                    } else if (
                      item.path !== '/' &&
                      location.pathname.startsWith(item.path) &&
                      item.path.length > bestLength
                    ) {
                      bestMatch = item;
                      bestLength = item.path.length;
                    }
                  }
                  return bestMatch ? bestMatch.label : navigationItems[0]?.label;
                })()}
              </Button>
            </Box>
            <Box sx={{ flexGrow: 0, ml: 'auto' }}>{renderAuthSection()}</Box>
            <Menu
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={handleMobileMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <MenuItem
                    key={item.path}
                    selected={isActive}
                    onClick={() => {
                      if (item.label === 'Collage') {
                        const collageUrl = `${import.meta.env.VITE_ALBUM_FRONT_URL || ''}/collage`;
                        window.open(collageUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        navigate(item.path);
                      }
                      handleMobileMenuClose();
                    }}
                  >
                    {Icon && <Icon sx={{ mr: 1 }} />}
                    {item.label}
                  </MenuItem>
                );
              })}
            </Menu>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexGrow: 1 }}>
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.path;
                const buttonSx = {
                  fontWeight: isActive ? 700 : 500,
                  textTransform: 'none',
                  background: 'none',
                  borderRadius: 2,
                  px: 2,
                  color: isActive ? 'primary.main' : 'inherit',
                  '&:hover': { background: 'rgba(0,0,0,0.04)' }
                };
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    sx={buttonSx}
                    startIcon={Icon ? <Icon sx={{ mr: 1 }} /> : undefined}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Box>
            <Box sx={{ flexGrow: 0, ml: 2 }}>{renderAuthSection()}</Box>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AuthHeader;
