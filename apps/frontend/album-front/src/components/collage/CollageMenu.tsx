import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Box, Switch } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import PaletteIcon from '@mui/icons-material/Palette';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import OpacityIcon from '@mui/icons-material/Opacity';
import BorderColorIcon from '@mui/icons-material/BorderColor';

interface CollageMenuProps {
  onSave: () => void;
  disabled?: boolean;
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
  onAddTextBox?: () => void;
  photoTransparencyMode?: boolean;
  onPhotoTransparencyModeChange?: (transparent: boolean) => void;
  borderColor?: string;
  onBorderColorChange?: (color: string) => void;
}

const CollageMenu: React.FC<CollageMenuProps> = ({
  onSave,
  disabled,
  backgroundColor = '#111',
  onBackgroundColorChange,
  onAddTextBox,
  photoTransparencyMode = true,
  onPhotoTransparencyModeChange,
  borderColor = '#fff',
  onBorderColorChange
}) => {
  const [color, setColor] = useState(backgroundColor);
  const [border, setBorder] = useState(borderColor);

  // Sync color state with prop
  React.useEffect(() => {
    setColor(backgroundColor);
  }, [backgroundColor]);

  // Sync border state with prop
  React.useEffect(() => {
    setBorder(borderColor);
  }, [borderColor]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
    if (onBackgroundColorChange) onBackgroundColorChange(e.target.value);
  };

  const handleBorderColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBorder(e.target.value);
    if (onBorderColorChange) onBorderColorChange(e.target.value);
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
        <MenuItem onClick={onAddTextBox} disabled={disabled}>
          <ListItemIcon>
            <TextFieldsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Add Text Box" />
        </MenuItem>
        <MenuItem disabled={disabled}>
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Background Color" />
          <Box
            component="input"
            type="color"
            value={color}
            onChange={handleColorChange}
            sx={{ ml: 2, border: 0, background: 'none', width: 32, height: 32, p: 0, minWidth: 0 }}
          />
        </MenuItem>
        <MenuItem disabled={disabled}>
          <ListItemIcon>
            <BorderColorIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Border Color" />
          <Box
            component="input"
            type="color"
            value={border}
            onChange={handleBorderColorChange}
            sx={{ ml: 2, border: 0, background: 'none', width: 32, height: 32, p: 0, minWidth: 0 }}
          />
        </MenuItem>
        <MenuItem 
          onClick={() => onPhotoTransparencyModeChange && onPhotoTransparencyModeChange(!photoTransparencyMode)}
          disabled={disabled}
        >
          <ListItemIcon>
            <OpacityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Transparent Photo Backgrounds" />
          <Switch
            checked={photoTransparencyMode}
            size="small"
            sx={{ ml: 1 }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default CollageMenu;
