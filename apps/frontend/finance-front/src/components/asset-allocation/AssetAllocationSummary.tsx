import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface SummaryData {
  first: { date: Date; totalValue: number };
  last: { date: Date; totalValue: number };
  firstNet: number;
  lastNet: number;
  diff: number;
  pct: number;
}

interface AssetAllocationSummaryProps {
  summary: SummaryData | null;
  quickRange: string;
  startDate: string;
  endDate: string;
}

const AssetAllocationSummary: React.FC<AssetAllocationSummaryProps> = ({
  summary,
  quickRange,
  startDate,
  endDate
}) => {
  // Helper to format date for table display (DD.MM.YYYY)
  function formatDate(date: string | Date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Helper to format numbers with thousands separator and two decimals
  function formatNumber(value: number | string) {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  return (
    <Paper elevation={0} sx={{ mb: 2, p: { xs: 1.5, sm: 2, md: 2.5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      {summary ? (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '1rem' } }}>
            Portfolio Value Change {quickRange ? `(${quickRange})` : startDate || endDate ? ' (Filtered Period)' : ''}
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.5, fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' } }}>
            From <strong>{formatDate(summary.first.date)}</strong> at <strong>{formatNumber(summary.firstNet)}</strong> to <strong>{formatDate(summary.last.date)}</strong> at <strong>{formatNumber(summary.lastNet)}</strong>.
            {' '}Change: <strong style={{ color: summary.diff > 0 ? '#2e7d32' : summary.diff < 0 ? '#d32f2f' : undefined }}>
              {summary.diff > 0 ? '+' : ''}{formatNumber(summary.diff)} ({summary.diff > 0 ? '+' : ''}{summary.pct.toFixed(2)}%)
            </strong>
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' } }}>No data in selected period.</Typography>
      )}
    </Paper>
  );
};

export default AssetAllocationSummary;
