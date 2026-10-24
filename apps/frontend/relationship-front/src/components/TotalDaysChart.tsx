import React, { useState } from 'react';
import { useActivePalette, useTenantFilter } from '@tumbaland/frontend-core';
import { Box, Chip, useTheme, useMediaQuery } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { useAsyncData } from '../hooks/useAsyncData';
import { getMonthlyStatistics, MonthlyStatisticsData } from '../services/statistics';
import { ActivityType } from '../services/types';
import { ChartCard, ChartStats, YearSelect, barLabelOn, chipColors, monthAxis, monthLabel } from './ChartCard';

interface TotalDaysChartProps {
  title?: string;
  year?: number;
  height?: number;
  /**
   * Optional highlighted activity type: its days get their own colored
   * segment, split out of the overall "days with entries" count.
   */
  featuredType?: ActivityType;
}

const NO_ROWS: MonthlyStatisticsData[] = [];

// Helper function to get total days in a month
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

const sum = (values: number[]): number => values.reduce((total, v) => total + v, 0);

const TotalDaysChart: React.FC<TotalDaysChartProps> = ({
  title = 'Monthly Days Breakdown',
  year,
  height = 400,
  featuredType
}) => {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const palette = useActivePalette();

  const tenantGroupId = useTenantFilter();

  const { data: loaded, loading, error } = useAsyncData(
    () => getMonthlyStatistics(selectedYear, tenantGroupId),
    [selectedYear, tenantGroupId]
  );
  const data = loaded ?? NO_ROWS;

  const monthLabels = data.map(monthLabel);

  const featuredDaysFor = (item: MonthlyStatisticsData): number =>
    featuredType ? item.types.find((t) => t.slug === featuredType.slug)?.uniqueDays || 0 : 0;

  const featuredData = data.map(featuredDaysFor);
  // remaining days with entries, so the segments sum to daysWithEntries
  const togetherData = data.map((item) => Math.max(0, item.daysWithEntries - featuredDaysFor(item)));
  const apartData = data.map((item) => {
    const calendarDays = getDaysInMonth(item.year, parseInt(item.month));
    return Math.max(0, calendarDays - item.daysWithEntries);
  });

  // Days with entries take the brand's violet, days without any a neutral grey
  // that recedes but still stands off the card in both schemes (4:1 or better);
  // a featured type brings its own colour.
  const colorTogether = palette.secondary.main;
  const colorApart = palette.grey[600];
  const featuredColor = featuredType?.color || palette.error.main;

  // One entry per stacked segment: its bar series, its legend chip and its headline number.
  const segments = [
    ...(featuredType
      ? [{ label: `${featuredType.name} days`, color: featuredColor, data: featuredData }]
      : []),
    {
      label: featuredType ? 'Other days together' : 'Days together',
      color: colorTogether,
      data: togetherData
    },
    { label: 'Days apart', color: colorApart, data: apartData }
  ].map((segment) => ({ ...segment, count: sum(segment.data) }));

  return (
    <ChartCard
      title={title}
      height={height}
      loading={loading}
      error={error}
      empty={data.length === 0}
      actions={<YearSelect value={selectedYear} onChange={setSelectedYear} />}
    >
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {segments.map((segment) => (
          <Chip
            key={segment.label}
            label={`${segment.label} (${segment.count})`}
            size="small"
            sx={{
              ...chipColors(palette, segment.color),
              '& .MuiChip-label': { fontSize: { xs: '0.65rem', sm: '0.75rem' } },
              minWidth: { xs: '60px', sm: 'auto' }
            }}
          />
        ))}
      </Box>

      <Box sx={{ width: '100%', height: height - 100 }}>
        <BarChart
          xAxis={[monthAxis(monthLabels)]}
          yAxis={[{ max: 31, ...(isMobile ? {} : { label: 'Days' }) }]}
          series={segments.map((segment) => ({
            data: segment.data,
            label: segment.label,
            stack: 'days',
            color: segment.color,
            barLabel: 'value' as const
          }))}
          slotProps={{ barLabel: barLabelOn(palette, '10px') }}
          height={height - 130}
        />
      </Box>

      <ChartStats stats={segments.map((segment) => ({ label: segment.label, value: segment.count, color: segment.color }))} />
    </ChartCard>
  );
};

export default TotalDaysChart;
