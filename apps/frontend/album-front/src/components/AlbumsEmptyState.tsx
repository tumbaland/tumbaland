import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { PhotoLibrary as PhotoLibraryIcon, Add as AddIcon } from '@mui/icons-material';

interface AlbumsEmptyStateProps {
  searchTerm: string;
  onCreateAlbum: () => void;
}

const AlbumsEmptyState: React.FC<AlbumsEmptyStateProps> = ({ searchTerm, onCreateAlbum }) => {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: { xs: 4, sm: 8 }
      }}>
      <PhotoLibraryIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'grey.400', mb: 2 }} />
      <Typography variant="h6" gutterBottom sx={{
        color: "text.secondary"
      }}>
        {searchTerm ? 'No albums found' : 'No albums yet'}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 3
        }}>
        {searchTerm ? 'Try adjusting your search terms' : 'Create your first album to get started'}
      </Typography>
      {!searchTerm && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateAlbum}>
          Create Album
        </Button>
      )}
    </Box>
  );
};

export default AlbumsEmptyState;
