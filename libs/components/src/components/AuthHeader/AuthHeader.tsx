import React, { useState } from 'react';
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
import { useTheme, SxProps, Theme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AccountCircle, Logout, Person, Groups, Payment } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router';
import { NotificationsMenu } from '../NotificationsMenu/NotificationsMenu';
import { LoginButton } from '../LoginButton';

export interface AuthHeaderUser {
  name: string;
  email: string;
  picture?: string;
}

export interface AuthHeaderNavigationItem {
  label: string;
  path: string;
  icon?: React.ElementType;
}

export interface AuthHeaderTenantOption {
  id: string;
  name: string;
  type: 'personal' | 'group';
  isSelected?: boolean;
}

export interface AuthHeaderTenantSelectorProps {
  selectedTenant: AuthHeaderTenantOption | null;
  tenants: AuthHeaderTenantOption[];
  onTenantChange: (tenant: AuthHeaderTenantOption) => void;
  loading?: boolean;
  error?: string | null;
  sx?: SxProps<Theme>;
}

export interface AuthHeaderProps {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthHeaderUser | null;
  onLogin: () => void;
  onLogout: () => void | Promise<void>;
  navigationItems: AuthHeaderNavigationItem[];
  /** Base URL of the shell app; account menu links (Profile/Groups/Billing) are built from it. */
  shellFrontUrl?: string;
  /**
   * Each consuming frontend already owns a byte-identical TenantSelector (backed by its own
   * useTenant hook, localStorage, and group-API fetch). Moving that into this package is out of
   * scope for this extraction, so it's injected here rather than imported directly.
   */
  TenantSelectorComponent: React.ComponentType<AuthHeaderTenantSelectorProps>;
  selectedTenant: AuthHeaderTenantOption | null;
  availableTenants: AuthHeaderTenantOption[];
  tenantsLoading?: boolean;
  tenantsError?: string | null;
  onTenantChange: (tenant: AuthHeaderTenantOption) => void;
  /** Placeholder until real notification counts are wired up per app. */
  notificationCount?: number;
  /**
   * Running inside the shell's iframe. The shell's navigation already carries
   * the account menu and sign-out there, so this header keeps to the app's own
   * sections and group picker instead of drawing a second set. Read from the
   * frame's URL when not given.
   */
  embedded?: boolean;
}

// A nav item's path of '/' would match every route via startsWith, so it needs an exact-match
// special case; every other item is matched by prefix so nested routes (e.g. album-front's
// /albums/:albumId) still highlight their parent nav entry.
function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/') {
    return pathname === '/';
  }
  return pathname.startsWith(itemPath);
}

export function AuthHeader({
  isLoading,
  isAuthenticated,
  user,
  onLogin,
  onLogout,
  navigationItems,
  shellFrontUrl,
  TenantSelectorComponent,
  selectedTenant,
  availableTenants,
  tenantsLoading = false,
  tenantsError = null,
  onTenantChange,
  notificationCount = 0,
  embedded
}: AuthHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Nothing infers this any more: the iframe flag it used to fall back on was
  // set by the shell's frame `src`, and there is no frame. A caller that wants
  // the header's own account menu hidden says so.
  const isEmbedded = embedded ?? false;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => setNotificationAnchorEl(event.currentTarget);
  const handleNotificationClose = () => setNotificationAnchorEl(null);
  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => setMobileMenuAnchor(event.currentTarget);
  const handleMobileMenuClose = () => setMobileMenuAnchor(null);

  const handleLogout = async () => {
    await onLogout();
    handleMenuClose();
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
            notificationCount={notificationCount}
          />
          <IconButton
            onClick={handleMenuOpen}
            size="small"
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
                  fontWeight: 'bold'
                }}>
                  {user.name}
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'text.secondary'
                }}>
                  {user.email}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => window.top?.location && (window.top.location.href = `${shellFrontUrl}/account`)}>
              <Person fontSize="small" sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={() => window.top?.location && (window.top.location.href = `${shellFrontUrl}/groups`)}>
              <Groups fontSize="small" sx={{ mr: 1 }} />
              Groups
            </MenuItem>
            <MenuItem onClick={() => window.top?.location && (window.top.location.href = `${shellFrontUrl}/payments`)}>
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

    return <LoginButton onClick={onLogin} />;
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
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minHeight: 56, minWidth: 0 }}>
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
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }}
              >
                {/* Show current route label, fallback to first menu item */}
                {(() => {
                  let bestMatch: AuthHeaderNavigationItem | null = null;
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
                <TenantSelectorComponent
                  selectedTenant={selectedTenant}
                  tenants={availableTenants}
                  onTenantChange={onTenantChange}
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

            {!isEmbedded && <Box sx={{ flexGrow: 0, ml: { xs: 1, sm: 2 } }}>{renderAuthSection()}</Box>}
            <Menu
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={handleMobileMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(location.pathname, item.path);
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
                const isActive = isNavItemActive(location.pathname, item.path);
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
                <TenantSelectorComponent
                  selectedTenant={selectedTenant}
                  tenants={availableTenants}
                  onTenantChange={onTenantChange}
                  loading={tenantsLoading}
                  error={tenantsError}
                />
              )}

              {!isEmbedded && renderAuthSection()}
            </Box>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
