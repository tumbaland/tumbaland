import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { Add, Edit, DeleteOutlined, Visibility, Person, VpnKey, SmartToy } from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import {
  ActorKind,
  AuditAction,
  AuditEntry,
  auditService
} from '../../services/auditService';

/** What each kind of actor looks like, so a row is scannable before it is read. */
const ACTORS: Record<ActorKind, { label: string; icon: React.ReactElement; color: 'default' | 'info' | 'warning' }> = {
  person: { label: 'You', icon: <Person fontSize="small" />, color: 'default' },
  assistant: { label: 'Assistant', icon: <SmartToy fontSize="small" />, color: 'info' },
  key: { label: 'API key', icon: <VpnKey fontSize="small" />, color: 'warning' }
};

/**
 * The trail spans every service, so it needs a way to narrow to one.
 *
 * Named for what they are to a person rather than for the process that wrote
 * them: nobody thinks of their photos as "album-service".
 */
const AREAS = [
  { value: 'all', label: 'All' },
  { value: 'relationship-service', label: 'Journal' },
  { value: 'album-service', label: 'Photos' },
  { value: 'finance-service', label: 'Finance' },
  { value: 'auth-service', label: 'Account' }
] as const;

const ACTIONS: Record<AuditAction, { verb: string; icon: React.ReactElement; color: string }> = {
  create: { verb: 'added', icon: <Add fontSize="small" />, color: 'success.main' },
  update: { verb: 'changed', icon: <Edit fontSize="small" />, color: 'warning.main' },
  delete: { verb: 'removed', icon: <DeleteOutlined fontSize="small" />, color: 'error.main' },
  read: { verb: 'read', icon: <Visibility fontSize="small" />, color: 'text.secondary' }
};

/** Singular, and without the underscores the API stores them with. */
const resourceName = (resource: string): string =>
  resource.replace(/_/g, ' ').replace(/ies$/, 'y').replace(/s$/, '');

/** "an activity", "a photo" — a row that reads as a sentence or not at all. */
const withArticle = (noun: string): string =>
  `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

/**
 * A stored value, as a person would read it.
 *
 * Absence is spelled out rather than left blank: a change from nothing to
 * something and a change nobody can see are different, and an empty cell reads
 * as the second.
 */
function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'nothing';
  if (typeof value === 'string') {
    const asDate = /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
    return asDate && !isNaN(asDate.getTime())
      ? asDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : `“${value}”`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** The fields worth showing from a stored document, in the order they read best. */
const SUMMARY_FIELDS = ['description', 'hours', 'date', 'name'];

function summarize(snapshot: Record<string, unknown>): string {
  const parts = SUMMARY_FIELDS.filter((field) => snapshot[field] !== undefined && snapshot[field] !== '')
    .map((field) => (field === 'hours' ? `${snapshot[field]}h` : displayValue(snapshot[field])));
  return parts.join(' · ');
}

const dayHeading = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * What happened in this account, and who did it.
 *
 * Sits beside API keys and connected apps because it answers the other half of
 * the same question: those pages say what *can* reach the data, this one says
 * what actually did. The distinction the whole page is built around is person
 * against software — an entry you typed and one an assistant wrote are
 * indistinguishable in the journal itself, and this is the only place they are
 * told apart.
 */
const ActivityTab: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actorKind, setActorKind] = useState<ActorKind | 'all'>('all');
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const [area, setArea] = useState<string>('all');

  const load = useCallback(
    async (wanted: number, append: boolean) => {
      try {
        setLoading(true);
        setError(null);
        const result = await auditService.list({
          page: wanted,
          actorKind: actorKind === 'all' ? undefined : actorKind,
          action: action === 'all' ? undefined : action,
          service: area === 'all' ? undefined : area
        });

        setEntries((current) => (append ? [...current, ...result.events] : result.events));
        setPage(result.page);
        setTotalPages(result.totalPages);
        setTotal(result.total);
      } catch (caught) {
        logger.error('Failed to load the activity trail', { error: caught });
        setError('Could not load your activity.');
      } finally {
        setLoading(false);
      }
    },
    [actorKind, action, area]
  );

  // Filters restart the listing rather than appending into it, so the page
  // never shows two different queries stacked on top of each other.
  useEffect(() => {
    load(1, false);
  }, [load]);

  const grouped = entries.reduce<Record<string, AuditEntry[]>>((days, entry) => {
    const key = dayHeading(entry.at);
    (days[key] ??= []).push(entry);
    return days;
  }, {});

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Activity
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Everything that has changed your journal, photos, finances or account, and everything an
        assistant has read from them. Your own browsing is not recorded. Kept for a year.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={actorKind}
          onChange={(_event, value) => value && setActorKind(value)}
          aria-label="who"
        >
          <ToggleButton value="all">Everyone</ToggleButton>
          <ToggleButton value="person">You</ToggleButton>
          <ToggleButton value="assistant">Assistants</ToggleButton>
          <ToggleButton value="key">API keys</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={area}
          onChange={(_event, value) => value && setArea(value)}
          aria-label="area"
        >
          {AREAS.map(({ value, label }) => (
            <ToggleButton key={value} value={value}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={action}
          onChange={(_event, value) => value && setAction(value)}
          aria-label="what"
        >
          <ToggleButton value="all">Everything</ToggleButton>
          <ToggleButton value="create">Added</ToggleButton>
          <ToggleButton value="update">Changed</ToggleButton>
          <ToggleButton value="delete">Removed</ToggleButton>
          <ToggleButton value="read">Read</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Said here rather than left as an empty result: nothing recorded and
          nothing to record look identical otherwise. */}
      {actorKind === 'person' && action === 'read' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your own reading is never recorded — only what software read.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && entries.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && entries.length === 0 && !error && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nothing recorded yet.
          </Typography>
        </Paper>
      )}

      {Object.entries(grouped).map(([day, dayEntries]) => (
        <Box key={day} sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.6 }}
          >
            {day}
          </Typography>

          <Stack spacing={1}>
            {dayEntries.map((entry) => {
              const actor = ACTORS[entry.actorKind];
              const verb = ACTIONS[entry.action];

              return (
                <Paper key={entry.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ color: verb.color, display: 'flex' }}>{verb.icon}</Box>

                    <Chip
                      size="small"
                      icon={actor.icon}
                      color={actor.color}
                      variant={entry.actorKind === 'person' ? 'outlined' : 'filled'}
                      // The credential's own name, so a row reads "Claude"
                      // rather than an opaque id.
                      label={entry.actorLabel}
                    />

                    <Typography variant="body2">
                      {verb.verb}{' '}
                      {entry.action === 'read'
                        ? `${entry.count ?? 'some'} ${entry.resource.replace(/_/g, ' ')}`
                        : withArticle(resourceName(entry.resource))}
                    </Typography>

                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {time(entry.at)}
                    </Typography>
                  </Box>

                  {entry.changes && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      {Object.entries(entry.changes).map(([field, { from, to }]) => (
                        <Typography
                          key={field}
                          variant="caption"
                          sx={{ display: 'block', color: 'text.secondary', fontFamily: 'monospace' }}
                        >
                          {field}: {displayValue(from)} → {displayValue(to)}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  {entry.snapshot && summarize(entry.snapshot) && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', mt: 0.5, pl: 4, color: 'text.secondary' }}
                    >
                      {summarize(entry.snapshot)}
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </Box>
      ))}

      {page < totalPages && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button onClick={() => load(page + 1, true)} disabled={loading}>
            {loading ? 'Loading…' : `Show more (${total - entries.length} left)`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ActivityTab;
