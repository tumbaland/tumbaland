import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography
} from '@mui/material';
import { Analytics, CategoryTrend } from '../../services/cashflowService';
import { formatCurrency, formatPct, formatPeriod } from '../../utils/numberUtils';

interface CategoryMoversProps {
  /** Spending categories only — investing has its own place on this page. */
  trends: CategoryTrend[];
  trailing: Analytics['trailing'];
  currency?: string;
}

type Column = 'category' | 'latest' | 'previous' | 'change';

/**
 * A percentage floor for the movers table.
 *
 * Below this the base is too small for a percentage to mean anything: a
 * category that went from 6 € to 710 € is not up 717%, it is a category that
 * did not exist last year and now costs 700 €. The euro change is always the
 * headline; the percentage is a footnote it has to earn.
 */
const PERCENT_FLOOR = 250;

const variance = (c: CategoryTrend): string | null => {
  if (c.previous === 0) return 'new';
  if (c.latest === 0) return 'stopped';
  if (c.previous < PERCENT_FLOOR) return 'from a small base';
  return c.changePct === null ? null : formatPct(c.changePct);
};

/**
 * Which categories moved, and by how much, over the trailing year against the
 * year before.
 *
 * A table rather than the list of chips this used to be on the Trends tab: with
 * four figures per row the columns are what make them comparable down the page,
 * and sorting is the question the list kept prompting and could not answer.
 */
const CategoryMovers: React.FC<CategoryMoversProps> = ({ trends, trailing, currency = 'EUR' }) => {
  // Biggest movers first, which is what the table is for. Ordered by size of
  // change either way: a 4 000 € drop is as big a move as a 4 000 € rise.
  const [column, setColumn] = useState<Column>('change');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const money = (v: number) => formatCurrency(v, currency);

  const sort = (next: Column) => {
    if (next === column) setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setColumn(next);
      setDirection(next === 'category' ? 'asc' : 'desc');
    }
  };

  const rows = useMemo(() => {
    const rank = (c: CategoryTrend) =>
      column === 'latest' ? c.latest : column === 'previous' ? c.previous : Math.abs(c.change);

    const sorted = [...trends].sort((a, b) =>
      column === 'category' ? a.category.localeCompare(b.category) : rank(a) - rank(b)
    );
    return direction === 'desc' ? sorted.reverse() : sorted;
  }, [trends, column, direction]);

  if (rows.length === 0) return null;

  // Comparisons run on trailing twelve-month windows rather than calendar
  // years: in March, "this year" is two months against twelve, and every
  // category would look like it had collapsed.
  const current = trailing?.current;
  const range = current
    ? `${formatPeriod(current.from)}–${formatPeriod(current.to)}${
        trailing?.previous ? ' against the 12 months before' : ''
      }`
    : '';

  const header = (id: Column, label: string, align: 'left' | 'right' = 'right') => (
    <TableCell align={align} sortDirection={column === id ? direction : false}>
      <TableSortLabel
        active={column === id}
        direction={column === id ? direction : 'desc'}
        onClick={() => sort(id)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Biggest movers in spending
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {range}
        </Typography>
        <Box sx={{ overflowX: 'auto', mt: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {header('category', 'Category', 'left')}
                {header('latest', 'Current 12M')}
                {header('previous', 'Previous 12M')}
                {header('change', 'Variance')}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.category} hover>
                  <TableCell>{c.category}</TableCell>
                  <TableCell align="right">{money(c.latest)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                    {money(c.previous)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color: c.change > 0 ? 'error.main' : c.change < 0 ? 'success.main' : 'text.secondary'
                    }}
                  >
                    {c.change >= 0 ? '+' : '−'}{money(Math.abs(c.change))}
                    {variance(c) && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ color: 'text.secondary', fontWeight: 400, ml: 1 }}
                      >
                        {variance(c)}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CategoryMovers;
