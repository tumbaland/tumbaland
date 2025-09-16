import React from 'react';
import { IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { Notifications } from '@mui/icons-material';

export interface NotificationsMenuProps {
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  notificationCount?: number;
  marginRight?: number;
}

export function NotificationsMenu({
  onClick,
  anchorEl,
  onClose,
  notificationCount = 0,
  marginRight = 1
}: NotificationsMenuProps) {
  return (
    <>
      <IconButton
        onClick={onClick}
        size="large"
        aria-label="notifications"
        color="inherit"
        sx={{
          position: 'relative',
          mr: marginRight,
          '&::after': notificationCount > 0 ? {
            content: '""',
            position: 'absolute',
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'error.main',
            border: '2px solid',
            borderColor: 'background.paper'
          } : undefined
        }}
      >
        <Notifications />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { minWidth: 300 }
        }}
      >
        {notificationCount > 0 ? (
          // Show actual notifications when available
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              You have {notificationCount} new notification{notificationCount !== 1 ? 's' : ''}
            </Typography>
          </MenuItem>
        ) : (
          // Show placeholder when no notifications
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No new notifications
            </Typography>
          </MenuItem>
        )}

        {/* Future: Add actual notification items here */}
        {/* <Divider />
        <MenuItem onClick={onClose}>
          <Typography variant="body2">View all notifications</Typography>
        </MenuItem> */}
      </Menu>
    </>
  );
}