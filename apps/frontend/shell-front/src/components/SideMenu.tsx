import React, { cloneElement, useState } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Tooltip from "@mui/material/Tooltip";
import HomeIcon from "@mui/icons-material/Home";
import MenuIcon from "@mui/icons-material/Menu";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

export interface AppLink {
  name: string;
  url: string;
  icon: React.ReactElement;
}

export { SideMenu };

function SideMenu({ appLinks, onLinkClick, currentRoute, routeToUrl }: {
  appLinks: AppLink[];
  onLinkClick?: (url: string) => void;
  currentRoute?: string;
  routeToUrl?: Record<string, string>;
}) {
  const homeUrl = "/";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const isCurrent = (url: string) => {
    if (currentRoute && routeToUrl) {
      return routeToUrl[currentRoute] === url;
    }
    return false;
  };

  // Drawer content as a function for reuse
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
      <Tooltip key="Home" title="Home" placement="right" arrow>
        <ListItem disablePadding>
          <ListItemButton
            component="a"
            href={homeUrl}
            disabled={isCurrent(homeUrl)}
            sx={{ justifyContent: "center", minHeight: 56 }}
            onClick={() => isMobile && setMobileOpen(false)}
          >
            <ListItemIcon
              sx={{
                color: "inherit",
                minWidth: 0,
                justifyContent: "center",
              }}
            >
              <HomeIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
      </Tooltip>
      {appLinks.map((link: AppLink) => {
        const current = isCurrent(link.url);
        let iconColor = undefined;
        if (current) {
          if (link.name.toLowerCase().includes("relationship")) iconColor = "#ef4444";
          else if (link.name.toLowerCase().includes("album")) iconColor = "#3b82f6";
          else if (link.name.toLowerCase().includes("finance") || link.name.toLowerCase().includes("money")) iconColor = "#22c55e";
        }
        const icon = current && iconColor
          ? cloneElement(link.icon as React.ReactElement<any>, { sx: { ...((link.icon as React.ReactElement<any>).props.sx || {}), color: iconColor } })
          : link.icon;
        return (
          <Tooltip key={link.name} title={link.name} placement="right" arrow>
            <ListItem disablePadding>
              {onLinkClick ? (
                <ListItemButton
                  onClick={() => {
                    if (!current) onLinkClick(link.url);
                    if (isMobile) setMobileOpen(false);
                  }}
                  disabled={current}
                  sx={{
                    justifyContent: "center",
                    minHeight: 56,
                    color: current ? "#fff" : undefined,
                    borderRadius: current ? "12px" : undefined,
                    boxShadow: current ? "0 2px 8px 0 #6366f133" : undefined,
                    fontWeight: current ? 700 : undefined,
                    transition: "all 0.2s",
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: current ? iconColor : undefined,
                      minWidth: 0,
                      justifyContent: "center",
                    }}
                  >
                    {icon}
                  </ListItemIcon>
                </ListItemButton>
              ) : (
                <ListItemButton
                  component="a"
                  href={link.url}
                  disabled={current}
                  sx={{
                    justifyContent: "center",
                    minHeight: 56,
                    color: current ? "#fff" : undefined,
                    borderRadius: current ? "12px" : undefined,
                    boxShadow: current ? "0 2px 8px 0 #6366f133" : undefined,
                    fontWeight: current ? 700 : undefined,
                    transition: "all 0.2s",
                  }}
                  onClick={() => isMobile && setMobileOpen(false)}
                >
                  <ListItemIcon
                    sx={{
                      color: current ? iconColor : undefined,
                      minWidth: 0,
                      justifyContent: "center",
                    }}
                  >
                    {icon}
                  </ListItemIcon>
                </ListItemButton>
              )}
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
