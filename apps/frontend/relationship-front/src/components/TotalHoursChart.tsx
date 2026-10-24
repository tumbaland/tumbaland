import React, { useState } from 'react';
import { useActivePalette, useTenantFilter } from '@tumbaland/frontend-core';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { useAsyncData } from '../hooks/useAsyncData';
import { getMonthlyActivityBreakdown, MonthlyActivityData } from '../services/statistics';
import { ChartCard, ChartStats, YearSelect, barLabelOn, monthAxis, monthLabel } from './ChartCard';

interface TotalHoursChartProps {
  title?: string;
  year?: number;
  height?: number;
}

const NO_ROWS: MonthlyActivityData[] = [];

const TotalHoursChart: React.FC<TotalHoursChartProps> = ({ title = 'Total Hours per Month', year, height = 400 }) => {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const palette = useActivePalette();

  const tenantGroupId = useTenantFilter();

  const { data: loaded, loading, error } = useAsyncData(
    () => getMonthlyActivityBreakdown(selectedYear, tenantGroupId),
    [selectedYear, tenantGroupId]
  );
  const data = loaded ?? NO_ROWS;

  const monthLabels = data.map(monthLabel);
  const hoursData = data.map((item) => item.totalHours);

  const totalHours = data.reduce((sum, item) => sum + item.totalHours, 0);
  const avgHours = Math.round(totalHours / data.length || 0);
  const peakHours = Math.max(...hoursData);

  return (
    <ChartCard
      title={title}
      height={height}
      loading={loading}
      error={error}
      empty={data.length === 0}
      actions={<YearSelect value={selectedYear} onChange={setSelectedYear} />}
    >
      <Box sx={{ width: '100%', height: height - 100 }}>
        <BarChart
          xAxis={[monthAxis(monthLabels)]}
          yAxis={[isMobile ? {} : { label: 'Hours' }]}
          series={[
            {
              data: hoursData,
              label: `Total Hours (${totalHours})`,
              color: palette.primary.main,
              valueFormatter: (value) => `${value} hours`,
              barLabel: (item) => item.value?.toString()
            }
          ]}
          slotProps={{ barLabel: barLabelOn(palette, '10px') }}
          height={height - 130}
        />
      </Box>

      <ChartStats
        stats={[
          { label: 'Total Hours', value: totalHours },
          { label: 'Avg Hours per Month', value: avgHours },
          { label: 'Peak Hours', value: peakHours }
        ]}
      />
    </ChartCard>
  );
};

export default TotalHoursChart;
