import { useState } from 'react';
import {
  Box,
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
import { Empty, LoadState, PageHeader, Panel, StatTile } from '../components/ui';
import { ago, formatCount, formatPercent } from '../format';
import { useLoad } from '../hooks/useLoad';
import { adminApi } from '../services/adminApi';

const RANGES = [30, 90, 365] as const;

/**
 * Connected assistants across every account: which apps are connected and how
 * busy they are, and which tools hand the model the most text.
 *
 * The tools are listed by the tokens they cost, because a tool result stays in
 * the conversation and is sent again with every message after it. The one at
 * the top is the one whose answers are worth making smaller.
 */
export default function AssistantsPage() {
  const [days, setDays] = useState<number>(30);
  const state = useLoad(() => adminApi.assistants(days), [days]);

  return (
    <>
      <PageHeader
        title="Assistants"
        description="Connected apps and what they do for people. Tokens are an estimate, four characters to a token."
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
        {(data) => (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.5 }}>
              <StatTile label="Calls" value={formatCount(data.totals.calls)} hint={`in ${data.windowDays} days`} />
              <StatTile label="Accounts" value={formatCount(data.totals.accounts)} hint="with an assistant at work" />
              <StatTile label="Tokens" value={formatCount(data.totals.tokens)} hint="handed to the model" />
              <StatTile
                label="Failed"
                value={data.totals.calls === 0 ? '-' : formatPercent(data.totals.failed / data.totals.calls)}
                hint={`${formatCount(data.totals.failed)} calls`}
              />
            </Box>

            <Panel title="Apps" description="Every app that has been registered, with the accounts connected to it.">
              {data.clients.length === 0 ? (
                <Empty>No assistant has connected yet.</Empty>
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Assistant apps">
                    <TableHead>
                      <TableRow>
                        <TableCell>App</TableCell>
                        <TableCell align="right">Connected accounts</TableCell>
                        <TableCell align="right">Accounts at work</TableCell>
                        <TableCell align="right">Calls</TableCell>
                        <TableCell align="right">Failed</TableCell>
                        <TableCell align="right">Tokens</TableCell>
                        <TableCell>Last call</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.clients.map((client) => (
                        <TableRow key={client.clientId}>
                          <TableCell>{client.name}</TableCell>
                          <TableCell align="right">{formatCount(client.connectedAccounts)}</TableCell>
                          <TableCell align="right">{formatCount(client.activeAccounts)}</TableCell>
                          <TableCell align="right">{formatCount(client.calls)}</TableCell>
                          <TableCell align="right">{formatCount(client.failed)}</TableCell>
                          <TableCell align="right">{formatCount(client.tokens)}</TableCell>
                          <TableCell>{ago(client.lastCallAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Typography sx={{ fontSize: 13, color: ink.muted, mt: 1.5 }}>
                {formatCount(data.keys.live)} {data.keys.live === 1 ? 'API key is' : 'API keys are'} in use, and keys did{' '}
                {formatCount(data.keys.actionsInWindow)} {data.keys.actionsInWindow === 1 ? 'thing' : 'things'} in these{' '}
                {data.windowDays} days.
              </Typography>
            </Panel>

            <Panel title="Tools" description="Most tokens first. A long answer is paid for again on every message after it.">
              {data.tools.length === 0 ? (
                <Empty>No tool has been called in this time.</Empty>
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Assistant tools">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tool</TableCell>
                        <TableCell align="right">Calls</TableCell>
                        <TableCell align="right">Tokens</TableCell>
                        <TableCell align="right">Per call</TableCell>
                        <TableCell align="right">Failed</TableCell>
                        <TableCell align="right">Average time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.tools.map((tool) => (
                        <TableRow key={tool.name}>
                          <TableCell>{tool.name}</TableCell>
                          <TableCell align="right">{formatCount(tool.calls)}</TableCell>
                          <TableCell align="right">{formatCount(tool.tokens)}</TableCell>
                          <TableCell align="right">{formatCount(tool.avgTokens)}</TableCell>
                          <TableCell align="right">
                            {formatCount(tool.failed)} ({formatPercent(tool.failureRate)})
                          </TableCell>
                          <TableCell align="right">{formatCount(tool.avgMs)} ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Panel>
          </Box>
        )}
      </LoadState>
    </>
  );
}
