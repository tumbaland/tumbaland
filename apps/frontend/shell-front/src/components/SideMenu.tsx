import React from "react";
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
}

export function SideMenu({ appLinks, onLinkClick }: SideMenuProps) {
  // Use env variable for home URL, fallback to '/'
  const homeUrl = "/";
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
        {appLinks.map((link) => (
          <Tooltip key={link.name} title={link.name} placement="right" arrow>
            <ListItem disablePadding>
              {onLinkClick ? (
                <ListItemButton
                  onClick={() => onLinkClick(link.url)}
                  sx={{ justifyContent: "center", minHeight: 56 }}
                >
                  <ListItemIcon
                    sx={{
                      color: "inherit",
                      minWidth: 0,
                      justifyContent: "center",
                    }}
                  >
                    {link.icon}
                  </ListItemIcon>
                </ListItemButton>
              ) : (
                <ListItemButton
                  component="a"
                  href={link.url}
                  sx={{ justifyContent: "center", minHeight: 56 }}
                >
                  <ListItemIcon
                    sx={{
                      color: "inherit",
                      minWidth: 0,
                      justifyContent: "center",
                    }}
                  >
                    {link.icon}
                  </ListItemIcon>
                </ListItemButton>
              )}
            </ListItem>
          </Tooltip>
        ))}
      </List>
    </Drawer>
  );
}
