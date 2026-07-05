import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Person, Groups, Payment } from '@mui/icons-material';
import { authService } from '../services/authService';
import { User } from '../types';
import { NotificationsMenu, LoginButton, logger } from '@tumbaland/components';
import { AccountMenu } from './AccountMenu';
import { NavigationButtons } from './NavigationButtons';

interface HeaderNavProps {
  currentRoute?: string;
}

export function HeaderNav({ currentRoute }: HeaderNavProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { authenticated, user } = await authService.checkAuth();
        setIsAuthenticated(authenticated);
        setUser(user);
      } catch (error) {
        logger.error('Auth check failed', error);
      } finally {
        // Loading complete
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
    await authService.logout();
    handleMenuClose();
  };

  // Define navigation items
  const navigationItems = [
    {
      key: 'account',
      label: 'Account',
      route: '/account',
      icon: Person,
    },
    {
      key: 'groups',
      label: 'Groups',
      route: '/groups',
      icon: Groups,
    },
    {
      key: 'payments',
      label: 'Billing',
      route: '/payments',
      icon: Payment,
    }
  ];

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
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          zIndex: 1000,
          position: 'relative',
          borderBottom: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, pl: 5 }}>
          <NavigationButtons
            items={navigationItems}
            currentRoute={currentRoute}
            variant="icons"
          />
        </Box>

        <Box sx={{ flexGrow: 0 }}>
          {isAuthenticated && user ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsMenu
                onClick={handleNotificationClick}
                anchorEl={notificationAnchorEl}
                onClose={handleNotificationClose}
              />
              <AccountMenu
                user={user}
                anchorEl={anchorEl}
                onMenuOpen={handleMenuOpen}
                onMenuClose={handleMenuClose}
                onLogout={handleLogout}
                navigationItems={navigationItems}
              />
            </Box>
          ) : (
            <LoginButton onClick={handleLogin} />
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: 64,
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        px: 3,
        zIndex: 1000,
        position: 'relative',
        marginLeft: '60px', // Account for fixed sidemenu width
        width: 'calc(100% - 60px)', // Ensure header spans remaining width
        borderBottom: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
        <NavigationButtons
          items={navigationItems}
          currentRoute={currentRoute}
          variant="buttons"
        />
      </Box>

      <Box sx={{ flexGrow: 0 }}>
        {isAuthenticated && user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsMenu
              onClick={handleNotificationClick}
              anchorEl={notificationAnchorEl}
              onClose={handleNotificationClose}
            />
            <AccountMenu
              user={user}
              anchorEl={anchorEl}
              onMenuOpen={handleMenuOpen}
              onMenuClose={handleMenuClose}
              onLogout={handleLogout}
              navigationItems={navigationItems}
            />
          </Box>
        ) : (
          <LoginButton onClick={handleLogin} />
        )}
      </Box>
    </Box>
  );
}
