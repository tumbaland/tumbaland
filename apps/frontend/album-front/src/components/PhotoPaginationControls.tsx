import React from 'react';
import {
  Box,
  Typography,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material';

interface PhotoPaginationControlsProps {
  pagination: {
    total: number;
    pages: number;
  };
  currentPage: number;
  pageSize: number;
  onPageChange: (event: React.ChangeEvent<unknown>, value: number) => void;
  onPageSizeChange: (event: any) => void;
  position?: 'top' | 'bottom';
}

const PhotoPaginationControls: React.FC<PhotoPaginationControlsProps> = ({
  pagination,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  position = 'top'
}) => {
  const showPagination = pageSize > 0 && pagination.pages > 1;

  if (position === 'top') {
    return (
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 }
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            {pagination.total} {pagination.total === 1 ? 'photo' : 'photos'} total
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Per page</InputLabel>
            <Select value={pageSize} onChange={onPageSizeChange} label="Per page">
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={0}>All</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {showPagination && (
          <Pagination
            count={pagination.pages}
            page={currentPage}
            onChange={onPageChange}
            color="primary"
            size="medium"
            showFirstButton
            showLastButton
          />
        )}
      </Box>
    );
  }

  // Bottom pagination
  if (showPagination) {
    return (
      <Box mt={4} display="flex" justifyContent="center">
        <Pagination
          count={pagination.pages}
          page={currentPage}
          onChange={onPageChange}
          color="primary"
          size="large"
          showFirstButton
          showLastButton
        />
      </Box>
    );
  }

  return null;
};

export default PhotoPaginationControls;
