import React from 'react';
import {
  Box,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon
} from '@mui/icons-material';

interface PhotoSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const PhotoSearchBar: React.FC<PhotoSearchBarProps> = ({
  searchTerm,
  onSearchChange
}) => {
  return (
    <Box sx={{
      mb: { xs: 2, sm: 4 }
    }}>
      <TextField
        fullWidth
        placeholder="Search photos..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }
        }}
        sx={{ 
          maxWidth: 400,
          '& .MuiOutlinedInput-root': {
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(12px)',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.4)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(99, 102, 241, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6366f1',
            }
          }
        }}
      />
    </Box>
  );
};

export default PhotoSearchBar;
