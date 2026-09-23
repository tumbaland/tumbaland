import React from 'react';
import { Box, Typography, Button, TextField, InputAdornment, IconButton } from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { gradient } from '@tumbaland/frontend-core';

interface AlbumsHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreateAlbum: () => void;
  onRefresh: () => void;
  loading: boolean;
}

/**
 * Two short rows: title and action, then search and refresh. They replace a
 * centred heading, a full-width button and a padded search card, which on a
 * phone pushed the first album below the fold.
 */
const AlbumsHeader: React.FC<AlbumsHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onCreateAlbum,
  onRefresh,
  loading
}) => {
  return (
    <>
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: { xs: 1.5, sm: 3 } }}
      >
        <Typography
          variant="h5"
          component="h1"
          sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1.35rem', sm: '1.75rem' } }}
        >
          Albums
        </Typography>
        <Button
          variant="contained"
          size="small"
          disableElevation
          startIcon={<AddIcon />}
          onClick={onCreateAlbum}
          sx={{
            flexShrink: 0,
            whiteSpace: 'nowrap',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: gradient.brand
          }}
        >
          Create album
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1.5, sm: 3 } }}>
        <TextField
          size="small"
          placeholder="Search albums..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
              sx: { borderRadius: 2, backgroundColor: 'color-mix(in srgb, var(--mui-palette-background-paper) 75%, transparent)' }
            }
          }}
          sx={{ flex: 1, maxWidth: { sm: 400 } }}
        />
        <IconButton
          onClick={onRefresh}
          disabled={loading}
          color="primary"
          title="Refresh albums"
          aria-label="Refresh albums"
          sx={{ flexShrink: 0 }}
        >
          <RefreshIcon />
        </IconButton>
      </Box>
    </>
  );
};

export default AlbumsHeader;
