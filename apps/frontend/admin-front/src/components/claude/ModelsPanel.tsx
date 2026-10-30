import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Radio, Typography } from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import { Empty, Panel } from '../ui';
import { describeError } from '../../hooks/useLoad';
import { adminApi } from '../../services/adminApi';
import type { ClaudeKey, ClaudeModelId } from '../../types';

/**
 * Which models people can pick for their assistant, and which one a new
 * assistant starts on. Turning one off moves the assistants using it to the
 * default the next time they answer, and says how many that is before saving.
 */
export function ModelsPanel({ data, onChanged }: { data: ClaudeKey; onChanged: () => void }) {
  const [enabled, setEnabled] = useState<ClaudeModelId[]>(data.models.enabled);
  const [fallback, setFallback] = useState<ClaudeModelId>(data.models.default);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: ClaudeModelId, on: boolean) => {
    const next = on ? [...enabled, id] : enabled.filter((candidate) => candidate !== id);
    setEnabled(next);
    // The default has to be on: if it was just turned off, the first one still on takes over.
    if (!next.includes(fallback) && next[0]) setFallback(next[0]);
  };

  const name = (id: ClaudeModelId) => data.catalog.find((model) => model.id === id)?.name ?? id;
  const moved = data.catalog
    .filter((model) => !enabled.includes(model.id) && data.botCounts[model.id] > 0)
    .map((model) => `${data.botCounts[model.id]} using ${model.name}`);
  const changed =
    fallback !== data.models.default ||
    enabled.length !== data.models.enabled.length ||
    enabled.some((id) => !data.models.enabled.includes(id));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.saveClaudeKey({ models: { enabled, default: fallback } });
      onChanged();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Models"
      description="What people can choose between. They see Fast, Balanced and Best, never the model names."
    >
      {!data.configured ? (
        <Empty>Save a key first.</Empty>
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {data.catalog.map((model) => (
            <Box key={model.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 0.5 }}>
              <FormControlLabel
                sx={{ minWidth: 220 }}
                control={<Checkbox checked={enabled.includes(model.id)} onChange={(event) => toggle(model.id, event.target.checked)} />}
                label={`${model.label} (${model.name})`}
              />
              <Typography sx={{ fontSize: 13.5, color: ink.muted, flex: 1, minWidth: 220 }}>
                ${model.inputPerMTok} in, ${model.outputPerMTok} out per million tokens · {data.botCounts[model.id]} assistant
                {data.botCounts[model.id] === 1 ? '' : 's'}
              </Typography>
              <FormControlLabel
                control={
                  <Radio
                    checked={fallback === model.id}
                    disabled={!enabled.includes(model.id)}
                    onChange={() => setFallback(model.id)}
                    slotProps={{ input: { 'aria-label': `${model.name} is the default` } }}
                  />
                }
                label="Default"
              />
            </Box>
          ))}
          {moved.length > 0 && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              {moved.join(' and ')} will answer with {name(fallback)} instead.
            </Alert>
          )}
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => void save()} disabled={busy || !changed || enabled.length === 0}>
            Save models
          </Button>
        </>
      )}
    </Panel>
  );
}
