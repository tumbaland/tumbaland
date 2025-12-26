import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Box, Switch } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import PaletteIcon from '@mui/icons-material/Palette';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import OpacityIcon from '@mui/icons-material/Opacity';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import { Tooltip } from '@mui/material';

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

  return (
    <Box display="flex" gap={1}>
      <Tooltip title="Collage Settings">
        <IconButton 
          onClick={handleMenuOpen} 
          disabled={disabled}
          size="small"
          sx={{ 
            color: 'text.secondary',
            opacity: 0.5,
            '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.2)' }
          }}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu 
        anchorEl={anchorEl} 
        open={open} 
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1.5,
            borderRadius: 2,
            minWidth: 250,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { onSave(); handleMenuClose(); }} disabled={disabled}>
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
            sx={{ 
              ml: 2, 
              border: '1px solid #ddd', 
              borderRadius: 1,
              width: 32, 
              height: 32, 
              p: 0.5, 
              cursor: 'pointer'
            }}
          />
        </MenuItem>
        
        <MenuItem disabled={disabled}>
          <ListItemIcon>
            <BorderColorIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Frame Color" />
          <Box
            component="input"
            type="color"
            value={border}
            onChange={handleBorderColorChange}
            sx={{ 
              ml: 2, 
              border: '1px solid #ddd', 
              borderRadius: 1,
              width: 32, 
              height: 32, 
              p: 0.5, 
              cursor: 'pointer'
            }}
          />
        </MenuItem>
        
        <MenuItem 
          onClick={() => onPhotoTransparencyModeChange && onPhotoTransparencyModeChange(!photoTransparencyMode)}
          disabled={disabled}
        >
          <ListItemIcon>
            <OpacityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Photo Frames" />
          <Switch
            checked={!photoTransparencyMode}
            size="small"
            sx={{ ml: 1 }}
          />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default CollageMenu;
