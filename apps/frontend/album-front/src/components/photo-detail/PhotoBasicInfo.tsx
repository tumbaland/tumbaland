import React from 'react';
import { Box, Typography, Divider, Chip } from '@mui/material';
import { Photo } from '../../types';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';

interface PhotoBasicInfoProps {
  photo: Photo;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateString: string) => string;
  onSwipeNext?: () => void;
  onSwipePrevious?: () => void;
}

const PhotoBasicInfo: React.FC<PhotoBasicInfoProps> = ({
  photo,
  formatFileSize,
  formatDate,
  onSwipeNext,
  onSwipePrevious
}) => {
  const swipeHandlers = useSwipeNavigation(onSwipeNext ?? (() => {}), onSwipePrevious ?? (() => {}));
  return (
    <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', lg: 'row' } }}>
      {/* Photo Display */}
      <Box sx={{ flex: 2 }}>
        <Typography variant="h6" gutterBottom sx={{
          fontWeight: 600
        }}>
          Photo
        </Typography>
        <Box
          onTouchStart={swipeHandlers.onTouchStart}
          onTouchEnd={swipeHandlers.onTouchEnd}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            p: 2,
            bgcolor: 'rgba(0,0,0,0.02)',
            borderRadius: 3,
            border: '1px solid rgba(0,0,0,0.05)'
          }}
        >
          <Box
            component="img"
            src={photo.signedUrl}
            alt={photo.title || photo.originalName}
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: '70vh',
              objectFit: 'contain',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}
          />
        </Box>
      </Box>
      {/* Photo Details */}
      <Box sx={{ flex: 1, minWidth: { lg: 300 } }}>
        <Typography variant="h6" gutterBottom sx={{
          fontWeight: 600
        }}>
          Details
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            gutterBottom
            sx={{
              color: "text.secondary",
              fontWeight: 500
            }}>
            Description
          </Typography>
          <Typography variant="body1">{photo.description || 'No description'}</Typography>
        </Box>
        <Divider sx={{ my: 3, opacity: 0.6 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontWeight: 500
              }}>
              File Size
            </Typography>
            <Typography variant="body1" sx={{
              fontWeight: 500
            }}>
              {formatFileSize(photo.size)}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontWeight: 500
              }}>
              Dimensions
            </Typography>
            <Typography variant="body1" sx={{
              fontWeight: 500
            }}>
              {photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'Unknown'}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontWeight: 500
              }}>
              Upload Date
            </Typography>
            <Typography variant="body1" sx={{
              fontWeight: 500
            }}>
              {formatDate(photo.createdAt)}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              fontWeight: 500
            }}>
            Original Name
          </Typography>
          <Typography
            variant="body1"
            sx={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.9rem', mt: 0.5 }}
          >
            {photo.originalName}
          </Typography>
        </Box>
        {photo.tags && photo.tags.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="body2"
              gutterBottom
              sx={{
                color: "text.secondary",
                fontWeight: 500
              }}>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {photo.tags.map((tag, index) => (
                <Chip key={index} label={tag} size="small" variant="outlined" sx={{ borderRadius: 1.5 }} />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PhotoBasicInfo;
