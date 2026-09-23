import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Brush as BrushIcon,
  Delete as DeleteIcon,
  DriveFileRenameOutline as RenameIcon
} from '@mui/icons-material';
import { Collage } from '../../types/collage';
import { normalizeCollageConfig } from './collageDoc';

interface CollageCardProps {
  collage: Collage;
  onView: (collage: Collage) => void;
  onEdit: (collage: Collage) => void;
  onEditDetails: (collage: Collage) => void;
  onDelete: (collage: Collage) => void;
}

/** Schematic thumbnail: the saved layout drawn as scaled rectangles. */
export const CollagePreview: React.FC<{ collage: Collage }> = ({ collage }) => {
  const doc = useMemo(() => normalizeCollageConfig(collage.config), [collage.config]);
  const { width: vw, height: vh } = doc.canvas;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        bgcolor: doc.background,
        overflow: 'hidden',
        borderTopLeftRadius: 'inherit',
        borderTopRightRadius: 'inherit'
      }}
    >
      {doc.photos.map((p) => (
        <Box
          key={p.id}
          sx={{
            position: 'absolute',
            left: pct(p.x, vw),
            top: pct(p.y, vh),
            width: pct(p.width, vw),
            height: pct(p.height, vh),
            transform: `rotate(${p.rotation || 0}deg)`,
            bgcolor: 'color-mix(in srgb, var(--mui-palette-background-paper) 28%, transparent)',
            border: '1px solid rgba(255,255,255,0.45)',
            borderRadius: '2px'
          }}
        />
      ))}
      {doc.texts.map((t) => (
        <Box
          key={t.id}
          sx={{
            position: 'absolute',
            left: pct(t.x, vw),
            top: pct(t.y + t.height / 2, vh),
            width: pct(t.width, vw),
            height: '2px',
            bgcolor: t.color,
            opacity: 0.85,
            borderRadius: 1
          }}
        />
      ))}
      {doc.photos.length === 0 && doc.texts.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.75rem'
          }}
        >
          Empty collage
        </Box>
      )}
    </Box>
  );
};

const CollageCard: React.FC<CollageCardProps> = ({ collage, onView, onEdit, onEditDetails, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const menuAction = (action: (c: Collage) => void) => () => {
    handleMenuClose();
    action(collage);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 4,
        background: 'color-mix(in srgb, var(--mui-palette-background-paper) 60%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
          background: 'color-mix(in srgb, var(--mui-palette-background-paper) 80%, transparent)'
        }
      }}
      onClick={() => onView(collage)}
    >
      <CollagePreview collage={collage} />
      <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography
            variant="h6"
            component="h2"
            sx={{
              fontWeight: 600,
              fontSize: '1rem',
              lineHeight: 1.3,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1
            }}
          >
            {collage.title}
          </Typography>
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{ mr: -1, color: 'text.secondary', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {collage.config?.title?.subtitle && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {collage.config.title.subtitle}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 1 }}>
          <Chip
            label={`${collage.config?.photos?.length || 0} photos`}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.02)', borderColor: 'rgba(0,0,0,0.08)' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {formatDate(collage.updatedAt)}
          </Typography>
        </Box>
      </CardContent>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        slotProps={{
          paper: {
            sx: { borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 170 }
          }
        }}
      >
        <MenuItem onClick={menuAction(onEdit)}>
          <ListItemIcon>
            <BrushIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open editor</ListItemText>
        </MenuItem>
        <MenuItem onClick={menuAction(onEditDetails)}>
          <ListItemIcon>
            <RenameIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit details</ListItemText>
        </MenuItem>
        <MenuItem onClick={menuAction(onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default CollageCard;
