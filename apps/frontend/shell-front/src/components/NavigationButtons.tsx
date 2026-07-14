import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, IconButton } from '@mui/material';

export interface NavigationItem {
  key: string;
  label: string;
  route: string;
  icon: React.ElementType;
}

interface NavigationButtonsProps {
  items: NavigationItem[];
  currentRoute?: string;
  variant?: 'buttons' | 'icons'; // buttons for desktop, icons for mobile
  onRouteChange?: (route: string) => void;
}

export function NavigationButtons({
  items,
  currentRoute,
  variant = 'buttons',
  onRouteChange
}: NavigationButtonsProps) {
  const navigate = useNavigate();

  const isActiveRoute = (route: string) => currentRoute === route;

  const handleNavigation = (item: NavigationItem) => {
    navigate(item.route);
    onRouteChange?.(item.route);
  };

  if (variant === 'icons') {
    // Mobile: Icon buttons
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {items.map((item) => {
          const IconComponent = item.icon;
          return (
            <IconButton
              key={item.key}
              aria-label={item.label}
              color={isActiveRoute(item.route) ? 'primary' : 'inherit'}
              onClick={() => handleNavigation(item)}
              size="large"
            >
              <IconComponent />
            </IconButton>
          );
        })}
      </Box>
    );
  }

  // Desktop: Text buttons
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {items.map((item) => {
        const IconComponent = item.icon;
        return (
          <Button
            key={item.key}
            color={isActiveRoute(item.route) ? 'primary' : 'inherit'}
            onClick={() => handleNavigation(item)}
            startIcon={<IconComponent />}
            sx={{ textTransform: 'none' }}
          >
            {item.label}
          </Button>
        );
      })}
    </Box>
  );
}
