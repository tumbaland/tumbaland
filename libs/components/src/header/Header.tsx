import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';

export interface HeaderProps {
  title?: string;
  menuItems?: Array<{
    label: string;
    onClick?: () => void;
  }>;
  onMenuClick?: () => void;
  onAccountClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title = 'App',
  menuItems = [
    { label: 'Dashboard' },
    { label: 'Activities' },
    { label: 'Contacts' }
  ],
  onMenuClick,
  onAccountClick
}) => {
  return (
    <AppBar 
      position="static" 
      sx={{ 
        backgroundColor: 'black',
        margin: 0,
        padding: 0,
        boxShadow: 'none'
      }}
    >
      <Toolbar sx={{ padding: 0 }}>
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
          onClick={onMenuClick}
        >
          <MenuIcon />
        </IconButton>
        
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {menuItems.map((item, index) => (
            <Button 
              key={index} 
              color="inherit" 
              onClick={item.onClick}
            >
              {item.label}
            </Button>
          ))}
          
          <IconButton
            size="large"
            aria-label="account of current user"
            color="inherit"
            onClick={onAccountClick}
          >
            <AccountCircle />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
