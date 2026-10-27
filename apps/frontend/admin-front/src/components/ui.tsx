import { ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, LinearProgress, Paper, Typography } from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import type { Loaded } from '../hooks/useLoad';

/** One headline figure with what it counts. */
export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minWidth: 0 }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: ink.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 700, color: ink.strong, lineHeight: 1.2, mt: 0.25 }}>{value}</Typography>
      {hint && <Typography sx={{ fontSize: 13, color: ink.muted, mt: 0.25 }}>{hint}</Typography>}
    </Paper>
  );
}

/** A titled block of the page. */
export function Panel({
  title,
  description,
  action,
  children
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" component="section" aria-label={title} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, color: ink.strong }}>
            {title}
          </Typography>
          {description && <Typography sx={{ fontSize: 13.5, color: ink.muted, mt: 0.25 }}>{description}</Typography>}
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

/** A quiet line for a list that has nothing in it. */
export function Empty({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 14, color: ink.muted, py: 1 }}>{children}</Typography>;
}

/**
 * What to show while a page's data is on its way, or when it did not come.
 * Once there is data it stays on screen through a reload, so a change of sort
 * or page does not blank the table.
 */
export function LoadState<T>({ state, children }: { state: Loaded<T>; children: (data: T) => ReactNode }) {
  if (state.data !== null) {
    return (
      <>
        {/* Always 4px tall, so the bar appearing on a re-sort does not move the table. */}
        <Box sx={{ height: 4, mb: 1 }}>
          {state.loading && <LinearProgress aria-label="Updating" sx={{ borderRadius: 2 }} />}
        </Box>
        {state.error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={state.reload}>Try again</Button>}>
            {state.error}
          </Alert>
        )}
        {children(state.data)}
      </>
    );
  }
  if (state.error) {
    return (
      <Alert severity="error" action={<Button onClick={state.reload}>Try again</Button>}>
        {state.error}
      </Alert>
    );
  }
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress size={28} aria-label="Loading" />
    </Box>
  );
}

/** Page title and the line under it. */
export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography component="h1" sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, color: ink.strong }}>
          {title}
        </Typography>
        {description && <Typography sx={{ fontSize: 14, color: ink.muted, mt: 0.5 }}>{description}</Typography>}
      </Box>
      {action}
    </Box>
  );
}
