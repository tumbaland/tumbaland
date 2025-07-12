import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';

interface CollageMenuProps {
  onSave: () => void;
  disabled?: boolean;
}

const CollageMenu: React.FC<CollageMenuProps> = ({ onSave, disabled }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleSave = () => {
    onSave();
    handleMenuClose();
  };

  return (
    <>
      <IconButton color="primary" onClick={handleMenuOpen} disabled={disabled} size="large">
        <AddIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
        <MenuItem onClick={handleSave} disabled={disabled}>
          <ListItemIcon>
            <SaveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Save Collage" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default CollageMenu;
