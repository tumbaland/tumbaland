import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import { appPath } from '../appBase';
import { Empty, LoadState, PageHeader } from '../components/ui';
import { ago, formatBytes, formatCount, formatDateTime, formatLimit, moduleLabel } from '../format';
import { useLoad } from '../hooks/useLoad';
import { adminApi } from '../services/adminApi';
import type { UserRow, UserSort } from '../types';

const SORTS: Array<{ value: UserSort; label: string }> = [
  { value: 'lastVisit', label: 'Last here' },
  { value: 'activeDays30', label: 'Days here (30 days)' },
  { value: 'visits30', label: 'Visits (30 days)' },
  { value: 'signup', label: 'Signed up' },
  { value: 'email', label: 'Email' }
];

const DEFAULT_SORT: UserSort = 'lastVisit';

/** How long typing pauses before the list is searched, so each letter is not a request. */
const SEARCH_DELAY_MS = 300;

const plural = (count: number, one: string, many: string): string => `${formatCount(count)} ${count === 1 ? one : many}`;

/**
 * Sort, page and search live in the address, not in component state, so the
 * way back from a person ("All users", or the browser's Back) lands on the same
 * page of the same list rather than the top of a fresh one.
 */
function useListParams() {
  const [params, setParams] = useSearchParams();
  const sort = (SORTS.find((option) => option.value === params.get('sort'))?.value ?? DEFAULT_SORT) as UserSort;
  const page = Math.max(Number.parseInt(params.get('page') ?? '1', 10) || 1, 1);
  const q = params.get('q') ?? '';

  const update = (next: { sort?: UserSort; page?: number; q?: string }) => {
    const merged = { sort, page, q, ...next };
    const search = new URLSearchParams();
    if (merged.sort !== DEFAULT_SORT) search.set('sort', merged.sort);
    if (merged.page > 1) search.set('page', String(merged.page));
    if (merged.q) search.set('q', merged.q);
    // A new search or sort replaces the entry; paging adds one, so Back pages back.
    setParams(search, { replace: next.page === undefined });
  };

  return { sort, page, q, update };
}

function Who({ user, from }: { user: UserRow; from: string }) {
  return (
    <Box sx={{ minWidth: 180 }}>
      <Link
        component={RouterLink}
        to={appPath(`/users/${user.id}`)}
        state={{ from }}
        underline="hover"
        sx={{ fontWeight: 600, color: ink.strong }}
        // The row is clickable too; this keeps one click from navigating twice.
        onClick={(event) => event.stopPropagation()}
      >
        {user.name ?? user.email}
      </Link>
      {user.name && (
        <Typography sx={{ fontSize: 12.5, color: ink.muted }} noWrap>
          {user.email}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.5, mt: user.isAdmin || user.deletion ? 0.5 : 0, flexWrap: 'wrap' }}>
        {user.isAdmin && <Chip size="small" label="Admin" />}
        {user.deletion === 'requested' && <Chip size="small" color="warning" label="Asked to be deleted" />}
        {user.deletion === 'closed' && <Chip size="small" color="error" label="Closed" />}
      </Box>
    </Box>
  );
}

/** Everyone, with how much each has been around. Search, sort and page; a row opens the person. */
export default function UsersPage() {
  const { sort, page, q, update } = useListParams();
  const location = useLocation();
  const navigate = useNavigate();
  const here = `${location.pathname}${location.search}`;

  // What is in the box, which runs ahead of `q` by the length of a pause.
  const [typed, setTyped] = useState(q);
  useEffect(() => setTyped(q), [q]);
  useEffect(() => {
    const next = typed.trim();
    if (next === q) return;
    const timer = setTimeout(() => update({ q: next, page: 1 }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // `update` is a new function every render; the values it closes over are the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, q]);

  const state = useLoad(() => adminApi.users({ sort, page, q: q || undefined }), [sort, page, q]);

  return (
    <>
      <PageHeader title="Users" description="Everyone with an account, and how much they use it." />

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          type="search"
          label="Search"
          placeholder="Name or email"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="user-sort">Sort by</InputLabel>
          <Select
            labelId="user-sort"
            label="Sort by"
            value={sort}
            onChange={(event) => update({ sort: event.target.value as UserSort, page: 1 })}
          >
            {SORTS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <LoadState state={state}>
        {(list) =>
          list.users.length === 0 ? (
            <Empty>{q ? `Nobody matches “${q}”.` : 'No accounts yet.'}</Empty>
          ) : (
            <>
              <TableContainer>
                <Table size="small" aria-label="Users">
                  <TableHead>
                    <TableRow>
                      <TableCell>Person</TableCell>
                      <TableCell>Last here</TableCell>
                      <TableCell align="right">Days (30)</TableCell>
                      <TableCell align="right">Visits (30)</TableCell>
                      <TableCell>Uses most</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell>Storage</TableCell>
                      <TableCell align="right">Assistants, keys</TableCell>
                      <TableCell align="right">Assistant calls (30)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.users.map((user) => (
                      <TableRow
                        key={user.id}
                        hover
                        // The whole row opens the person; the name stays a real
                        // link for the keyboard, a new tab and a screen reader.
                        onClick={() => void navigate(appPath(`/users/${user.id}`), { state: { from: here } })}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Who user={user} from={here} />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={user.lastVisitAt ? formatDateTime(user.lastVisitAt) : 'Never counted'}>
                            <span>{ago(user.lastVisitAt)}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">{formatCount(user.activeDays30)}</TableCell>
                        <TableCell align="right">{formatCount(user.visits30)}</TableCell>
                        <TableCell>
                          {user.topModules.length === 0 ? '-' : user.topModules.map((top) => moduleLabel(top.module)).join(', ')}
                        </TableCell>
                        <TableCell>
                          {user.plan.code}
                          {user.plan.stale && (
                            <Tooltip title="The plan could not be looked up, so this may be wrong.">
                              <span aria-label="plan may be wrong"> ?</span>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatBytes(user.storage.used)} of {formatLimit(user.storage.limit, 'bytes')}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip
                            title={`${plural(user.connections, 'connected assistant', 'connected assistants')}, ${plural(user.keys, 'API key', 'API keys')}`}
                          >
                            <span>
                              {formatCount(user.connections)}, {formatCount(user.keys)}
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">{formatCount(user.assistantCalls30)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Typography sx={{ fontSize: 13, color: ink.muted }}>
                  {plural(list.total, 'account', 'accounts')}
                </Typography>
                {list.totalPages > 1 && (
                  <Pagination count={list.totalPages} page={list.page} onChange={(_event, value) => update({ page: value })} />
                )}
              </Box>
            </>
          )
        }
      </LoadState>
    </>
  );
}
