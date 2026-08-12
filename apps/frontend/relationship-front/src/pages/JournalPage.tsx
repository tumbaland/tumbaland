import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
  TextField,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import PlaceIcon from '@mui/icons-material/Place';
import TuneIcon from '@mui/icons-material/Tune';
import { useSearchParams } from 'react-router';
import { useTenantFilter } from '@tumbaland/components';
import { logger } from '@tumbaland/frontend-core';
import { ActivityType, Day, DaysResponse } from '../services/types';
import { getDays } from '../services/days';
import { getActivityTypes } from '../services/activityTypes';
import DayEditorDialog from '../components/DayEditorDialog';
import ActivityTypesDialog from '../components/ActivityTypesDialog';

const PAGE_SIZE = 30;
/** Bigger pages for the export, so a long history takes few round trips. */
const EXPORT_PAGE_SIZE = 200;

const todayKey = () => new Date().toISOString().slice(0, 10);

const dayLabel = (date: string): string => {
  const d = new Date(`${date}T00:00:00`);
  const today = new Date(`${todayKey()}T00:00:00`);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long' });
};

const monthLabel = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** One entry rendered inside a day card. */
const EntryChip: React.FC<{ entry: Day['entries'][number] }> = ({ entry }) => {
  const type = entry.type;
  const value =
    type?.valueType === 'number'
      ? entry.hours !== undefined && entry.hours !== null
        ? `${entry.hours}h`
        : undefined
      : entry.description || undefined;
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: type?.color || '#9e9e9e',
            ml: '6px !important'
          }}
        />
      }
      label={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
          <span>
            <strong>{type?.name || 'Unknown'}</strong>
            {value ? ` · ${value}` : ''}
          </span>
          {entry.location && (
            <>
              <PlaceIcon sx={{ fontSize: 13, ml: 0.5, color: 'text.disabled' }} />
              <span>{entry.location.label}</span>
            </>
          )}
        </Box>
      }
      sx={{ borderColor: 'divider', bgcolor: 'transparent', maxWidth: '100%' }}
    />
  );
};

const JournalPage: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const [searchParams, setSearchParams] = useSearchParams();

  const [days, setDays] = useState<Day[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [types, setTypes] = useState<ActivityType[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDate, setEditorDate] = useState(todayKey());
  const [editorDateEditable, setEditorDateEditable] = useState(false);
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  const loadTypes = useCallback(async () => {
    try {
      const response = await getActivityTypes({ groupId: tenantGroupId });
      setTypes(response.data);
      // A type the filter points at may have just been deleted in the manage
      // dialog — fall back to "all" so the list doesn't come back empty.
      setTypeFilter((current) => (current && !response.data.some((t) => t._id === current) ? '' : current));
    } catch (e) {
      logger.error('Failed to load activity types', e);
    }
  }, [tenantGroupId]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const fetchPage = useCallback(
    async (pageToLoad: number, limit: number = PAGE_SIZE): Promise<DaysResponse> =>
      getDays({
        page: pageToLoad,
        limit,
        groupId: tenantGroupId,
        typeId: typeFilter || undefined,
        search: debouncedSearch || undefined
      }),
    [tenantGroupId, typeFilter, debouncedSearch]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(1);
      setDays(result.days);
      setPage(1);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (e) {
      logger.error('Failed to load days', e);
      setError('Failed to load the journal');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await fetchPage(page + 1);
      setDays((prev) => [...prev, ...result.days]);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (e) {
      logger.error('Failed to load more days', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const openEditor = (date: string, dateEditable: boolean) => {
    setEditorDate(date);
    setEditorDateEditable(dateEditable);
    setEditorOpen(true);
  };

  // ?date=YYYY-MM-DD opens that day straight away — how the map's pin popups
  // link back into the journal. Consumed once so a later close doesn't reopen.
  const linkedDate = searchParams.get('date');
  useEffect(() => {
    if (!linkedDate || !/^\d{4}-\d{2}-\d{2}$/.test(linkedDate)) return;
    setEditorDate(linkedDate);
    setEditorDateEditable(false);
    setEditorOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('date');
        return next;
      },
      { replace: true }
    );
  }, [linkedDate, setSearchParams]);

  /**
   * Exports every day matching the current filters, not just the pages already
   * scrolled into view — it re-fetches the full set rather than serialising
   * component state, which would silently export 30 days or 60 depending on
   * how many times "Load older days" had been pressed.
   */
  const handleExportCSV = async () => {
    setExporting(true);
    setError(null);

    let allDays: Day[];
    try {
      const first = await fetchPage(1, EXPORT_PAGE_SIZE);
      allDays = first.days;
      for (let nextPage = 2; nextPage <= first.totalPages; nextPage++) {
        allDays = allDays.concat((await fetchPage(nextPage, EXPORT_PAGE_SIZE)).days);
      }
    } catch (e) {
      logger.error('Failed to export the journal', e);
      setError('Failed to export the journal');
      setExporting(false);
      return;
    }

    const rows = [['Date', 'Activity', 'Description', 'Hours', 'Place', 'Latitude', 'Longitude']];
    for (const day of allDays) {
      for (const entry of day.entries) {
        rows.push([
          day.date,
          entry.type?.name || '',
          (entry.description || '').replace(/"/g, '""'),
          entry.hours !== undefined && entry.hours !== null ? String(entry.hours) : '',
          (entry.location?.label || '').replace(/"/g, '""'),
          entry.location ? String(entry.location.lat) : '',
          entry.location ? String(entry.location.lng) : ''
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'journal_export.csv';
    link.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  // group loaded days by month for section headers
  const groupedByMonth = useMemo(() => {
    const groups: Array<{ month: string; days: Day[] }> = [];
    for (const day of days) {
      const month = monthLabel(day.date);
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.days.push(day);
      else groups.push({ month, days: [day] });
    }
    return groups;
  }, [days]);

  const hasToday = days.some((d) => d.date === todayKey());

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Journal
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {total > 0 ? `${total} day${total === 1 ? '' : 's'} logged` : 'Your days together'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button
            variant={hasToday ? 'outlined' : 'contained'}
            startIcon={<AddIcon />}
            onClick={() => openEditor(todayKey(), false)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {hasToday ? "Edit today's log" : 'Log today'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditCalendarIcon />}
            onClick={() => openEditor(todayKey(), true)}
            sx={{ textTransform: 'none' }}
          >
            Other day
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search descriptions…"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 180, maxWidth: 320 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }
          }}
        />
        <TextField
          select
          size="small"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          sx={{ minWidth: 160 }}
          label="Activity"
        >
          <MenuItem value="">All activities</MenuItem>
          {types.map((type) => (
            <MenuItem key={type._id} value={type._id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: type.color || '#9e9e9e' }} />
                {type.name}
              </Box>
            </MenuItem>
          ))}
        </TextField>
        <Button
          startIcon={<TuneIcon />}
          onClick={() => setTypesDialogOpen(true)}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          Manage types
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<DownloadIcon />}
          onClick={() => void handleExportCSV()}
          disabled={days.length === 0 || exporting}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : days.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" sx={{ color: 'text.secondary' }} gutterBottom>
            {debouncedSearch || typeFilter ? 'No days match these filters' : 'Nothing logged yet'}
          </Typography>
          {!debouncedSearch && !typeFilter && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEditor(todayKey(), false)}>
              Log today
            </Button>
          )}
        </Box>
      ) : (
        groupedByMonth.map((group) => (
          <Box key={group.month} sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', letterSpacing: 1.5, display: 'block', mb: 1 }}
            >
              {group.month}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {group.days.map((day) => (
                <Card
                  key={day.date}
                  variant="outlined"
                  sx={{ borderRadius: 2, '&:hover': { borderColor: 'primary.main' } }}
                >
                  <CardActionArea onClick={() => openEditor(day.date, false)} sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75 }}>
                      <Typography sx={{ fontWeight: 600 }}>{dayLabel(day.date)}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {day.entries.map((entry) => (
                        <EntryChip key={entry._id} entry={entry} />
                      ))}
                    </Box>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Box>
        ))
      )}

      {!loading && page < totalPages && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <Button onClick={loadMore} disabled={loadingMore} variant="outlined" sx={{ textTransform: 'none' }}>
            {loadingMore ? 'Loading…' : 'Load older days'}
          </Button>
        </Box>
      )}

      <DayEditorDialog
        open={editorOpen}
        date={editorDate}
        dateEditable={editorDateEditable}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void reload()}
      />

      <ActivityTypesDialog
        open={typesDialogOpen}
        onClose={() => setTypesDialogOpen(false)}
        groupId={tenantGroupId}
        onChanged={() => {
          // Days carry their type's name and colour, so a rename, recolour or
          // delete has to be reflected in the entries already on screen.
          void loadTypes();
          void reload();
        }}
      />
    </Box>
  );
};

export default JournalPage;
