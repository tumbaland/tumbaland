import React, { useState } from 'react';
import {
  Box,
  Typography,
  Pagination,
  Slider,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  useMediaQuery,
  useTheme,
  SelectChangeEvent
} from '@mui/material';
import { NavigateBefore as NavigateBeforeIcon, NavigateNext as NavigateNextIcon } from '@mui/icons-material';

interface PhotoPaginationControlsProps {
  pagination: {
    total: number;
    pages: number;
  };
  currentPage: number;
  pageSize: number;
  onPageChange: (event: React.ChangeEvent<unknown>, value: number) => void;
  onPageSizeChange: (event: SelectChangeEvent<number>) => void;
  position?: 'top' | 'bottom';
}

// Above this many pages, a full row of page numbers stops being useful —
// switch to a slider so jumping from page 3 to page 80 doesn't mean
// hunting through (or endlessly clicking past) a wall of buttons.
const MAX_PAGES_FOR_FULL_LIST = 20;

const PhotoPaginationControls: React.FC<PhotoPaginationControlsProps> = ({
  pagination,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  position = 'top'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const showPagination = pageSize > 0 && pagination.pages > 1;
  const showAsSlider = pagination.pages > MAX_PAGES_FOR_FULL_LIST;

  // Live thumb position while dragging; only navigates once the drag is
  // released (or a keyboard step commits), so scrubbing across 100 pages
  // doesn't fire a request per pixel of movement.
  const [dragPage, setDragPage] = useState<number | null>(null);
  const sliderPage = dragPage ?? currentPage;

  const goToPage = (event: React.SyntheticEvent | Event, page: number) => {
    onPageChange(event as unknown as React.ChangeEvent<unknown>, Math.min(Math.max(page, 1), pagination.pages));
  };

  const paginationControl = showAsSlider ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', maxWidth: 420 }}>
      <IconButton
        size="small"
        onClick={(e) => goToPage(e, currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <NavigateBeforeIcon fontSize="small" />
      </IconButton>
      <Slider
        value={sliderPage}
        min={1}
        max={pagination.pages}
        step={1}
        onChange={(_, value) => setDragPage(value as number)}
        onChangeCommitted={(event, value) => {
          setDragPage(null);
          goToPage(event, value as number);
        }}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `Page ${value}`}
        sx={{ flex: 1 }}
      />
      <IconButton
        size="small"
        onClick={(e) => goToPage(e, currentPage + 1)}
        disabled={currentPage >= pagination.pages}
        aria-label="Next page"
      >
        <NavigateNextIcon fontSize="small" />
      </IconButton>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', whiteSpace: 'nowrap', minWidth: 56, textAlign: 'right' }}
      >
        {currentPage} / {pagination.pages}
      </Typography>
    </Box>
  ) : (
    <Pagination
      count={pagination.pages}
      page={currentPage}
      onChange={onPageChange}
      color="primary"
      size="medium"
      showFirstButton
      showLastButton
      siblingCount={pagination.pages}
      boundaryCount={pagination.pages}
      sx={{
        '& .MuiPaginationItem-root': {
          fontSize: { xs: '0.875rem', sm: '1rem' }
        }
      }}
    />
  );

  if (position === 'top') {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 2 },
          mb: { xs: 1, sm: 3 }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary'
            }}
          >
            {pagination.total} {pagination.total === 1 ? 'photo' : 'photos'} total
          </Typography>
          <FormControl size="small" sx={{ minWidth: { xs: 96, sm: 120 } }}>
            <InputLabel>Per page</InputLabel>
            <Select value={pageSize} onChange={onPageSizeChange} label="Per page">
              <MenuItem value={24}>24</MenuItem>
              <MenuItem value={48}>48</MenuItem>
              <MenuItem value={96}>96</MenuItem>
              <MenuItem value={0}>All</MenuItem>
            </Select>
          </FormControl>
        </Box>
        {/* On a phone the page numbers live at the bottom only. A second full
            row of them above the photos pushed the grid down for no gain. */}
        {showPagination && !isMobile && paginationControl}
      </Box>
    );
  }

  // Bottom pagination
  if (showPagination) {
    return <Box sx={{ mt: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'center' }}>{paginationControl}</Box>;
  }

  return null;
};

export default PhotoPaginationControls;
