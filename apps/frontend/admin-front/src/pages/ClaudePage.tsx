import { Box } from '@mui/material';
import { LoadState, PageHeader } from '../components/ui';
import { KeyPanel } from '../components/claude/KeyPanel';
import { ModelsPanel } from '../components/claude/ModelsPanel';
import { UsagePanel } from '../components/claude/UsagePanel';
import { useLoad } from '../hooks/useLoad';
import { adminApi } from '../services/adminApi';

/**
 * Claude in the chats: the key everyone's assistants run on, which models they
 * can use, and what it costs.
 *
 * A person's allowance comes from their plan, set in Billing, and can be changed
 * for one person from the use table below.
 */
export default function ClaudePage() {
  const state = useLoad(() => adminApi.claudeKey(), []);

  return (
    <>
      <PageHeader title="Claude" description="The key the chat assistants run on, the models people can choose, and what it costs." />
      <LoadState state={state}>
        {(data) => (
          // Keyed on what was saved, so the forms start again from it after a change.
          <Box sx={{ display: 'grid', gap: 2 }} key={`${data.last4}-${data.expiresOn}-${data.models.enabled.join()}-${data.models.default}`}>
            <KeyPanel data={data} onChanged={state.reload} />
            <ModelsPanel data={data} onChanged={state.reload} />
            <UsagePanel catalog={data.catalog} />
          </Box>
        )}
      </LoadState>
    </>
  );
}
