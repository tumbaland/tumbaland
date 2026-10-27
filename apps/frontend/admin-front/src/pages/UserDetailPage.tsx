import { Link as RouterLink, useLocation, useParams } from 'react-router';
import {
  Box,
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ink } from '@tumbaland/frontend-core';
import { appPath } from '../appBase';
import { CalendarStrip } from '../components/charts/CalendarStrip';
import { ColumnChart } from '../components/charts/ColumnChart';
import { Empty, LoadState, PageHeader, Panel, StatTile } from '../components/ui';
import { UsageBar } from '../components/UsageBar';
import {
  ago,
  countryName,
  formatCount,
  formatDate,
  formatDateTime,
  formatDay,
  formatShortDay,
  moduleLabel,
  platformLabel,
  serviceLabel
} from '../format';
import { useLoad } from '../hooks/useLoad';
import { adminApi } from '../services/adminApi';
import type { QuotaReading, UserDetail } from '../types';

const Scroll = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <TableContainer>
    <Table size="small" aria-label={label}>
      {children}
    </Table>
  </TableContainer>
);

const WHAT_THEY_DID: Record<string, string> = { create: 'Added', update: 'Changed', delete: 'Deleted', read: 'Read' };

function Quota({ quota }: { quota: QuotaReading }) {
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {quota.stale && (
        <Typography sx={{ fontSize: 13, color: 'warning.main' }}>
          The plan could not be looked up, so these limits are the free plan’s and may be wrong.
        </Typography>
      )}
      {quota.meters.map((meter) => (
        <UsageBar
          key={meter.meter}
          label={meter.period === 'ALL' ? meter.label : `${meter.label} (${meter.period})`}
          used={meter.used}
          limit={meter.limit}
          unit={meter.unit}
          metered={meter.metered}
        />
      ))}
    </Box>
  );
}

function Detail({ detail }: { detail: UserDetail }) {
  const { user, visits, modules, quota, apps, assistants } = detail;
  const platforms = Object.entries(visits.platforms).sort((a, b) => b[1] - a[1]);
  const countries = Object.entries(visits.countries).sort((a, b) => b[1] - a[1]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Panel title="Visits" description="The last 90 days, UTC.">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1.5, mb: 2 }}>
          <StatTile label="Days here" value={formatCount(visits.totalActiveDays)} hint="in all" />
          <StatTile
            label="First here"
            value={visits.firstActiveDay ? formatDay(visits.firstActiveDay) : 'Never'}
            hint={`Signed up ${formatDate(user.createdAt)}`}
          />
          <StatTile label="Last signed in" value={ago(user.lastLoginAt)} hint={formatDateTime(user.lastLoginAt)} />
        </Box>
        <CalendarStrip from={visits.from} to={visits.to} days={visits.days} />
        {(platforms.length > 0 || countries.length > 0) && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
            {platforms.map(([platform, count]) => (
              <Chip key={platform} size="small" variant="outlined" label={`${platformLabel(platform)} · ${formatCount(count)}`} />
            ))}
            {countries.map(([country, days]) => (
              <Chip
                key={country}
                size="small"
                variant="outlined"
                label={`${countryName(country)} · ${formatCount(days)} ${days === 1 ? 'day' : 'days'}`}
              />
            ))}
          </Box>
        )}
      </Panel>

      <Panel title="What they use" description="Pages opened, and what they added, changed or deleted themselves. Counts only, never what it was.">
        {modules.opens.length === 0 && modules.writes.length === 0 ? (
          <Empty>Nothing counted yet.</Empty>
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
            <Scroll label="Pages opened">
              <TableHead>
                <TableRow>
                  <TableCell>Opened</TableCell>
                  <TableCell align="right">Times</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modules.opens.map((open) => (
                  <TableRow key={open.module}>
                    <TableCell>{moduleLabel(open.module)}</TableCell>
                    <TableCell align="right">{formatCount(open.opens)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Scroll>
            <Scroll label="What they did">
              <TableHead>
                <TableRow>
                  <TableCell>Part</TableCell>
                  <TableCell>Thing</TableCell>
                  <TableCell>They</TableCell>
                  <TableCell align="right">Times</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modules.writes.map((write) => (
                  <TableRow key={`${write.service}/${write.resource}/${write.action}`}>
                    <TableCell>{serviceLabel(write.service)}</TableCell>
                    <TableCell>{write.resource.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{(WHAT_THEY_DID[write.action] ?? write.action).toLowerCase()}</TableCell>
                    <TableCell align="right">{formatCount(write.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Scroll>
          </Box>
        )}
      </Panel>

      <Panel
        title="Quota"
        description={`Plan: ${quota.own.plan}. Storage and seats in groups they own are counted here too.`}
      >
        <Quota quota={quota.own} />
        {quota.pooled.map((pool) => (
          <Box key={pool.billedTo} sx={{ mt: 3 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: ink.strong }}>
              Paid for by {pool.billedTo}
            </Typography>
            <Typography sx={{ fontSize: 13, color: ink.muted, mb: 1.5 }}>
              In {pool.groups.join(', ')}. Its storage and seats are the owner’s, on their {pool.quota.plan} plan.
            </Typography>
            <Quota quota={pool.quota} />
          </Box>
        ))}
      </Panel>

      <Panel title="Connected apps" description="What can reach this account's data besides the app itself.">
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: ink.strong, mb: 0.5 }}>
          Assistants
        </Typography>
        {apps.connections.length === 0 ? (
          <Empty>No assistant is connected.</Empty>
        ) : (
          <Scroll label="Connected assistants">
            <TableHead>
              <TableRow>
                <TableCell>App</TableCell>
                <TableCell>Connected</TableCell>
                <TableCell>Last renewed</TableCell>
                <TableCell>Can</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apps.connections.map((connection, index) => (
                <TableRow key={`${connection.clientId}-${index}`}>
                  <TableCell>{connection.clientName}</TableCell>
                  <TableCell>{formatDate(connection.grantedAt)}</TableCell>
                  <TableCell>{ago(connection.lastUsedAt)}</TableCell>
                  <TableCell>{connection.scopes.join(', ') || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Scroll>
        )}

        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: ink.strong, mt: 2.5, mb: 0.5 }}>
          API keys
        </Typography>
        {apps.keys.length === 0 ? (
          <Empty>No keys.</Empty>
        ) : (
          <Scroll label="API keys">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Can</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apps.keys.map((key, index) => (
                <TableRow key={`${key.name}-${index}`}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={key.state}
                      color={key.state === 'active' ? 'success' : 'default'}
                      variant={key.state === 'active' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>{ago(key.lastUsedAt)}</TableCell>
                  <TableCell>{key.expiresAt ? formatDate(key.expiresAt) : 'Never'}</TableCell>
                  <TableCell>{key.scopes.join(', ') || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Scroll>
        )}

        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: ink.strong, mt: 2.5, mb: 0.5 }}>
          Signed in on
        </Typography>
        {apps.devices.length === 0 ? (
          <Empty>No device is signed in.</Empty>
        ) : (
          <Scroll label="Devices">
            <TableHead>
              <TableRow>
                <TableCell>Device</TableCell>
                <TableCell>Country</TableCell>
                <TableCell>Since</TableCell>
                <TableCell>Last seen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apps.devices.map((device, index) => (
                <TableRow key={`${device.createdAt}-${index}`}>
                  <TableCell>{device.label}</TableCell>
                  <TableCell>{countryName(device.country) ?? '-'}</TableCell>
                  <TableCell>{formatDate(device.createdAt)}</TableCell>
                  <TableCell>{ago(device.lastSeenAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Scroll>
        )}
      </Panel>

      <Panel
        title="Assistants at work"
        description={`What connected assistants did for this account in the last ${assistants.windowDays} days. Tokens are an estimate.`}
      >
        {assistants.clients.length === 0 && assistants.elsewhere.length === 0 ? (
          <Empty>No assistant has done anything for this account in that time.</Empty>
        ) : (
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <ColumnChart
              title="Assistant calls each day"
              noun="calls"
              columns={assistants.daily.map((day) => ({ label: formatShortDay(day.day), value: day.calls }))}
            />
            <Scroll label="Assistants">
              <TableHead>
                <TableRow>
                  <TableCell>App</TableCell>
                  <TableCell align="right">Calls</TableCell>
                  <TableCell align="right">Failed</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Average time</TableCell>
                  <TableCell>Last call</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assistants.clients.map((client, index) => (
                  <TableRow key={`${client.credentialId}-${index}`}>
                    <TableCell>{client.label}</TableCell>
                    <TableCell align="right">{formatCount(client.calls)}</TableCell>
                    <TableCell align="right">{formatCount(client.failed)}</TableCell>
                    <TableCell align="right">{formatCount(client.tokens)}</TableCell>
                    <TableCell align="right">{formatCount(client.avgMs)} ms</TableCell>
                    <TableCell>{ago(client.lastAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Scroll>
            {assistants.tools.length > 0 && (
              <Scroll label="Tools">
                <TableHead>
                  <TableRow>
                    <TableCell>Tool</TableCell>
                    <TableCell align="right">Calls</TableCell>
                    <TableCell align="right">Failed</TableCell>
                    <TableCell align="right">Tokens</TableCell>
                    <TableCell align="right">Average time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assistants.tools.map((tool) => (
                    <TableRow key={tool.name}>
                      <TableCell>{tool.name}</TableCell>
                      <TableCell align="right">{formatCount(tool.calls)}</TableCell>
                      <TableCell align="right">{formatCount(tool.failed)}</TableCell>
                      <TableCell align="right">{formatCount(tool.tokens)}</TableCell>
                      <TableCell align="right">{formatCount(tool.avgMs)} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Scroll>
            )}
            {assistants.elsewhere.length > 0 && (
              <Typography sx={{ fontSize: 13.5, color: ink.body }}>
                Directly in the services:{' '}
                {assistants.elsewhere
                  .map(
                    (row) =>
                      `${row.actorKind === 'key' ? 'a key' : 'an assistant'} ${row.action === 'read' ? 'read' : row.action === 'create' ? 'added to' : row.action === 'update' ? 'changed' : 'deleted from'} ${serviceLabel(row.service)} ${formatCount(row.count)} ${row.count === 1 ? 'time' : 'times'}`
                  )
                  .join('; ')}
                .
              </Typography>
            )}
          </Box>
        )}
      </Panel>
    </Box>
  );
}

/** One account in detail: when they come, what they use, what it costs, and what is connected. */
export default function UserDetailPage() {
  const { id = '' } = useParams();
  // Back to the list as it was left (its page, sort and search), when it was the way in.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const loaded = useLoad(() => adminApi.user(id), [id]);
  // useLoad keeps the last answer on screen while the next loads, which is right
  // for a re-sort but not for another person: never show one account under
  // another's address, nor beside an error about it.
  const state = loaded.data && loaded.data.user.id !== id ? { ...loaded, data: null } : loaded;

  return (
    <>
      <Link
        component={RouterLink}
        to={from ?? appPath('/users')}
        underline="hover"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 14, mb: 1.5 }}
      >
        <ArrowBackIcon fontSize="inherit" /> All users
      </Link>

      <LoadState state={state}>
        {(detail) => (
          <>
            <PageHeader
              title={detail.user.name ?? detail.user.email}
              description={
                <>
                  {detail.user.name && <>{detail.user.email}. </>}
                  Signed up {formatDate(detail.user.createdAt)}.
                </>
              }
              action={
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {detail.user.roles.includes('admin') && <Chip label="Admin" />}
                  {detail.user.deletion.state === 'requested' && (
                    <Chip
                      component={RouterLink}
                      to={appPath('/deletions')}
                      clickable
                      color="warning"
                      label={`Asked to be deleted ${ago(detail.user.deletion.requestedAt).toLowerCase()}`}
                    />
                  )}
                  {detail.user.deletion.state === 'closed' && (
                    <Chip
                      component={RouterLink}
                      to={appPath('/deletions')}
                      clickable
                      color="error"
                      label={`Closed ${ago(detail.user.deletion.confirmedAt).toLowerCase()}`}
                    />
                  )}
                </Box>
              }
            />
            <Detail detail={detail} />
          </>
        )}
      </LoadState>
    </>
  );
}
