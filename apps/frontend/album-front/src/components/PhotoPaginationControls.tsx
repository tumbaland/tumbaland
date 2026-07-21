import React from 'react';
import {
  Box,
  Typography,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  useMediaQuery,
  useTheme
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
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const siblingCount = isMobile ? 0 : isDesktop ? 2 : 1;
  const showPagination = pageSize > 0 && pagination.pages > 1;

  if (position === 'top') {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            {pagination.total} {pagination.total === 1 ? 'photo' : 'photos'} total
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Per page</InputLabel>
            <Select value={pageSize} onChange={onPageSizeChange} label="Per page">
              <MenuItem value={24}>24</MenuItem>
              <MenuItem value={48}>48</MenuItem>
              <MenuItem value={96}>96</MenuItem>
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
            siblingCount={siblingCount}
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }
            }}
          />
        )}
      </Box>
    );
  }

  // Bottom pagination
  if (showPagination) {
    return (
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Pagination
          count={pagination.pages}
          page={currentPage}
          onChange={onPageChange}
          color="primary"
          size="medium"
          showFirstButton
          showLastButton
          siblingCount={siblingCount}
          sx={{
            '& .MuiPaginationItem-root': {
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }
          }}
        />
      </Box>
    );
  }

  return null;
};

export default PhotoPaginationControls;
