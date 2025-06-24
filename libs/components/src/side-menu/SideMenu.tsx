import React from 'react';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Tooltip from '@mui/material/Tooltip';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HomeIcon from '@mui/icons-material/Home';

const hoverColor = 'rgba(99,102,241,0.10)'; // light indigo tint
const iconColor = '#334155'; // dark gray

export interface AppLink {
  name: string;
  url: string;
  icon: React.ReactElement;
}

interface SideMenuProps {
  appLinks: AppLink[];
}

export function SideMenu({ appLinks }: SideMenuProps) {
  return (
    <Drawer
      variant="permanent"
      PaperProps={{
        sx: {
          width: 72,
          boxSizing: 'border-box',
          background: '#fff',
          boxShadow: '2px 0 24px rgba(99,102,241,0.08)',
          borderRight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 2,
          pb: 2,
          justifyContent: 'space-between',
        },
      }}
    >
      <List sx={{ width: '100%', mt: 0 }}>
        <ListItem disablePadding sx={{ justifyContent: 'center', mb: 2 }}>
          <Tooltip title="Home" placement="right" arrow>
            <ListItemButton
              component="a"
              href="/"
              sx={{
                borderRadius: 2,
                mx: 1,
                py: 2,
                minWidth: 0,
                justifyContent: 'center',
                background: 'transparent',
                '&:hover': {
                  background: hoverColor,
                  color: iconColor,
                  '& .MuiListItemIcon-root': { color: iconColor },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                <HomeIcon sx={{ color: iconColor }} />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        </ListItem>
        {appLinks.map((link: AppLink) => (
          <ListItem key={link.url} disablePadding sx={{ mb: 2, justifyContent: 'center' }}>
            <Tooltip title={link.name} placement="right" arrow>
              <ListItemButton
                component="a"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  py: 2,
                  minWidth: 0,
                  justifyContent: 'center',
                  background: 'transparent',
                  '&:hover': {
                    background: hoverColor,
                    color: iconColor,
                    '& .MuiListItemIcon-root': { color: iconColor },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                  {link.icon}
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
      <List sx={{ width: '100%' }}>
        <ListItem disablePadding sx={{ justifyContent: 'center' }}>
          <Tooltip title="Account" placement="right" arrow>
            <ListItemButton
              sx={{
                borderRadius: 2,
                mx: 1,
                py: 2,
                minWidth: 0,
                justifyContent: 'center',
                background: 'transparent',
                '&:hover': {
                  background: hoverColor,
                  color: iconColor,
                  '& .MuiListItemIcon-root': { color: iconColor },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                <AccountCircleIcon sx={{ color: iconColor }} />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Drawer>
  );
}
