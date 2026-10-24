import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  InputAdornment,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import TuneIcon from '@mui/icons-material/Tune';
import ViewListIcon from '@mui/icons-material/ViewList';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventIcon from '@mui/icons-material/Event';
import { useSearchParams } from 'react-router';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { logger } from '@tumbaland/frontend-core';
import { Day, Plan } from '../services/types';
import { useJournalDays } from '../hooks/useJournalDays';
import { getPlan, getPlans } from '../services/plans';
import DayEditorDialog from '../components/DayEditorDialog';
import ActivityTypesDialog from '../components/ActivityTypesDialog';
import JournalCalendar, { CalendarMonth, currentMonth } from '../components/JournalCalendar';
import { dayLabel, monthLabel, todayKey } from '../utils/dates';
import { downloadCsv, journalCsv } from '../utils/journalExport';
import EntryChip from '../components/EntryChip';
import PlanEditorDialog from '../components/PlanEditorDialog';
import PlanRow from '../components/PlanRow';

/** How many upcoming plans the list shows above the logged days. */
const COMING_UP = 5;
/** Bigger pages for the export, so a long history takes few round trips. */
const EXPORT_PAGE_SIZE = 200;

const JournalPage: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    days,
    total,
    totalPages,
    page,
    loading,
    loadingMore,
    error,
    setError,
    typeFilter,
    setTypeFilter,
    search,
    setSearch,
    debouncedSearch,
    types,
    loadTypes,
    fetchPage,
    reload,
    loadMore
  } = useJournalDays(tenantGroupId);
  const [exporting, setExporting] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDate, setEditorDate] = useState(todayKey());
  const [editorDateEditable, setEditorDateEditable] = useState(false);
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);

  // ?view=calendar keeps the calendar across a reload or a link; the list is
  // the default. The month lives here so a trip to the list and back keeps it.
  const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'list';
  const [calendarMonth, setCalendarMonth] = useState<CalendarMonth>(currentMonth);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const setView = (next: 'list' | 'calendar') =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'calendar') params.set('view', 'calendar');
        else params.delete('view');
        return params;
      },
      { replace: true }
    );

  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [planEditorPlan, setPlanEditorPlan] = useState<Plan | null>(null);
  const [planEditorDate, setPlanEditorDate] = useState<string | undefined>(undefined);
  const [comingUp, setComingUp] = useState<Plan[]>([]);

  const loadComingUp = useCallback(async () => {
    try {
      setComingUp(
        await getPlans({
          groupId: tenantGroupId,
          upcoming: true,
          startDate: todayKey(),
          limit: COMING_UP
        })
      );
    } catch (e) {
      logger.error('Failed to load upcoming plans', e);
    }
  }, [tenantGroupId]);

  useEffect(() => {
    void loadComingUp();
  }, [loadComingUp]);

  const openPlan = (plan: Plan | null, date?: string) => {
    setPlanEditorPlan(plan);
    setPlanEditorDate(date);
    setPlanEditorOpen(true);
  };

  const reloadAll = () => {
    void reload();
    void loadComingUp();
    setCalendarRefresh((n) => n + 1);
  };

  const openEditor = (date: string, dateEditable: boolean) => {
    setEditorDate(date);
    setEditorDateEditable(dateEditable);
    setEditorOpen(true);
  };

  // The one way to log: the editor opens on today with its date changeable, so
  // the same button logs today, edits what today already has, or fills in an
  // earlier day. It used to be two buttons, "Log today" and "Other day".
  const openLogDay = () => openEditor(todayKey(), true);

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

  // ?plan=<id> opens that plan on the calendar: how a reminder in the chat
  // links back here. Consumed once, like ?date=.
  const linkedPlan = searchParams.get('plan');
  useEffect(() => {
    if (!linkedPlan) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('plan');
        return next;
      },
      { replace: true }
    );
    getPlan(linkedPlan)
      .then((plan) => {
        const [year, month] = plan.date.split('-').map(Number);
        setCalendarMonth({ year: year!, month: month! - 1 });
        openPlan(plan);
      })
      .catch((e) => {
        logger.error('Failed to open the linked plan', e);
        setError('That plan is not in this journal any more');
      });
  }, [linkedPlan, setSearchParams]);

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

    downloadCsv('journal_export.csv', journalCsv(allDays));
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

  return (
    <Box
      sx={{
        px: { xs: 0, sm: 3 },
        py: { xs: 1.5, sm: 3 },
        maxWidth: 900,
        mx: 'auto'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: { xs: 1.5, sm: 3 }
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.4rem', sm: '2rem' } }}>
            Entries
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {total > 0 ? `${total} day${total === 1 ? '' : 's'} logged` : 'Your days together'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button
            variant="outlined"
            startIcon={<EventIcon />}
            onClick={() => openPlan(null)}
            aria-label="Plan something"
            sx={{
              whiteSpace: 'nowrap',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Plan something
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Plan
            </Box>
          </Button>
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={openLogDay}
            sx={{
              whiteSpace: 'nowrap',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Log a day
          </Button>
        </Box>
      </Box>

      {/* Search and the activity filter share a row that fits a narrow phone;
          the two text actions wrap under them rather than off the screen. */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          mb: { xs: 1.5, sm: 3 }
        }}
      >
        <TextField
          placeholder="Search descriptions…"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 160px', minWidth: 0, maxWidth: { sm: 320 } }}
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
          sx={{ flex: '0 1 150px', minWidth: 0 }}
          label="Activity"
        >
          <MenuItem value="">All activities</MenuItem>
          {types.map((type) => (
            <MenuItem key={type._id} value={type._id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: type.color || '#9e9e9e'
                  }}
                />
                {type.name}
              </Box>
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, next: 'list' | 'calendar' | null) => next && setView(next)}
          >
            <ToggleButton value="list" aria-label="List">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="calendar" aria-label="Calendar">
              <CalendarMonthIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            startIcon={<TuneIcon />}
            onClick={() => setTypesDialogOpen(true)}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Manage types
          </Button>
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
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {view === 'calendar' ? (
        <JournalCalendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          groupId={tenantGroupId}
          typeId={typeFilter || undefined}
          search={debouncedSearch || undefined}
          refreshKey={calendarRefresh}
          onDayClick={(date) => openEditor(date, false)}
          onPlanClick={(plan) => openPlan(plan)}
          onNewPlan={(date) => openPlan(null, date)}
        />
      ) : (
        <>
          {comingUp.length > 0 && (
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <Typography
                variant="overline"
                sx={{
                  color: 'text.secondary',
                  letterSpacing: 1.5,
                  display: 'block',
                  mb: 0.5
                }}
              >
                Coming up
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {comingUp.map((plan) => (
                  <PlanRow key={plan.id} plan={plan} onClick={(p) => openPlan(p)} />
                ))}
              </Box>
            </Box>
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
                <Button variant="contained" startIcon={<AddIcon />} onClick={openLogDay}>
                  Log a day
                </Button>
              )}
            </Box>
          ) : (
            groupedByMonth.map((group) => (
              <Box key={group.month} sx={{ mb: { xs: 2, sm: 3 } }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.secondary',
                    letterSpacing: 1.5,
                    display: 'block',
                    mb: 0.5
                  }}
                >
                  {group.month}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {group.days.map((day) => (
                    <Card
                      key={day.date}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        '&:hover': { borderColor: 'primary.main' }
                      }}
                    >
                      <CardActionArea onClick={() => openEditor(day.date, false)} sx={{ p: { xs: 1.25, sm: 1.5 } }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 1,
                            mb: 0.5
                          }}
                        >
                          <Typography sx={{ fontWeight: 600 }}>{dayLabel(day.date)}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            minWidth: 0
                          }}
                        >
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
        </>
      )}

      {view === 'list' && !loading && page < totalPages && (
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
        onSaved={reloadAll}
      />

      <PlanEditorDialog
        open={planEditorOpen}
        plan={planEditorPlan}
        date={planEditorDate}
        onClose={() => setPlanEditorOpen(false)}
        onSaved={reloadAll}
        onDeleted={reloadAll}
        onLogged={(date) => openEditor(date, false)}
      />

      <ActivityTypesDialog
        open={typesDialogOpen}
        onClose={() => setTypesDialogOpen(false)}
        groupId={tenantGroupId}
        onChanged={() => {
          // Days carry their type's name and colour, so a rename, recolour or
          // delete has to be reflected in the entries already on screen.
          void loadTypes();
          reloadAll();
        }}
      />
    </Box>
  );
};

export default JournalPage;
