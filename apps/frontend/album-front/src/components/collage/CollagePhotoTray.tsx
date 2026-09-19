import React, { useMemo, useState } from 'react';
import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/** Shape of photos returned by GET /collages/:id (a projection of Photo). */
export interface AlbumPhoto {
  _id: string;
  filename: string;
  title?: string;
  signedUrl?: string;
  thumbnailSignedUrl?: string;
  width?: number;
  height?: number;
  tags?: string[];
}

interface CollagePhotoTrayProps {
  photos: AlbumPhoto[];
  usedPhotoIds: Set<string>;
  onAddPhoto: (photo: AlbumPhoto) => void;
}

/**
 * Tag vocabulary across the tray's photos, most used first.
 * Derived here rather than fetched: the tray already has every photo it can
 * show, so its tags are the only ones a filter could usefully offer.
 */
const collectTags = (photos: AlbumPhoto[]): { tag: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const photo of photos) {
    for (const tag of new Set(photo.tags || [])) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
  );
};

/**
 * Left-hand tray listing all photos from the collage's source albums.
 * Click to add a photo to the canvas center, or drag it onto the canvas.
 */
const CollagePhotoTray: React.FC<CollagePhotoTrayProps> = ({ photos, usedPhotoIds, onAddPhoto }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(true);

  const tags = useMemo(() => collectTags(photos), [photos]);

  const visiblePhotos = useMemo(() => {
    if (selectedTags.length === 0) return photos;
    return photos.filter((photo) => {
      const photoTags = photo.tags || [];
      return matchAll
        ? selectedTags.every((tag) => photoTags.includes(tag))
        : selectedTags.some((tag) => photoTags.includes(tag));
    });
  }, [photos, selectedTags, matchAll]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <Box
      sx={{
        width: 196,
        flexShrink: 0,
        bgcolor: '#1c1c1e',
        color: '#fff',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        overflowY: 'auto',
        p: 1
      }}
    >
      <Typography variant="caption" sx={{ px: 0.5, color: 'rgba(255,255,255,0.6)' }}>
        Photos ({visiblePhotos.length}
        {visiblePhotos.length !== photos.length ? ` of ${photos.length}` : ''}) — click or drag to add
      </Typography>

      {tags.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Filter by tag
            </Typography>
            {selectedTags.length > 0 && (
              <Button
                size="small"
                onClick={() => setSelectedTags([])}
                sx={{ minWidth: 0, p: 0, textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}
              >
                Clear
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, maxHeight: 132, overflowY: 'auto' }}>
            {tags.map(({ tag, count }) => {
              const active = selectedTags.includes(tag);
              return (
                <Chip
                  key={tag}
                  label={`${tag} ${count}`}
                  size="small"
                  onClick={() => toggleTag(tag)}
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    borderRadius: 1,
                    color: active ? '#fff' : 'rgba(255,255,255,0.75)',
                    bgcolor: active ? 'primary.main' : 'rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: active ? 'primary.dark' : 'rgba(255,255,255,0.2)' }
                  }}
                />
              );
            })}
          </Box>
          {selectedTags.length > 1 && (
            <Button
              size="small"
              onClick={() => setMatchAll((prev) => !prev)}
              sx={{
                mt: 0.5,
                textTransform: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.7rem',
                p: 0,
                minWidth: 0
              }}
            >
              {matchAll ? 'Match all' : 'Match any'}
            </Button>
          )}
        </Box>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          mt: 1
        }}
      >
        {visiblePhotos.map((photo) => {
          const used = usedPhotoIds.has(photo._id);
          const src = photo.thumbnailSignedUrl || photo.signedUrl;
          return (
            <Tooltip
              key={photo._id}
              title={
                photo.tags && photo.tags.length > 0
                  ? `${photo.title || photo.filename} — ${photo.tags.join(', ')}`
                  : photo.title || photo.filename
              }
              placement="right"
            >
              <Box
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-collage-photo', photo._id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onAddPhoto(photo)}
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 1,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'rgba(255,255,255,0.06)',
                  opacity: used ? 0.55 : 1,
                  transition: 'opacity 0.15s, transform 0.15s',
                  '&:hover': { transform: 'scale(1.04)', opacity: 1 }
                }}
              >
                {src ? (
                  <img
                    src={src}
                    alt={photo.title || photo.filename}
                    loading="lazy"
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      color: 'rgba(255,255,255,0.5)',
                      p: 0.5,
                      textAlign: 'center'
                    }}
                  >
                    No preview
                  </Box>
                )}
                {used && (
                  <CheckCircleIcon
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      fontSize: 18,
                      color: '#4ade80',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))'
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      {visiblePhotos.length === 0 && (
        <Typography variant="body2" sx={{ p: 1, color: 'rgba(255,255,255,0.5)' }}>
          {photos.length === 0 ? 'No photos in the source albums yet.' : 'No photos match the selected tags.'}
        </Typography>
      )}
    </Box>
  );
};

export default CollagePhotoTray;
