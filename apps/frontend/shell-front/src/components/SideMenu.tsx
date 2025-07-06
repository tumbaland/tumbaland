import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Tooltip from "@mui/material/Tooltip";
import MenuIcon from "@mui/icons-material/Menu";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { APPS } from '../config/apps';

interface SideMenuProps {
  currentRoute?: string;
}

export function SideMenu({ currentRoute }: SideMenuProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleAppClick = (route: string) => {
    navigate(route);
    if (isMobile) setMobileOpen(false);
  };

  const isActive = (route: string) => currentRoute === route;

  const drawerContent = (
    <Box sx={{
      mt: 9,
      px: 1.5,
      py: 2,
      borderRadius: 3,
      background: '#fff',
      boxShadow: '0 2px 8px 0 #6366f111',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: 0,
    }}>
      <List sx={{ width: '100%', p: 0 }}>
        {APPS.map((app) => {
          const IconComponent = app.icon;
          const active = isActive(app.route);
          
          return (
            <Tooltip key={app.name} title={app.name} placement="right" arrow>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleAppClick(app.route)}
                  disabled={active}
                  sx={{
                    justifyContent: "center",
                    minHeight: 56,
                    backgroundColor: 'transparent',
                    color: active ? app.color : '#334155'
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: 'inherit',
                      minWidth: 0,
                      justifyContent: "center",
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

  if (isMobile) {
    return (
      <>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => setMobileOpen(true)}
          sx={{ position: "fixed", top: 8, left: 8, zIndex: 1301 }}
        >
          <MenuIcon />
        </IconButton>
        <Drawer
          variant="temporary"
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: 56,
              boxSizing: "border-box",
              background: "#fff",
              color: "#222",
              borderRight: "1px solid #e0e0e0",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </>
    );
  }

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        width: 60,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 60,
          boxSizing: "border-box",
          background: "#fff",
          color: "#222",
          borderRight: "1px solid #e0e0e0",
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}