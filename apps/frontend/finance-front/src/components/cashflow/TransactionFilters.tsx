import React from 'react';
import { Box, TextField, MenuItem, Button, Chip, Typography, Paper } from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import { TransactionQuery, TransactionPage } from '../../services/cashflowService';
import { formatCurrency } from '../../utils/numberUtils';

export interface FilterValues {
  from: string;
  to: string;
  type: '' | 'income' | 'expense';
  category: string;
  search: string;
}

export const EMPTY_FILTERS: FilterValues = { from: '', to: '', type: '', category: '', search: '' };

/** Only the fields that are set, in the shape the query expects. */
export function toQuery(filters: FilterValues): Omit<TransactionQuery, 'groupId' | 'limit' | 'skip'> {
  return {
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {})
  };
}

export const hasAnyFilter = (filters: FilterValues): boolean =>
  Object.values(filters).some((value) => value !== '');

const iso = (d: Date) => d.toISOString().slice(0, 10);
const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export interface Period {
  label: string;
  from: string;
  to: string;
}

/**
 * Ready-made ranges, newest first.
 *
 * A day-by-day calendar is the wrong instrument for a decade of history: the
 * question is almost always "this year" or "2023", and reaching January 2019
 * through a month grid takes dozens of clicks and lands on the wrong month
 * about as often as not. The date fields stay for the rare exact range.
 */
export function periodPresets(years: number[], today = new Date()): Period[] {
  const thisYear = today.getUTCFullYear();
  const monthStart = startOfMonth(today);
  const yearAgo = new Date(Date.UTC(thisYear - 1, today.getUTCMonth(), today.getUTCDate()));

  return [
    { label: 'This month', from: iso(monthStart), to: iso(today) },
    { label: 'Last 12 months', from: iso(yearAgo), to: iso(today) },
    ...[...years]
      .sort((a, b) => b - a)
      .map((year) => ({
        label: String(year),
        from: `${year}-01-01`,
        // A year in progress ends today, so the range never reaches past the
        // data and read back as an empty tail.
        to: year === thisYear ? iso(today) : `${year}-12-31`
      }))
  ];
}

interface TransactionFiltersProps {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  categories: string[];
  /** Totals over everything matching the filter, not just the visible page. */
  totals?: TransactionPage['totals'];
  /** Years with data, which become one-click ranges. */
  years?: number[];
  currency?: string;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  onChange,
  categories,
  totals,
  years = [],
  currency = 'EUR'
}) => {
  const set = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) =>
    onChange({ ...filters, [key]: value });

  const money = (v: number) => formatCurrency(v, currency);

  const presets = periodPresets(years);
  const activePeriod = presets.find((p) => p.from === filters.from && p.to === filters.to);
  const setPeriod = (period: Period) =>
    activePeriod?.label === period.label
      ? onChange({ ...filters, from: '', to: '' })
      : onChange({ ...filters, from: period.from, to: period.to });

  // Bound the native pickers to the data, so the calendar cannot wander off
  // into years that hold nothing.
  const earliest = years.length > 0 ? `${Math.min(...years)}-01-01` : undefined;

  return (
    <Paper
      elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2, mb: 2 }}
    >
      {presets.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
            Period
          </Typography>
          {presets.map((period) => (
            <Chip
              key={period.label}
              size="small"
              label={period.label}
              onClick={() => setPeriod(period)}
              color={activePeriod?.label === period.label ? 'primary' : 'default'}
              variant={activePeriod?.label === period.label ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
          gap: 1.5
        }}
      >
        <TextField
          size="small"
          label="Search"
          placeholder="Merchant or note"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          label="From"
          type="date"
          value={filters.from}
          onChange={(e) => set('from', e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: earliest, max: filters.to || undefined }
          }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={filters.to}
          onChange={(e) => set('to', e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: filters.from || earliest }
          }}
        />
        <TextField
          select
          size="small"
          label="Type"
          value={filters.type}
          onChange={(e) => set('type', e.target.value as FilterValues['type'])}
          slotProps={{ inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="expense">Expense</MenuItem>
          <MenuItem value="income">Income</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Category"
          value={filters.category}
          onChange={(e) => set('category', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category} value={category}>
              {category}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mt: 2 }}>
        {totals && (
          <>
            <Chip size="small" label={`${totals.count.toLocaleString()} matching`} />
            <Typography variant="body2" sx={{ color: 'success.main' }}>
              In {money(totals.income)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              Out {money(totals.expense)}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, color: totals.net >= 0 ? 'success.main' : 'error.main' }}
            >
              Net {money(totals.net)}
            </Typography>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {hasAnyFilter(filters) && (
          <Button size="small" startIcon={<ClearIcon />} onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default TransactionFilters;
