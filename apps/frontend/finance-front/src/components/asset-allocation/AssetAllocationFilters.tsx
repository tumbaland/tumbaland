import React from 'react';
import { Box, Paper, Button, Typography, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface AssetAllocationFiltersProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  quickRange: string;
  applyQuickRange: (range: string) => void;
  clearQuickRange: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  resetFilters: () => void;
  count: number;
}

const AssetAllocationFilters: React.FC<AssetAllocationFiltersProps> = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  quickRange,
  applyQuickRange,
  clearQuickRange,
  searchTerm,
  setSearchTerm,
  resetFilters,
  count
}) => {
  return (
    <Paper elevation={0} sx={{ p: { xs: 1, sm: 1.5, md: 2 }, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5, md: 2, lg: 2.5 }, alignItems: 'center' }}>
        <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: '120px', md: '140px', lg: '160px' }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
          <Box component="span" sx={{ position: 'absolute', top: 4, left: 8, fontSize: { xs: 10, sm: 11 }, fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', pointerEvents: 'none', textTransform: 'uppercase' }}>From</Box>
          <input
            type="date"
            aria-label="Start date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); clearQuickRange(); }}
            style={{ padding: '20px 8px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, width: '100%', minWidth: 100 }}
          />
        </Box>
        <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: '120px', md: '140px', lg: '160px' }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
          <Box component="span" sx={{ position: 'absolute', top: 4, left: 8, fontSize: { xs: 10, sm: 11 }, fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', pointerEvents: 'none', textTransform: 'uppercase' }}>To</Box>
          <input
            type="date"
            aria-label="End date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); }}
            style={{ padding: '20px 8px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, width: '100%', minWidth: 100 }}
          />
        </Box>
        <Box sx={{
          display: 'flex',
          gap: { xs: 0.25, sm: 0.5, md: 1 },
          flexWrap: 'wrap',
          width: { xs: '100%', sm: 'auto' },
          justifyContent: { xs: 'center', sm: 'flex-start' },
          flex: { xs: '1 1 100%', sm: '0 0 auto' },
          order: { xs: -1, sm: 0 }
        }}>
          {['1M', '6M', 'YTD', '1Y', '2Y', '3Y'].map((range) => (
            <Button
              key={range}
              size="small"
              variant={quickRange === range ? 'contained' : 'outlined'}
              onClick={() => applyQuickRange(range)}
              sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}
            >
              {range}
            </Button>
          ))}
          <Button
            size="small"
            onClick={resetFilters}
            disabled={!startDate && !endDate}
            sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}
          >
            Reset
          </Button>
        </Box>
        {quickRange && (
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              width: { xs: '100%', sm: 'auto' },
              textAlign: { xs: 'center', sm: 'left' },
              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
              flex: { xs: '1 1 100%', sm: '0 0 auto' },
              order: { xs: -2, sm: 0 }
            }}>Quick range active: {quickRange}</Typography>
        )}
        <TextField
          size="small"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
            minWidth: { xs: '100%', sm: 180, md: 220, lg: 260 },
            flex: { xs: '1 1 100%', sm: '0 0 auto' },
            maxWidth: { xs: '100%', sm: 250, md: 300, lg: 350 },
            order: { xs: -3, sm: 0 },
            '& .MuiInputBase-root': {
              fontSize: { xs: '0.8125rem', sm: '0.875rem' }
            }
          }}
        />
        <Box sx={{ flexGrow: 1, minWidth: { xs: 0, sm: 20, md: 40 } }} />
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            width: { xs: '100%', sm: 'auto' },
            textAlign: { xs: 'center', sm: 'right' },
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            flex: { xs: '1 1 100%', sm: '0 0 auto' },
            whiteSpace: 'nowrap',
            order: { xs: -4, sm: 0 }
          }}>
          Showing {count} date{count === 1 ? '' : 's'} with allocations
        </Typography>
      </Box>
    </Paper>
  );
};

export default AssetAllocationFilters;
