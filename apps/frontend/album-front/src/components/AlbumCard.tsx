import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Box,
  Menu,
  MenuItem
} from '@mui/material';
import {
  PhotoLibrary as PhotoLibraryIcon
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
        width: 220,
        maxWidth: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: 3,
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}
      onClick={() => onView(album)}
    >
      <Box sx={{ position: 'relative', width: '100%', pt: '100%' /* 1:1 aspect ratio */ }}>
        {album.coverPhoto?.signedUrl ? (
          <CardMedia
            component="img"
            image={album.coverPhoto.signedUrl}
            alt={album.name}
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
              backgroundColor: 'grey.100',
            }}
          >
            <PhotoLibraryIcon sx={{ fontSize: 60, color: 'grey.400' }} />
          </Box>
        )}
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
        <Typography gutterBottom variant="h6" component="div" noWrap>
          {album.name}
        </Typography>
        
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
