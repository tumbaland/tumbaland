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
import { AccountCircle, Logout, Person, Groups, Payment } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { User } from '../types';
import { navigationItems } from '../config/navigation';
import { TenantSelector, useTenant } from './tenant';
import { useConfig } from '../hooks/useConfig';
import { NotificationsMenu } from '@tumbaland/components';
import { LoginButton } from '@tumbaland/components';

interface AuthHeaderProps {
  user?: User | null;
  isAuthenticated?: boolean;
}

const AuthHeader: React.FC<AuthHeaderProps> = ({ user: propUser, isAuthenticated: propIsAuthenticated }) => {
  const [user, setUser] = useState<User | null>(propUser || null);
  const [isAuthenticated, setIsAuthenticated] = useState(propIsAuthenticated || false);
  const [isLoading, setIsLoading] = useState(!propUser && !propIsAuthenticated);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);
  const config = useConfig();

  // Tenant management - only call when we have valid config and authenticated user
  const {
    selectedTenant,
    availableTenants,
    loading: tenantsLoading,
    error: tenantsError,
    setSelectedTenant
  } = useTenant(
    config.GROUP_API_URL || '', 
    isAuthenticated && config.GROUP_API_URL ? user?.email : undefined
  );

  // Get user data from JWT token instead of API call
  useEffect(() => {
    if (propUser !== undefined && propIsAuthenticated !== undefined) {
      setUser(propUser);
      setIsAuthenticated(propIsAuthenticated);
      setIsLoading(false);
      return;
    }

    // Try to get user from JWT token first
    const tokenUser = authService.getCurrentUserFromToken();
    if (tokenUser) {
      setUser(tokenUser);
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // Fallback to API call if token decode fails
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
  }, [propUser, propIsAuthenticated]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
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
          <CircularProgress size={20} color="inherit" />
        </Box>
      );
    }

    if (isAuthenticated && user) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
          <NotificationsMenu
            onClick={handleNotificationClick}
            anchorEl={notificationAnchorEl}
            onClose={handleNotificationClose}
            notificationCount={0} // TODO: Replace with actual notification count
          />
          <IconButton
            onClick={handleMenuOpen}
            size="small" // Changed from "large" to "small" for mobile
            edge="end"
            aria-label="account menu"
            aria-controls="account-menu"
            aria-haspopup="true"
            color="inherit"
            sx={{
              padding: { xs: 0.5, sm: 1 }
            }}
          >
            {user.picture ? (
              <Avatar src={user.picture} alt={user.name} sx={{ width: { xs: 24, sm: 32 }, height: { xs: 24, sm: 32 } }} />
            ) : (
              <AccountCircle sx={{ fontSize: { xs: 20, sm: 24 } }} />
            )}
          </IconButton>
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              list: {
                'aria-labelledby': 'account-button'
              }
            }}
          >
            <MenuItem disabled>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start'
                }}
              >
                <Typography variant="body2" sx={{
                  fontWeight: "bold"
                }}>
                  {user.name}
                </Typography>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  {user.email}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => window.top?.location && (window.top.location.href = `${config.SHELL_FRONT_URL}/account`)}>
              <Person fontSize="small" sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={() => window.top?.location && (window.top.location.href = `${config.SHELL_FRONT_URL}/groups`)}>
              <Groups fontSize="small" sx={{ mr: 1 }} />
              Groups
            </MenuItem>
            <MenuItem onClick={() => window.top?.location && (window.top.location.href = `${config.SHELL_FRONT_URL}/payments`)}>
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
      <LoginButton onClick={handleLogin} />
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
      elevation={0}
      sx={{
        background: 'transparent',
        color: '#222',
        boxShadow: 'none',
        borderBottom: '1px solid rgba(0,0,0,0.1)'
      }}
    >
      <Toolbar>
        {isMobile ? (
          <>
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minHeight: 56, pl: { xs: 2, sm: 4 } }}>
              <Button
                color="inherit"
                onClick={handleMobileMenuOpen}
                endIcon={<ExpandMoreIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                sx={{
                  fontWeight: 500,
                  textTransform: 'none',
                  background: 'none',
                  px: { xs: 0.5, sm: 1.5 },
                  py: { xs: 0.5, sm: 1 },
                  minWidth: 0,
                  borderRadius: 2,
                  '&:hover': { background: 'rgba(0,0,0,0.04)' },
                  maxWidth: { xs: '50vw', sm: '70vw' },
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  ml: { xs: 1, sm: 2 }, // push menu button slightly right
                  fontSize: { xs: '0.875rem', sm: '1rem' }
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
            
            {/* Mobile Tenant Selector */}
            {isAuthenticated && user && (
              <Box sx={{ mx: { xs: 1, sm: 1.5 }, flexShrink: 0 }}>
                <TenantSelector
                  selectedTenant={selectedTenant}
                  tenants={availableTenants}
                  onTenantChange={setSelectedTenant}
                  loading={tenantsLoading}
                  error={tenantsError}
                  sx={{ 
                    minWidth: { xs: 80, sm: 120 },
                    '& .MuiSelect-select': {
                      fontSize: { xs: '0.7rem', sm: '0.875rem' },
                      padding: { xs: '2px 6px', sm: '6px 12px' }
                    }
                  }}
                />
              </Box>
            )}
            
            <Box sx={{ flexGrow: 0, ml: { xs: 1, sm: 2 } }}>{renderAuthSection()}</Box>
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
                      navigate(item.path);
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
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%', 
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
            
            {/* Right side content - tenant selector and auth */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: { xs: 1, sm: 2 }
            }}>
              {/* Tenant Selector */}
              {isAuthenticated && user && (
                <TenantSelector
                  selectedTenant={selectedTenant}
                  tenants={availableTenants}
                  onTenantChange={setSelectedTenant}
                  loading={tenantsLoading}
                  error={tenantsError}
                />
              )}
              
              {renderAuthSection()}
            </Box>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AuthHeader;
