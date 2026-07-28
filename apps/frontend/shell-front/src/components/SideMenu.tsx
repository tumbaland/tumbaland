import { useState } from 'react';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { APPS, isRouteActive } from '../config/apps';
import { AppConfigItem } from '../config/apps';

interface SideMenuProps {
  currentRoute?: string;
}

export function SideMenu({ currentRoute }: SideMenuProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleAppClick = (app: AppConfigItem) => {
    if (app.external) {
      window.open(app.route, '_blank');
    } else {
      navigate(app.route);
    }
    if (isMobile) setMobileOpen(false);
  };

  const isActive = (route: string) => (route === '/' ? currentRoute === '/' : isRouteActive(route, currentRoute));

  // Custom permanent side menu for desktop
  const sideMenuContent = (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pt: 9,
        zIndex: 1,
        background: 'rgba(255,255,255,0.4)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        borderRight: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 2px 8px 0 rgba(99, 102, 241, 0.05)'
      }}
    >
      <List sx={{ width: '100%', p: 0 }}>
        {APPS.map((app) => {
          const IconComponent = app.icon;
          const active = isActive(app.route);
          return (
            <Tooltip key={app.name} title={app.name} placement="right" arrow>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleAppClick(app)}
                  sx={{
                    justifyContent: 'center',
                    minHeight: 56,
                    backgroundColor: 'transparent',
                    color: '#334155'
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: active ? app.color : '#334155',
                      minWidth: 0,
                      justifyContent: 'center',
                      background: 'transparent',
                      p: 0.5,
                      borderRadius: '50%',
                      transition: 'background 0.2s, color 0.2s',
                      '&:hover': {
                        background: 'rgba(255,255,255,0.12)'
                      }
                    }}
                  >
                    <IconComponent />
                  </ListItemIcon>
                </ListItemButton>
              </ListItem>
            </Tooltip>
          );
        })}
      </List>
    </Box>
  );

  // Mobile: show burger icon and custom drawer
  if (isMobile) {
    return (
      <>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => setMobileOpen((open) => !open)}
          sx={{ position: 'fixed', top: 8, left: 8, zIndex: 2001 }}
        >
          <MenuIcon />
        </IconButton>
        {/* Overlay for closing drawer by clicking outside */}
        {mobileOpen && (
          <Box
            onClick={() => setMobileOpen(false)}
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 1999,
              background: 'transparent'
            }}
          />
        )}
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 60,
            height: '100vh',
            background: mobileOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
            backdropFilter: mobileOpen ? 'blur(12px) saturate(180%)' : 'none',
            WebkitBackdropFilter: mobileOpen ? 'blur(12px) saturate(180%)' : 'none',
            borderRight: mobileOpen ? '1.5px solid rgba(255,255,255,0.18)' : 'none',
            boxShadow: mobileOpen ? '0 2px 8px 0 #6366f111' : 'none',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pt: 9,
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition:
              'transform 0.35s cubic-bezier(0.4,0,0.2,1), background 0.2s, box-shadow 0.2s, border-right 0.2s, backdrop-filter 0.2s',
            pointerEvents: mobileOpen ? 'auto' : 'none'
          }}
        >
          <List sx={{ width: '100%', p: 0 }}>
            {APPS.map((app) => {
              const IconComponent = app.icon;
              const active = isActive(app.route);
              return (
                <Tooltip key={app.name} title={app.name} placement="right" arrow>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAppClick(app);
                      }}
                      sx={{
                        justifyContent: 'center',
                        minHeight: 56,
                        backgroundColor: 'transparent',
                        color: '#fff'
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color: active ? app.color : '#334155',
                          minWidth: 0,
                          justifyContent: 'center',
                          background: 'transparent',
                          p: 0.5,
                          borderRadius: '50%',
                          transition: 'background 0.2s, color 0.2s',
                          '&:hover': {
                            background: 'rgba(255,255,255,0.12)'
                          }
                        }}
                      >
                        <IconComponent />
                      </ListItemIcon>
                    </ListItemButton>
                  </ListItem>
                </Tooltip>
              );
            })}
          </List>
        </Box>
      </>
    );
  }

  // Desktop: show permanent side menu
  return sideMenuContent;
}
