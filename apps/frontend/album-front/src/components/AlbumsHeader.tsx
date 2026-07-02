import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface AlbumsHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreateAlbum: () => void;
  onRefresh: () => void;
  loading: boolean;
}

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
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: { xs: 2, sm: 4 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 }
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            mb: { xs: 1, sm: 0 },
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Albums
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateAlbum}
          sx={{ 
            width: { xs: '100%', sm: 'auto' },
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            py: 1,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)'
            }
          }}
        >
          Create Album
        </Button>
      </Box>

      <Box 
        sx={{
          mb: { xs: 2, sm: 4 },
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          p: { xs: 1.5, sm: 2 },
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}
      >
        <TextField
          placeholder="Search albums..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: 'none' }
              }
            }
          }}
          sx={{ maxWidth: 400, flex: 1, minWidth: 200 }}
        />
        <IconButton
          onClick={onRefresh}
          disabled={loading}
          color="primary"
          sx={{ 
            flexShrink: 0,
            bgcolor: 'rgba(255, 255, 255, 0.5)',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.8)' }
          }}
          title="Refresh albums"
        >
          <RefreshIcon />
        </IconButton>
      </Box>
    </>
  );
};

export default AlbumsHeader;
