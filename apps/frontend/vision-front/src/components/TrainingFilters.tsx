import React from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface TrainingFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (newStatus: string) => void;
}

export const TrainingFilters: React.FC<TrainingFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange
}) => {
  return (
    <Box mb={3} display="flex" gap={2} flexWrap="wrap" alignItems="center">
      <TextField
        placeholder="Search trainings by name or description..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
        sx={{ flexGrow: 1, maxWidth: 500 }}
      />

      <ToggleButtonGroup
        value={statusFilter}
        exclusive
        onChange={(_, newStatus) => {
          if (newStatus !== null) {
            onStatusFilterChange(newStatus);
          }
        }}
        aria-label="status filter"
        size="small"
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="pending">Pending</ToggleButton>
        <ToggleButton value="running">Running</ToggleButton>
        <ToggleButton value="completed">Completed</ToggleButton>
        <ToggleButton value="failed">Failed</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};

export default TrainingFilters;
