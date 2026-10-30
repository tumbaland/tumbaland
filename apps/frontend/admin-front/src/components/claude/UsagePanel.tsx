import { useState } from 'react';
import { Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import { Empty, LoadState, Panel, StatTile } from '../ui';
import { formatCount, formatMoney } from '../../format';
import { useLoad } from '../../hooks/useLoad';
import { adminApi } from '../../services/adminApi';
import type { ClaudeKey } from '../../types';
import { AllowanceDialog } from './AllowanceDialog';

const tiles = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.5, mb: 2.5 } as const;

const thisMonth = (): string => new Date().toISOString().slice(0, 7);

/** The month before or after, as YYYY-MM. */
function shift(month: string, by: number): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, index - 1 + by, 1)).toISOString().slice(0, 7);
}

/**
 * What assistants cost this month, by model, by person and by chat.
 *
 * Amounts are estimates from Anthropic's list prices, counted as the replies
 * happened. The bill is the truth: compare the two once a month.
 */
export function UsagePanel({ catalog }: { catalog: ClaudeKey['catalog'] }) {
  const [month, setMonth] = useState(thisMonth);
  const [changing, setChanging] = useState<string | null>(null);
  const state = useLoad(() => adminApi.claudeUsage(month), [month]);
  const modelName = (id: string) => catalog.find((model) => model.id === id)?.name ?? id;

  return (
    <Panel
      title="Use"
      description="Estimated from list prices. The Anthropic bill is the real number."
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button size="small" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month">
            Earlier
          </Button>
          <Typography sx={{ fontSize: 14, fontWeight: 600, minWidth: 72, textAlign: 'center' }}>{month}</Typography>
          <Button size="small" onClick={() => setMonth(shift(month, 1))} disabled={month >= thisMonth()} aria-label="Next month">
            Later
          </Button>
        </Box>
      }
    >
      <LoadState state={state}>
        {(data) => (
          <>
            <Box sx={tiles}>
              <StatTile label="Spent" value={formatMoney(data.totals.units)} hint={`${month}, everyone`} />
              <StatTile label="Replies" value={formatCount(data.totals.replies)} />
              <StatTile label="Failed" value={formatCount(data.totals.failed)} hint="no reply, or declined" />
            </Box>

            {data.totals.replies === 0 ? (
              <Empty>No assistant has answered anyone this month.</Empty>
            ) : (
              <>
                <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: ink.strong, mb: 0.5 }}>
                  By person
                </Typography>
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small" aria-label="Use by person">
                    <TableHead>
                      <TableRow>
                        <TableCell>Person</TableCell>
                        <TableCell align="right">Replies</TableCell>
                        <TableCell align="right">Spent</TableCell>
                        <TableCell align="right">Of their allowance</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.byPerson.map((person) => (
                        <TableRow key={person.email}>
                          <TableCell>{person.email}</TableCell>
                          <TableCell align="right">{formatCount(person.replies)}</TableCell>
                          <TableCell align="right">{formatMoney(person.units)}</TableCell>
                          <TableCell align="right" sx={{ color: person.exhausted ? 'error.main' : undefined }}>
                            {person.percent === null ? 'No limit' : `${person.percent}% of ${formatMoney(person.limit ?? 0)}`}
                            {person.exhausted ? ', used up' : ''}
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => setChanging(person.email)} aria-label={`Change the allowance for ${person.email}`}>
                              Change
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: ink.strong, mb: 0.5 }}>
                  By model
                </Typography>
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small" aria-label="Use by model">
                    <TableBody>
                      {data.byModel.map((row) => (
                        <TableRow key={row.model}>
                          <TableCell>{modelName(row.model)}</TableCell>
                          <TableCell align="right">{formatCount(row.replies)} replies</TableCell>
                          <TableCell align="right">{formatMoney(row.units)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, color: ink.strong, mb: 0.5 }}>
                  By chat
                </Typography>
                <TableContainer>
                  <Table size="small" aria-label="Use by chat">
                    <TableBody>
                      {data.byChat.map((row) => (
                        <TableRow key={row.conversationId}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{row.conversationId}</TableCell>
                          <TableCell align="right">{formatCount(row.replies)} replies</TableCell>
                          <TableCell align="right">{formatMoney(row.units)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </LoadState>
      <AllowanceDialog email={changing} onClose={() => setChanging(null)} onSaved={state.reload} />
    </Panel>
  );
}
