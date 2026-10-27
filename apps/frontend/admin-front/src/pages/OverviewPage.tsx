import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import { appPath } from '../appBase';
import { vizVars } from '../components/charts/colors';
import { ColumnChart } from '../components/charts/ColumnChart';
import { Empty, LoadState, PageHeader, Panel, StatTile } from '../components/ui';
import { formatCount, formatPercent, formatShortDay, moduleLabel } from '../format';
import { useLoad } from '../hooks/useLoad';
import { adminApi } from '../services/adminApi';
import type { Overview } from '../types';

const RANGES = [30, 90, 365] as const;

/** Weeks after signing up that the cohort table reports, as the service computes them. */
const RETENTION_COLUMNS = ['1', '2', '4', '8'] as const;

const tiles = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.5, mb: 2.5 } as const;

/** A table that scrolls inside its own box on a narrow screen instead of widening the page. */
const Scroll = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <TableContainer>
    <Table size="small" aria-label={label}>
      {children}
    </Table>
  </TableContainer>
);

function Cohorts({ cohorts }: { cohorts: Overview['cohorts'] }) {
  if (cohorts.length === 0) return <Empty>Nobody has signed up in the last eight weeks.</Empty>;
  return (
    <Box sx={{ ...vizVars }}>
    <Scroll label="Who came back after signing up">
      <TableHead>
        <TableRow>
          <TableCell>Signed up in the week of</TableCell>
          <TableCell align="right">People</TableCell>
          {RETENTION_COLUMNS.map((weeks) => (
            <TableCell key={weeks} align="right">
              Week {weeks}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {cohorts.map((cohort) => (
          <TableRow key={cohort.week}>
            <TableCell>{formatShortDay(cohort.week)}</TableCell>
            <TableCell align="right">{formatCount(cohort.size)}</TableCell>
            {RETENTION_COLUMNS.map((weeks) => {
              const back = cohort.retention[weeks];
              const share = back === null || cohort.size === 0 ? 0 : back / cohort.size;
              return (
                <TableCell
                  key={weeks}
                  align="right"
                  sx={{
                    // The same pink as the charts, stronger the more came back.
                    bgcolor: back === null ? 'transparent' : `color-mix(in srgb, var(--viz) ${Math.round(share * 45)}%, transparent)`
                  }}
                >
                  {back === null ? <span aria-label="not reached yet">-</span> : `${formatCount(back)} (${formatPercent(share)})`}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Scroll>
    </Box>
  );
}

function Opens({ weeks }: { weeks: Overview['opensByWeek'] }) {
  if (weeks.length === 0) {
    return <Empty>Nothing counted yet. Page opens are recorded from the day tracking shipped.</Empty>;
  }
  const totals = new Map<string, number>();
  for (const week of weeks) {
    for (const [module, opens] of Object.entries(week.modules)) totals.set(module, (totals.get(module) ?? 0) + opens);
  }
  const modules = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([module]) => module);

  return (
    <Scroll label="Pages opened each week">
      <TableHead>
        <TableRow>
          <TableCell>Part of the app</TableCell>
          {weeks.map((week) => (
            <TableCell key={week.week} align="right">
              {formatShortDay(week.week)}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {modules.map((module) => (
          <TableRow key={module}>
            <TableCell>{moduleLabel(module)}</TableCell>
            {weeks.map((week) => (
              <TableCell key={week.week} align="right">
                {week.modules[module] ? formatCount(week.modules[module]) : '-'}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Scroll>
  );
}

/**
 * Who uses Tumbaland, as it is so far: no goals, no targets.
 *
 * Opens with the headline figures, then the same story over time (people each
 * day, new accounts each week), then whether the people who joined came back,
 * and which parts of the app they use.
 */
export default function OverviewPage() {
  const [days, setDays] = useState<number>(30);
  const state = useLoad(() => adminApi.overview(days), [days]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Who uses Tumbaland, as it is so far."
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={days}
            aria-label="Period"
            onChange={(_event, value: number | null) => value && setDays(value)}
          >
            {RANGES.map((range) => (
              <ToggleButton key={range} value={range} sx={{ textTransform: 'none', px: 1.5 }}>
                {range === 365 ? 'A year' : `${range} days`}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      />

      <LoadState state={state}>
        {(overview) => (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={tiles}>
              <StatTile label="Here today" value={formatCount(overview.active.today)} />
              <StatTile label="Last 7 days" value={formatCount(overview.active.last7)} hint="people" />
              <StatTile label="Last 30 days" value={formatCount(overview.active.last30)} hint="people" />
              <StatTile label="Accounts" value={formatCount(overview.accounts.total)} />
              <StatTile
                label="Pairs both here"
                value={`${formatCount(overview.pairs.bothActiveLast7)} of ${formatCount(overview.pairs.total)}`}
                hint="in the last 7 days"
              />
              <StatTile
                label="Deletion requests"
                value={formatCount(overview.accounts.pendingDeletions)}
                hint={
                  overview.accounts.pendingDeletions > 0 ? (
                    <Link component={RouterLink} to={appPath('/deletions')}>
                      Review them
                    </Link>
                  ) : (
                    'none waiting'
                  )
                }
              />
              <StatTile
                label="Assistant calls"
                value={formatCount(overview.assistants.callsThisMonth)}
                hint={`this month, about ${formatCount(overview.assistants.tokensThisMonth)} tokens`}
              />
              <StatTile
                label="Market data"
                value={`${formatCount(overview.marketData.used)} of ${formatCount(overview.marketData.limit)}`}
                hint="calls used today"
              />
            </Box>

            <Panel
              title="People here each day"
              description={
                overview.includesBackfilled
                  ? 'Some days in this period were filled in from what people wrote, so they undercount.'
                  : 'Counted once however many times someone came.'
              }
            >
              <ColumnChart
                title="People here each day"
                noun="people"
                columns={overview.daily.map((day) => ({ label: formatShortDay(day.day), value: day.users }))}
              />
            </Panel>

            <Panel title="New accounts each week" description="Weeks start on Monday.">
              <ColumnChart
                title="New accounts each week"
                noun="accounts"
                columns={overview.signups.map((week) => ({ label: `Week of ${formatShortDay(week.week)}`, value: week.users }))}
              />
            </Panel>

            <Panel
              title="Did they come back"
              description="Of the people who signed up in a week, how many were here again in the weeks after it. A dash is a week that has not happened yet."
            >
              <Cohorts cohorts={overview.cohorts} />
            </Panel>

            <Panel title="What they use" description="Times each part of the app was opened, by week.">
              <Opens weeks={overview.opensByWeek} />
            </Panel>

            <Typography sx={{ fontSize: 12.5, color: ink.muted }}>
              Days are UTC. Counted from {overview.range.from} to {overview.range.to}.
            </Typography>
          </Box>
        )}
      </LoadState>
    </>
  );
}
