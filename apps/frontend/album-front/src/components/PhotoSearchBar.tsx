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
    <Box mb={4}>
      <TextField
        placeholder="Search photos..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
        sx={{ maxWidth: 400 }}
      />
    </Box>
  );
};

export default PhotoSearchBar;
