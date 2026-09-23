import React from 'react';
import { Box, IconButton } from '@mui/material';
import { MoreVert as MoreVertIcon } from '@mui/icons-material';
import { Album } from '../types';
import AlbumCard from './AlbumCard';

interface AlbumsGridProps {
  albums: Album[];
  onViewAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLButtonElement>, album: Album) => void;
}

const AlbumsGrid: React.FC<AlbumsGridProps> = ({ albums, onViewAlbum, onDeleteAlbum, onMenuOpen }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
          xl: 'repeat(6, minmax(0, 1fr))'
        },
        gap: { xs: 1.5, sm: 2, md: 3 }
      }}
    >
      {albums.map((album) => (
        <AlbumCard
          key={album._id}
          album={album}
          onView={onViewAlbum}
          onDelete={onDeleteAlbum}
          editButton={
            <IconButton
              onClick={(e) => onMenuOpen(e, album)}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'color-mix(in srgb, var(--mui-palette-background-paper) 90%, transparent)',
                boxShadow: 1,
                zIndex: 2,
                '&:hover': { bgcolor: 'rgba(255,255,255,1)' }
              }}
              aria-label="Album options"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          }
        />
      ))}
    </Box>
  );
};

export default AlbumsGrid;
