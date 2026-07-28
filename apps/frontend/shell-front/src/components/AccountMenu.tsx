import React from 'react';
import { useNavigate } from 'react-router';
import {
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Box
} from '@mui/material';
import { AccountCircle, Logout } from '@mui/icons-material';
import { User } from '../types';

interface AccountMenuProps {
  user: User | null;
  anchorEl: HTMLElement | null;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onLogout: () => void;
  navigationItems?: Array<{
    key: string;
    label: string;
    route: string;
    icon: React.ElementType;
  }>;
}

export function AccountMenu({
  user,
  anchorEl,
  onMenuOpen,
  onMenuClose,
  onLogout,
  navigationItems = []
}: AccountMenuProps) {
  const navigate = useNavigate();

  const handleNavigation = (route: string) => {
    navigate(route);
    onMenuClose();
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <IconButton
        onClick={onMenuOpen}
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
        onClose={onMenuClose}
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

        {/* Navigation items */}
        {navigationItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <MenuItem key={item.key} onClick={() => handleNavigation(item.route)}>
              <IconComponent fontSize="small" sx={{ mr: 1 }} />
              {item.label}
            </MenuItem>
          );
        })}

        {/* Add divider if there are navigation items */}
        {navigationItems.length > 0 && <Divider />}

        <MenuItem onClick={onLogout}>
          <Logout fontSize="small" sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </>
  );
}
