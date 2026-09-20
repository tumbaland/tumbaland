import React, { useState } from 'react';
import { Box, Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography, Chip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { PersonOutlined, Groups, ExpandMore, Check } from '@mui/icons-material';
import { brand, ink, surface, TOUCH_TARGET } from '../../theme/tokens';

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
  /** Drops the "Viewing" caption and tightens the button, for a phone's bar. */
  compact?: boolean;
  /** Custom styling */
  sx?: SxProps<Theme>;
}

/**
 * Whose data the page is showing: the person's own, or one of their groups.
 *
 * Drawn as the same rounded pill the section bar beside it uses, in the brand
 * violet rather than MUI's default blue, so the one control that changes what
 * every module shows reads as part of the chrome instead of a stray form field.
 */
const TenantSelector: React.FC<TenantSelectorProps> = ({
  selectedTenant,
  tenants = [],
  onTenantChange,
  loading = false,
  error = null,
  compact = false,
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
    if (!tenant) return 'Choose context';
    return tenant.type === 'personal' ? 'Personal' : tenant.name;
  };

  const getIcon = (type: 'personal' | 'group') => {
    return type === 'personal' ? <PersonOutlined fontSize="small" /> : <Groups fontSize="small" />;
  };

  if (error) {
    return <Chip label="Error loading contexts" color="error" size="small" sx={{ ...sx }} />;
  }

  return (
    <Box sx={{ ...sx }}>
      <Button
        onClick={handleClick}
        disabled={loading || tenants.length === 0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        endIcon={<ExpandMore />}
        startIcon={selectedTenant ? getIcon(selectedTenant.type) : <PersonOutlined fontSize="small" />}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 999,
          px: compact ? 1.25 : 1.75,
          minHeight: compact ? 38 : TOUCH_TARGET,
          minWidth: 0,
          justifyContent: 'flex-start',
          color: ink.strong,
          backgroundColor: surface.paper,
          border: `1px solid ${surface.divider}`,
          transition: 'border-color .2s ease, box-shadow .2s ease',
          '& .MuiButton-startIcon': { color: brand.violetInk, flexShrink: 0 },
          '& .MuiButton-endIcon': { color: ink.muted, flexShrink: 0 },
          '&:hover': {
            backgroundColor: surface.paper,
            borderColor: `${brand.violetInk}66`,
            boxShadow: `0 8px 20px -14px ${brand.violetInk}`
          },
          '&.Mui-disabled': { color: ink.muted, border: `1px solid ${surface.divider}` }
        }}
      >
        <Box sx={{ flexGrow: 1, textAlign: 'left', overflow: 'hidden' }}>
          {!compact && (
            <Typography
              variant="caption"
              sx={{ color: ink.muted, display: 'block', fontSize: 10, letterSpacing: 0.4, lineHeight: 1.2 }}
            >
              Viewing
            </Typography>
          )}
          <Typography
            variant="body2"
            sx={{
              display: 'block',
              fontWeight: 600,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {loading ? 'Loading...' : getDisplayName(selectedTenant)}
          </Typography>
        </Box>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 248,
              borderRadius: 3,
              border: `1px solid ${surface.divider}`,
              boxShadow: '0 18px 40px -24px rgba(88,28,135,0.5)'
            }
          }
        }}
      >
        <MenuItem disabled sx={{ '&.Mui-disabled': { opacity: 1 } }}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 700, letterSpacing: 0.4 }}>
            Switch to
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
                mx: 0.5,
                py: 1.25,
                borderRadius: 2,
                minHeight: TOUCH_TARGET,
                color: isSelected ? brand.violetInk : ink.body,
                '&.Mui-selected': { backgroundColor: `${brand.violetInk}14`, color: brand.violetInk },
                '&.Mui-selected:hover': { backgroundColor: `${brand.violetInk}20` },
                '&:hover': { backgroundColor: surface.sunken }
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{getIcon(tenant.type)}</ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: isSelected ? 700 : 500 }}>
                      {tenant.type === 'personal' ? 'Personal' : tenant.name}
                    </Typography>
                    {isSelected && <Check fontSize="small" sx={{ color: 'inherit' }} />}
                  </Box>
                }
                secondary={
                  <Typography variant="caption" sx={{ color: ink.muted }}>
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
                <Typography variant="body2" sx={{ color: ink.muted }}>
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
