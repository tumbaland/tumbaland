import React, { useState } from 'react';
import { useActivePalette, useTenantFilter } from '@tumbaland/frontend-core';
import { Box, Chip, useTheme, useMediaQuery } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { useAsyncData } from '../hooks/useAsyncData';
import { getMonthlyActivityBreakdown, MonthlyActivityData } from '../services/statistics';
import { getActivityTypes } from '../services/activityTypes';
import { ActivityType } from '../services/types';
import { ChartCard, ChartStats, YearSelect, barLabelOn, chipColors, monthAxis, monthLabel } from './ChartCard';

interface BarChartProps {
  title?: string;
  year?: number;
  height?: number;
  /** activity type slugs excluded from this chart (user's dashboard config) */
  hiddenSlugs?: Set<string>;
}

// Stable stand-ins until the first answer arrives, so memos keyed on them hold still.
const NO_ROWS: MonthlyActivityData[] = [];
const NO_TYPES: ActivityType[] = [];

const HoursBarChart: React.FC<BarChartProps> = ({
  title = 'Activities per Month by Type',
  year,
  height = 400,
  hiddenSlugs
}) => {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const palette = useActivePalette();

  const tenantGroupId = useTenantFilter();

  const { data: loaded, loading, error } = useAsyncData(async () => {
    const [monthly, types] = await Promise.all([
      getMonthlyActivityBreakdown(selectedYear, tenantGroupId),
      getActivityTypes({ groupId: tenantGroupId })
    ]);
    return { monthly, types: types.data };
  }, [selectedYear, tenantGroupId]);
  const data = loaded?.monthly ?? NO_ROWS;
  const activityTypes = loaded?.types ?? NO_TYPES;

  // Every activity type present in the data, minus the ones the user hid, with
  // its per-month counts.
  const slugs = Array.from(new Set(data.flatMap((month) => Object.keys(month.activities)))).filter(
    (slug) => !hiddenSlugs?.has(slug)
  );
  const types = slugs.map((slug) => {
    const type = activityTypes.find((t) => t.slug === slug);
    const counts = data.map((item) => item.activities[slug]?.count || 0);
    return {
      slug,
      name: type?.name || slug,
      color: type?.color || palette.grey[600],
      counts,
      total: counts.reduce((sum, count) => sum + count, 0)
    };
  });

  const monthLabels = data.map(monthLabel);
  const totalPerMonth = data.map((_, month) => types.reduce((sum, type) => sum + type.counts[month], 0));
  const totalActivities = totalPerMonth.reduce((sum, val) => sum + val, 0);
  const avgActivities = Math.round(totalActivities / data.length || 0);
  const peakActivities = Math.max(...totalPerMonth, 0);

  const series = [
    ...types.map((type) => ({ data: type.counts, label: type.name, stack: 'activities', color: type.color })),
    // An empty segment on top of each stack, there to carry the month's total as its label.
    {
      data: data.map(() => 0),
      label: `Total (${totalActivities})`,
      stack: 'activities',
      color: 'transparent',
      id: 'total-series',
      valueFormatter: () => '',
      barLabel: (item: { dataIndex: number }) => totalPerMonth[item.dataIndex]?.toString()
    }
  ];

  return (
    <ChartCard
      title={title}
      height={height}
      loading={loading}
      error={error}
      empty={data.length === 0}
      actions={<YearSelect value={selectedYear} onChange={setSelectedYear} />}
    >
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
        {types.map((type) => (
          <Chip
            key={type.slug}
            label={`${type.name} (${type.total})`}
            size="small"
            sx={{
              ...chipColors(palette, type.color),
              '& .MuiChip-label': { fontSize: { xs: '0.65rem', sm: '0.75rem' } },
              minWidth: { xs: '60px', sm: 'auto' }
            }}
          />
        ))}
      </Box>

      <Box sx={{ width: '100%', height: height - 100 }}>
        <BarChart
          xAxis={[monthAxis(monthLabels)]}
          yAxis={[isMobile ? {} : { label: 'Activities' }]}
          series={series}
          slotProps={{ barLabel: barLabelOn(palette, '12px', { transform: 'translateY(-10px)' }) }}
          height={height - 130}
        />
      </Box>

      <ChartStats
        stats={[
          { label: 'Total Activities', value: totalActivities },
          { label: 'Avg Activities per Month', value: avgActivities },
          { label: 'Peak Activities', value: peakActivities }
        ]}
      />
    </ChartCard>
  );
};

export default HoursBarChart;
