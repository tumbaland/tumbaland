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
        size="small" // Changed from "large" to "small" for more compact mobile layout
        aria-label="notifications"
        color="inherit"
        sx={{
          position: 'relative',
          mr: { xs: 0.5, sm: marginRight }, // Reduced margin on mobile
          padding: { xs: 0.5, sm: 1 }, // Explicit padding control for mobile
          '&::after': notificationCount > 0 ? {
            content: '""',
            position: 'absolute',
            top: { xs: 6, sm: 8 }, // Adjusted notification dot position for smaller button
            right: { xs: 6, sm: 8 },
            width: { xs: 6, sm: 8 }, // Smaller notification dot on mobile
            height: { xs: 6, sm: 8 },
            borderRadius: '50%',
            backgroundColor: 'error.main',
            border: '2px solid',
            borderColor: 'background.paper'
          } : undefined
        }}
      >
        <Notifications sx={{ fontSize: { xs: 20, sm: 24 } }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {notificationCount > 0 ? (
          // Show actual notifications when available
          (<MenuItem disabled>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              You have {notificationCount} new notification{notificationCount !== 1 ? 's' : ''}
            </Typography>
          </MenuItem>)
        ) : (
          // Show placeholder when no notifications
          (<MenuItem disabled>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              No new notifications
            </Typography>
          </MenuItem>)
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