import React from 'react';
import { Box, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface PhotoSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

/**
 * Sits in a row beside other controls, so it takes the room it is given and
 * leaves spacing to the row rather than setting its own margins.
 */
const PhotoSearchBar: React.FC<PhotoSearchBarProps> = ({ searchTerm, onSearchChange }) => {
  return (
    <Box sx={{ flex: 1, minWidth: 0, maxWidth: { sm: 400 } }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search photos..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            '& fieldset': {
              borderColor: 'rgba(15, 23, 42, 0.12)'
            },
            '&:hover fieldset': {
              borderColor: 'rgba(99, 102, 241, 0.5)'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6366f1'
            }
          }
        }}
      />
    </Box>
  );
};

export default PhotoSearchBar;
