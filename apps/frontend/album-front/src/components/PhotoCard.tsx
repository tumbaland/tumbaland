import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Chip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Image as ImageIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  onView: (photo: Photo) => void;
  onEdit?: (photo: Photo) => void;
  onDelete?: (photo: Photo) => void;
  onSetCover?: (photo: Photo) => void;
  isCoverPhoto?: boolean;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ 
  photo, 
  onView, 
  onEdit, 
  onDelete, 
  onSetCover, 
  isCoverPhoto = false 
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    if (onEdit) onEdit(photo);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (onDelete) onDelete(photo);
    handleMenuClose();
  };

  const handleSetCover = () => {
    if (onSetCover) onSetCover(photo);
    handleMenuClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card
      sx={{
        width: 220,
        maxWidth: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: 3,
        borderRadius: 2,
        overflow: 'hidden',
      }}
      onClick={() => onView(photo)}
    >
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
        {photo.signedUrl ? (
          <CardMedia
            component="img"
            image={photo.signedUrl}
            alt={photo.title || photo.originalName}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.200',
            }}
          >
            <ImageIcon sx={{ fontSize: 60, color: 'grey.400' }} />
          </Box>
        )}
        {isCoverPhoto && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 2,
              bgcolor: 'primary.main',
              color: 'white',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            <StarIcon sx={{ fontSize: 14 }} />
            Cover
          </Box>
        )}
        {(onEdit || onDelete || onSetCover) && (
          <IconButton 
            size="small" 
            onClick={handleMenuClick}
            sx={{ 
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' }
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      
      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        <Typography 
          variant="subtitle2" 
          component="h3" 
          noWrap 
          sx={{ fontWeight: 600 }}
        >
          {photo.title || photo.originalName}
        </Typography>
        
        {photo.description && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {photo.description}
          </Typography>
        )}
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {formatFileSize(photo.size)}
          {photo.width && photo.height && ` • ${photo.width}×${photo.height}`}
        </Typography>
        
        {photo.tags && photo.tags.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {photo.tags.slice(0, 2).map((tag, index) => (
              <Chip 
                key={index} 
                label={tag} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {photo.tags.length > 2 && (
              <Chip 
                label={`+${photo.tags.length - 2}`} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        )}
      </CardContent>      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        {onSetCover && !isCoverPhoto && (
          <MenuItem onClick={handleSetCover}>
            Set as Cover Photo
          </MenuItem>
        )}
        {onEdit && (
          <MenuItem onClick={handleEdit}>
            Edit Photo
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={handleDelete}>
            Delete Photo
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default PhotoCard;
