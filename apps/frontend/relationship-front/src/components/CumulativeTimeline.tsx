import React, { useEffect, useState } from 'react';
import { useActivePalette, useTenantFilter } from '@tumbaland/frontend-core';
import { Box, Chip, useTheme, useMediaQuery } from '@mui/material';
import { LineChart } from '@mui/x-charts';
import { useAsyncData } from '../hooks/useAsyncData';
import { getCumulativeTimelineData, CumulativeTimelineData } from '../services/statistics';
import { getActivityTypes } from '../services/activityTypes';
import { ActivityType } from '../services/types';
import { ChartCard, ChartStats, YearSelect, chipColors } from './ChartCard';

// Stable stand-ins until the first answer arrives, so memos keyed on them hold still.
const NO_ROWS: CumulativeTimelineData[] = [];
const NO_TYPES: ActivityType[] = [];

const TOTAL = 'total';

interface CumulativeTimelineProps {
  title?: string;
  year?: number;
  height?: number;
}

const CumulativeTimeline: React.FC<CumulativeTimelineProps> = ({
  title = 'Cumulative Activity Timeline',
  year,
  height = 400
}) => {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const palette = useActivePalette();
  const totalColor = palette.primary.main;
  const untypedColor = palette.grey[600];

  const tenantGroupId = useTenantFilter();

  const { data: loaded, loading, error } = useAsyncData(async () => {
    const [timeline, types] = await Promise.all([
      getCumulativeTimelineData(selectedYear, tenantGroupId),
      getActivityTypes({ groupId: tenantGroupId })
    ]);
    return { timeline, types: types.data };
  }, [selectedYear, tenantGroupId]);
  const data = loaded?.timeline ?? NO_ROWS;
  const activityTypes = loaded?.types ?? NO_TYPES;

  // Every line starts shown; a new set of types (another group) starts over.
  useEffect(() => {
    setSelectedLines(activityTypes.filter((type) => type.slug !== TOTAL).map((type) => type.slug));
  }, [activityTypes]);

  const toggleLine = (slug: string) => {
    setSelectedLines((prev) => (prev.includes(slug) ? prev.filter((line) => line !== slug) : [...prev, slug]));
  };

  const lineChip = (key: string, label: string, slug: string, color: string) => {
    const on = selectedLines.includes(slug);
    return (
      <Chip
        key={key}
        label={label}
        size="small"
        clickable
        onClick={() => toggleLine(slug)}
        sx={{
          // A line that is hidden greys out: still there to click, no longer competing.
          ...(on ? chipColors(palette, color) : { backgroundColor: 'action.selected', color: 'text.secondary' }),
          '& .MuiChip-label': { fontSize: '0.75rem' }
        }}
      />
    );
  };

  const series = selectedLines.map((slug) => {
    if (slug === TOTAL) {
      return { data: data.map((item) => item.cumulativeActivities), label: 'Total', color: totalColor, showMark: false };
    }
    const type = activityTypes.find((t) => t.slug === slug);
    return {
      // The server carries each type's running count forward, through days without it.
      data: data.map((item) => item.activityBreakdown[slug]?.cumulativeCount || 0),
      label: type?.name || slug,
      color: type?.color || untypedColor,
      showMark: false
    };
  });

  // Show labels at: start, 25%, 50%, 75%, and end
  const keyIndices = [0, 0.25, 0.5, 0.75].map((share) => Math.floor(data.length * share)).concat(data.length - 1);

  // The server sends every calendar day in the range, entries or not, so the
  // days that count are the ones with something logged.
  const totalActivities = data.length > 0 ? data[data.length - 1].cumulativeActivities : 0;
  const activeDays = data.filter((item) => item.dailyActivities > 0);
  const avgPerActiveDay =
    activeDays.length > 0
      ? Math.round(activeDays.reduce((sum, item) => sum + item.dailyActivities, 0) / activeDays.length)
      : 0;

  return (
    <ChartCard
      title={title}
      height={height}
      loading={loading}
      error={error}
      empty={data.length === 0}
      actions={<YearSelect value={selectedYear} onChange={setSelectedYear} />}
    >
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {activityTypes.map((type) => lineChip(type._id, type.name, type.slug, type.color || untypedColor))}
        {lineChip(TOTAL, 'Total', TOTAL, totalColor)}
      </Box>
      <Box sx={{ width: '100%', height: height - 100 }}>
        <LineChart
          xAxis={[
            {
              data: data.map((item) => item.date),
              scaleType: 'point',
              tickLabelInterval: (_, index) => keyIndices.includes(index)
            }
          ]}
          yAxis={[{ label: isMobile ? undefined : 'Cumulative Activities' }]}
          series={series}
          height={height - 80}
          margin={{ top: 10, right: 15, bottom: 10, left: isMobile ? 15 : 50 }}
          disableAxisListener
        />
      </Box>
      <ChartStats
        // The line chart runs taller than its box; this clears it.
        sx={{ mt: isMobile ? 14 : 8, pt: isMobile ? 1 : 2, gap: isMobile ? 1 : 2 }}
        stats={[
          { label: 'Total Activities', value: totalActivities },
          { label: 'Active Days', value: activeDays.length },
          { label: 'Avg Per Active Day', value: avgPerActiveDay }
        ]}
      />
    </ChartCard>
  );
};

export default CumulativeTimeline;
