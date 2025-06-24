import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Chip,
  Box,
  Menu,
  MenuItem
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Public as PublicIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { Album } from '../types';

interface AlbumCardProps {
  album: Album;
  onView: (album: Album) => void;
  onEdit?: (album: Album) => void;
  onDelete?: (album: Album) => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onView, onEdit, onDelete }) => {
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
    if (onEdit) onEdit(album);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (onDelete) onDelete(album);
    handleMenuClose();
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}      onClick={() => onView(album)}
    >
      <Box sx={{ position: 'relative' }}>
        <CardMedia
          sx={{
            height: 200,
            bgcolor: 'grey.200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: album.coverPhoto?.signedUrl ? `url(${album.coverPhoto.signedUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {!album.coverPhoto?.signedUrl && (
            <PhotoLibraryIcon sx={{ fontSize: 60, color: 'grey.400' }} />
          )}
        </CardMedia>
        
        {album.coverPhoto?.signedUrl && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              height: '50%',
              pointerEvents: 'none'
            }}
          />
        )}
      </Box>
      
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Typography variant="h6" component="h2" noWrap sx={{ flexGrow: 1, mr: 1 }}>
            {album.name}
          </Typography>
          <Box display="flex" alignItems="center" gap={0.5}>
            {album.isPublic ? (
              <PublicIcon sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <LockIcon sx={{ fontSize: 16, color: 'grey.500' }} />
            )}
            {(onEdit || onDelete) && (
              <IconButton 
                size="small" 
                onClick={handleMenuClick}
                sx={{ ml: 0.5 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
        
        {album.description && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mt: 1, 
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {album.description}
          </Typography>
        )}
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
        </Typography>
        
        {album.tags && album.tags.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {album.tags.slice(0, 3).map((tag, index) => (
              <Chip 
                key={index} 
                label={tag} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            ))}
            {album.tags.length > 3 && (
              <Chip 
                label={`+${album.tags.length - 3}`} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            )}
          </Box>
        )}
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        {onEdit && (
          <MenuItem onClick={handleEdit}>
            Edit Album
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={handleDelete}>
            Delete Album
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default AlbumCard;
