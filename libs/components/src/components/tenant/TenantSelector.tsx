import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip
} from '@mui/material';
import {
  PersonOutlined,
  Groups,
  ExpandMore,
  Check
} from '@mui/icons-material';

export interface TenantOption {
  id: string;
  name: string;
  type: 'personal' | 'group';
  isSelected?: boolean;
}

export interface TenantSelectorProps {
  /** Current selected tenant */
  selectedTenant: TenantOption | null;
  /** Available tenant options */
  tenants: TenantOption[];
  /** Callback when tenant is selected */
  onTenantChange: (tenant: TenantOption) => void;
  /** Loading state for fetching tenants */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Custom styling */
  sx?: any;
}

const TenantSelector: React.FC<TenantSelectorProps> = ({
  selectedTenant,
  tenants = [],
  onTenantChange,
  loading = false,
  error = null,
  sx = {}
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isOpen = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTenantSelect = (tenant: TenantOption) => {
    onTenantChange(tenant);
    handleClose();
  };

  const getDisplayName = (tenant: TenantOption | null) => {
    if (!tenant) return 'Select Context';
    return tenant.type === 'personal' ? 'Personal' : tenant.name;
  };

  const getIcon = (type: 'personal' | 'group') => {
    return type === 'personal' ? <PersonOutlined fontSize="small" /> : <Groups fontSize="small" />;
  };

  if (error) {
    return (
      <Chip 
        label="Error loading contexts" 
        color="error" 
        size="small" 
        sx={{ ...sx }} 
      />
    );
  }

  return (
    <Box sx={{ ...sx }}>
      <Button
        onClick={handleClick}
        disabled={loading || tenants.length === 0}
        endIcon={<ExpandMore />}
        startIcon={selectedTenant ? getIcon(selectedTenant.type) : <PersonOutlined fontSize="small" />}
        sx={{
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 2,
          px: 2,
          py: 0.5,
          minWidth: 140,
          justifyContent: 'flex-start',
          color: 'text.primary',
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'action.hover'
          }
        }}
      >
        <Box sx={{ flexGrow: 1, textAlign: 'left', overflow: 'hidden' }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: 'block',
              fontSize: 10
            }}>
            Context
          </Typography>
          <Typography variant="body2" sx={{ 
            display: 'block', 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            maxWidth: 100
          }}>
            {loading ? 'Loading...' : getDisplayName(selectedTenant)}
          </Typography>
        </Box>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem disabled>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: 600
            }}>
            SELECT CONTEXT
          </Typography>
        </MenuItem>
        <Divider />
        
        {tenants.map((tenant) => {
          const isSelected = selectedTenant?.id === tenant.id;
          return (
            <MenuItem
              key={tenant.id}
              onClick={() => handleTenantSelect(tenant)}
              selected={isSelected}
              sx={{
                py: 1.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.50'
                }
              }}
            >
              <ListItemIcon>
                {getIcon(tenant.type)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {tenant.type === 'personal' ? 'Personal' : tenant.name}
                    </Typography>
                    {isSelected && <Check fontSize="small" color="primary" />}
                  </Box>
                }
                secondary={
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    {tenant.type === 'personal' ? 'Your personal data' : 'Group workspace'}
                  </Typography>
                }
              />
            </MenuItem>
          );
        })}

        {tenants.length === 0 && !loading && (
          <MenuItem disabled>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>
                  No contexts available
                </Typography>
              }
            />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default TenantSelector;
