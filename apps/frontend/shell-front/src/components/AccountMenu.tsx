import { Link, useNavigate } from 'react-router';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { getUserApps, isRouteActive } from '../config/apps';
import { authService } from '../services/authService';
import { ink, surface } from '@tumbaland/frontend-core';
import { User } from '../types';
import { NotificationSetting } from './NotificationSetting';
import { AppearanceSetting } from './AppearanceSetting';

interface AccountMenuProps {
  user: User | null;
  /** The Account entry that opened the menu; null while closed. */
  anchorEl: HTMLElement | null;
  currentRoute: string;
  /** A bottom sheet on phones, a popover beside the rail everywhere else. */
  mobile: boolean;
  onClose: () => void;
}

export function AccountMenu({ user, anchorEl, currentRoute, mobile, onClose }: AccountMenuProps) {
  const navigate = useNavigate();
  const open = Boolean(anchorEl);

  // Head for the landing page first: logout() reloads the document on success,
  // and reloading a module route signed out only shows "Access Restricted".
  const handleSignOut = async () => {
    onClose();
    navigate('/');
    await authService.logout();
  };

  // An array rather than a fragment: Menu and MenuList walk their direct
  // children to manage focus.
  const items = [
    <MenuItem key="who" disabled sx={{ gap: 1.5, py: 1.25, '&.Mui-disabled': { opacity: 1 } }}>
      <Avatar src={user?.picture} alt="" sx={{ width: 36, height: 36 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 14.5, fontWeight: 700, color: ink.strong }}>
          {user?.name}
        </Typography>
        <Typography noWrap sx={{ fontSize: 12.5, color: ink.muted }}>
          {user?.email}
        </Typography>
      </Box>
    </MenuItem>,
    <Divider key="account-divider" />,
    ...getUserApps().map((app) => {
      const Icon = app.icon;
      return (
        <MenuItem
          key={app.route}
          component={Link}
          to={app.route}
          selected={isRouteActive(app.route, currentRoute)}
          onClick={onClose}
          sx={{
            borderRadius: 2,
            mx: 0.5,
            color: isRouteActive(app.route, currentRoute) ? app.color : ink.body,
            '&.Mui-selected': { backgroundColor: `${app.color}14`, color: app.color },
            '&.Mui-selected:hover': { backgroundColor: `${app.color}20` },
            '&:hover': { backgroundColor: surface.sunken }
          }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Icon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{app.name}</ListItemText>
        </MenuItem>
      );
    }),
    <Divider key="settings-divider" />,
    <AppearanceSetting key="appearance" />,
    // A control the person operates, not a prompt on load: iOS refuses a
    // permission request without a user gesture, and Chrome holds
    // asking-on-load against the site.
    <NotificationSetting key="notifications" />,
    <Divider key="sign-out-divider" />,
    <MenuItem key="sign-out" onClick={handleSignOut} sx={{ borderRadius: 2, mx: 0.5 }}>
      <ListItemIcon sx={{ color: 'inherit' }}>
        <LogoutIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>Sign out</ListItemText>
    </MenuItem>
  ];

  if (mobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '85dvh',
              pb: 'calc(8px + env(safe-area-inset-bottom))'
            }
          }
        }}
      >
        <Box
          aria-hidden
          sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'text.disabled', mx: 'auto', mt: 1.25 }}
        />
        <MenuList aria-label="Account" autoFocusItem={open}>
          {items}
        </MenuList>
      </Drawer>
    );
  }

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            ml: 1,
            minWidth: 240,
            maxWidth: 320,
            border: `1px solid ${surface.divider}`,
            borderRadius: 3,
            boxShadow: '0 14px 32px -20px rgba(88,28,135,0.45)'
          }
        },
        list: { 'aria-label': 'Account' }
      }}
    >
      {items}
    </Menu>
  );
}

export default AccountMenu;
