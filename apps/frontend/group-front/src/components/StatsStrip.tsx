import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export interface StatsStripItem {
  label: string;
  value: number;
}

/** One compact strip of numbers, each over its label, in equal columns. */
const StatsStrip: React.FC<{ items: StatsStripItem[] }> = ({ items }) => (
  <Paper
    elevation={0}
    sx={{
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      mb: { xs: 2, sm: 3 },
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      overflow: 'hidden'
    }}
  >
    {items.map((item, index) => (
      <Box
        key={item.label}
        sx={{
          px: 1,
          py: 1.5,
          textAlign: 'center',
          borderLeft: index === 0 ? 'none' : '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>{item.value}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {item.label}
        </Typography>
      </Box>
    ))}
  </Paper>
);

export default StatsStrip;
