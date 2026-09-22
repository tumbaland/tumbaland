import React, { useEffect, useState } from 'react';
import { Box, Typography, Divider, Chip, Button, CircularProgress } from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { logger } from '@tumbaland/frontend-core';
import { Photo, TagCount } from '../../types';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { useProgressiveImage } from '../../hooks/useProgressiveImage';
import TagInput from '../TagInput';

interface PhotoBasicInfoProps {
  photo: Photo;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateString: string) => string;
  onSwipeNext?: () => void;
  onSwipePrevious?: () => void;
  /** Album vocabulary offered as tag suggestions. */
  tagSuggestions?: TagCount[];
  /** When given, the tags block becomes editable in place. */
  onSaveTags?: (tags: string[]) => Promise<void>;
}

const PhotoBasicInfo: React.FC<PhotoBasicInfoProps> = ({
  photo,
  formatFileSize,
  formatDate,
  onSwipeNext,
  onSwipePrevious,
  tagSuggestions = [],
  onSaveTags
}) => {
  const swipeHandlers = useSwipeNavigation(onSwipeNext ?? (() => {}), onSwipePrevious ?? (() => {}));
  const { displaySrc } = useProgressiveImage(photo.signedUrl, photo.thumbnailUrl || photo.thumbnailSignedUrl);
  const [editingTags, setEditingTags] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>(photo.tags || []);
  const [savingTags, setSavingTags] = useState(false);

  // Arrow-key navigation swaps the photo under this panel; drop any half-typed
  // tag rather than carrying it onto the next photo.
  useEffect(() => {
    setEditingTags(false);
    setDraftTags(photo.tags || []);
  }, [photo._id, photo.tags]);

  const handleSaveTags = async () => {
    if (!onSaveTags) return;
    setSavingTags(true);
    try {
      await onSaveTags(draftTags);
      setEditingTags(false);
    } catch (error) {
      logger.error('Failed to save tags', error);
    } finally {
      setSavingTags(false);
    }
  };
  return (
    <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', lg: 'row' } }}>
      {/* Photo Display */}
      <Box sx={{ flex: 2 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            fontWeight: 600
          }}
        >
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
          {/* A video plays here: this is the item's own page, not a tile. It
              was an <img> for everything, which drew a video as nothing. */}
          <Box
            {...(photo.mimetype?.startsWith('video/')
              ? {
                  component: 'video' as const,
                  src: photo.signedUrl ?? displaySrc,
                  controls: true,
                  playsInline: true,
                  preload: 'metadata',
                  'aria-label': photo.title || photo.originalName
                }
              : { component: 'img' as const, src: displaySrc, alt: photo.title || photo.originalName })}
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
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            fontWeight: 600
          }}
        >
          Details
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            gutterBottom
            sx={{
              color: 'text.secondary',
              fontWeight: 500
            }}
          >
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
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              File Size
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 500
              }}
            >
              {formatFileSize(photo.size)}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              Dimensions
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 500
              }}
            >
              {photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'Unknown'}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              Upload Date
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 500
              }}
            >
              {formatDate(photo.createdAt)}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontWeight: 500
            }}
          >
            Original Name
          </Typography>
          <Typography
            variant="body1"
            sx={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.9rem', mt: 0.5 }}
          >
            {photo.originalName}
          </Typography>
        </Box>
        {(onSaveTags || (photo.tags && photo.tags.length > 0)) && (
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="body2"
              gutterBottom
              sx={{
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              Tags
            </Typography>

            {editingTags ? (
              <Box>
                <TagInput
                  value={draftTags}
                  onChange={setDraftTags}
                  suggestions={tagSuggestions}
                  disabled={savingTags}
                  size="small"
                  autoFocus
                  label=""
                  helperText="Press Enter or comma to add a tag"
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleSaveTags}
                    disabled={savingTags}
                    startIcon={savingTags ? <CircularProgress size={14} color="inherit" /> : null}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setDraftTags(photo.tags || []);
                      setEditingTags(false);
                    }}
                    disabled={savingTags}
                    sx={{ textTransform: 'none' }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                {(photo.tags || []).map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ borderRadius: 1.5 }}
                    onClick={onSaveTags ? () => setEditingTags(true) : undefined}
                  />
                ))}
                {onSaveTags && (
                  <Chip
                    icon={<LocalOfferIcon sx={{ fontSize: 16 }} />}
                    label={photo.tags && photo.tags.length > 0 ? 'Edit' : 'Add tags'}
                    size="small"
                    variant="outlined"
                    onClick={() => setEditingTags(true)}
                    sx={{ borderRadius: 1.5, borderStyle: 'dashed', color: 'text.secondary' }}
                  />
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PhotoBasicInfo;
