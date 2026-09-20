import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import type { AppConfigItem } from '../config/apps';
import { ink } from '@tumbaland/frontend-core';

interface ModuleMenuProps {
  app: AppConfigItem;
  currentRoute: string;
}

export function getModuleMenu(app: AppConfigItem | undefined, currentRoute: string) {
  return app?.menu ? <ModuleMenu app={app} currentRoute={currentRoute} /> : <Box sx={{ flex: 1 }} />;
}

function ModuleMenu({ app, currentRoute }: ModuleMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const activeItem = app.menu?.find(({ route }) => currentRoute === route || currentRoute.startsWith(`${route}/`));
  const ActiveIcon = activeItem?.icon;

  return (
    <Box component="nav" aria-label={`${app.name} menu`} sx={{ flex: 1, minWidth: 0 }}>
      <Button
        aria-label={`${app.name} menu`}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        endIcon={<ExpandMoreIcon />}
        startIcon={ActiveIcon ? <ActiveIcon /> : undefined}
        sx={{
          maxWidth: '100%',
          minWidth: 0,
          textTransform: 'none',
          color: ink.strong,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { flexShrink: 0 },
          '& .MuiButton-endIcon': { flexShrink: 0 }
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeItem?.label ?? app.name}
        </Box>
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {app.menu?.map(({ label, route, icon: Icon }) => {
          const active = currentRoute === route || currentRoute.startsWith(`${route}/`);
          return (
            <MenuItem
              key={route}
              component={Link}
              to={route}
              selected={active}
              aria-current={active ? 'page' : undefined}
              onClick={() => setAnchorEl(null)}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
