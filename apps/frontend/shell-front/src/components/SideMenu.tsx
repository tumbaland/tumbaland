import React, { cloneElement } from "react";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Tooltip from "@mui/material/Tooltip";
import HomeIcon from "@mui/icons-material/Home";

export interface AppLink {
  name: string;
  url: string;
  icon: React.ReactElement;
}

interface SideMenuProps {
  appLinks: AppLink[];
  onLinkClick?: (url: string) => void;
  currentRoute?: string;
  routeToUrl?: Record<string, string>;
}

export function SideMenu({ appLinks, onLinkClick, currentRoute, routeToUrl }: SideMenuProps) {
  // Use env variable for home URL, fallback to '/'
  const homeUrl = import.meta.env.VITE_HOME_URL || "/";

  // Helper to check if a link is current using routeToUrl and currentRoute
  const isCurrent = (url: string) => {
    if (currentRoute && routeToUrl) {
      return routeToUrl[currentRoute] === url;
    }
    return false;
  };

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        width: 80,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 80,
          boxSizing: "border-box",
          background: "#fff",
          color: "#222",
          borderRight: "1px solid #e0e0e0",
        },
      }}
    >
      <List sx={{ mt: 2 }}>
        <Tooltip key="Home" title="Home" placement="right" arrow>
          <ListItem disablePadding>
            <ListItemButton
              component="a"
              href={homeUrl}
              disabled={isCurrent(homeUrl)}
              sx={{ justifyContent: "center", minHeight: 56 }}
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
        {appLinks.map((link) => {
          const current = isCurrent(link.url);
          // Set icon color by app name if current
          let iconColor = undefined;
          if (current) {
            if (link.name.toLowerCase().includes("relationship")) iconColor = "#ef4444"; // red
            else if (link.name.toLowerCase().includes("album")) iconColor = "#3b82f6"; // blue
            else if (link.name.toLowerCase().includes("finance") || link.name.toLowerCase().includes("money")) iconColor = "#22c55e"; // green
          }
          // Clone icon with color override if current
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
    </Drawer>
  );
}
