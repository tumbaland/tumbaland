import React from 'react';
import { Card, CardMedia, CardContent, Typography, IconButton, Box, Menu, MenuItem, Chip } from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  LocalOffer as LocalOfferIcon,
  Image as ImageIcon,
  Star as StarIcon,
  Videocam as VideocamIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon
} from '@mui/icons-material';
import { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  onView: (photo: Photo) => void;
  onEdit?: (photo: Photo) => void;
  onDelete?: (photo: Photo) => void;
  onSetCover?: (photo: Photo) => void;
  onViewDetails?: (photo: Photo) => void;
  onEditTags?: (photo: Photo) => void;
  isCoverPhoto?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (photo: Photo) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onView,
  onEdit,
  onDelete,
  onSetCover,
  onViewDetails,
  onEditTags,
  isCoverPhoto = false,
  selectMode = false,
  selected = false,
  onToggleSelect
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

  const handleViewDetails = () => {
    if (onViewDetails) onViewDetails(photo);
    handleMenuClose();
  };

  const handleEditTags = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onEditTags) onEditTags(photo);
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
        width: '100%',
        maxWidth: { xs: '100%', sm: 260 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        borderRadius: 3,
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: selected ? '2px solid' : '1px solid rgba(255, 255, 255, 0.5)',
        borderColor: selected ? 'primary.main' : 'rgba(255, 255, 255, 0.5)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.1)'
        }
      }}
      onClick={() => (selectMode ? onToggleSelect?.(photo) : onView(photo))}
    >
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
        {photo.thumbnailUrl ? (
          photo.mimetype.startsWith('video/') ? (
            <Box
              component="video"
              src={photo.thumbnailUrl}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              muted
              preload="metadata"
            />
          ) : (
            <CardMedia
              component="img"
              image={photo.thumbnailUrl}
              alt={photo.title || photo.originalName}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          )
        ) : photo.signedUrl ? (
          photo.mimetype.startsWith('video/') ? (
            <Box
              component="video"
              src={photo.signedUrl}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              muted
              preload="metadata"
            />
          ) : (
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
                objectFit: 'cover'
              }}
            />
          )
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
              bgcolor: 'grey.200'
            }}
          >
            {photo.mimetype.startsWith('video/') ? (
              <VideocamIcon sx={{ fontSize: 60, color: 'grey.400' }} />
            ) : (
              <ImageIcon sx={{ fontSize: 60, color: 'grey.400' }} />
            )}
          </Box>
        )}
        {photo.mimetype.startsWith('video/') && (photo.thumbnailUrl || photo.signedUrl) && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '50%',
              p: 1,
              zIndex: 1
            }}
          >
            <VideocamIcon sx={{ fontSize: 24, color: 'white' }} />
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
        {!selectMode && (onEdit || onDelete || onSetCover || onEditTags) && (
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
        {selectMode && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              zIndex: 2,
              display: 'flex',
              bgcolor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '50%',
              p: 0.25
            }}
          >
            {selected ? (
              <CheckCircleIcon sx={{ color: 'primary.main', bgcolor: 'white', borderRadius: '50%' }} fontSize="small" />
            ) : (
              <RadioButtonUncheckedIcon sx={{ color: 'white' }} fontSize="small" />
            )}
          </Box>
        )}
      </Box>
      <CardContent sx={{ display: { xs: 'none', sm: 'block' }, flexGrow: 1, p: 2 }}>
        <Typography variant="subtitle2" component="h3" noWrap sx={{ fontWeight: 600, fontSize: '1rem' }}>
          {photo.title || photo.originalName}
        </Typography>

        {photo.description && (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: '0.875rem'
            }}>
            {photo.description}
          </Typography>
        )}

        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            mt: 1,
            display: 'block',
            fontSize: '0.75rem'
          }}>
          {formatFileSize(photo.size)}
          {photo.width && photo.height && ` • ${photo.width}×${photo.height}`}
        </Typography>

        {photo.tags && photo.tags.length > 0 ? (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {photo.tags.slice(0, 2).map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
                onClick={onEditTags ? handleEditTags : undefined}
              />
            ))}
            {photo.tags.length > 2 && (
              <Chip
                label={`+${photo.tags.length - 2}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
                onClick={onEditTags ? handleEditTags : undefined}
              />
            )}
          </Box>
        ) : (
          // An untagged photo is where tagging actually has to start, so the
          // card offers the entry point instead of hiding it in the menu.
          onEditTags &&
          !selectMode && (
            <Box sx={{ mt: 1 }}>
              <Chip
                icon={<LocalOfferIcon sx={{ fontSize: 14 }} />}
                label="Add tags"
                size="small"
                variant="outlined"
                onClick={handleEditTags}
                sx={{ fontSize: '0.7rem', borderStyle: 'dashed', color: 'text.secondary' }}
              />
            </Box>
          )
        )}
      </CardContent>{' '}
      <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose} onClick={(e) => e.stopPropagation()}>
        {onViewDetails && <MenuItem onClick={handleViewDetails}>View Details</MenuItem>}
        {onSetCover && !isCoverPhoto && <MenuItem onClick={handleSetCover}>Set as Cover Photo</MenuItem>}
        {onEditTags && <MenuItem onClick={handleEditTags}>Edit Tags</MenuItem>}
        {onEdit && <MenuItem onClick={handleEdit}>Edit Photo</MenuItem>}
        {onDelete && <MenuItem onClick={handleDelete}>Delete Photo</MenuItem>}
      </Menu>
    </Card>
  );
};

export default PhotoCard;
