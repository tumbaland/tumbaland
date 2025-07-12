
import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import PaletteIcon from '@mui/icons-material/Palette';

interface CollageMenuProps {
  onSave: () => void;
  disabled?: boolean;
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
}

const CollageMenu: React.FC<CollageMenuProps> = ({ onSave, disabled, backgroundColor = '#111', onBackgroundColorChange }) => {
  const [colorAnchorEl, setColorAnchorEl] = useState<null | HTMLElement>(null);
  const [color, setColor] = useState(backgroundColor);
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
    if (onBackgroundColorChange) onBackgroundColorChange(e.target.value);
  };
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
        <MenuItem disabled={disabled}>
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Background Color" />
          <Box component="input" type="color" value={color} onChange={handleColorChange} sx={{ ml: 2, border: 0, background: 'none', width: 32, height: 32, p: 0, minWidth: 0 }} />
        </MenuItem>
      </Menu>
    </>
  );
};

export default CollageMenu;
