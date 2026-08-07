import { vi } from 'vitest';
import { getStatementSettings, updateStatementSettings } from './statementSettingsService';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

const lastCall = () => (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];

it('fetches the settings and unwraps the envelope', async () => {
  mockFetchOnce({ success: true, data: { ownerNames: ['ALEX SMITH'] } });

  expect(await getStatementSettings()).toEqual({ ownerNames: ['ALEX SMITH'] });
  expect(String(lastCall()[0])).toContain('/statement-settings');
});

it('scopes to a group when one is given', async () => {
  mockFetchOnce({ success: true, data: { ownerNames: [] } });

  await getStatementSettings('g1');

  expect(String(lastCall()[0])).toContain('groupId=g1');
});

it('saves the names via PUT', async () => {
  mockFetchOnce({ success: true, data: { ownerNames: ['ALEX SMITH'] } });

  await updateStatementSettings(['ALEX SMITH'], 'g1');

  const [url, init] = lastCall();
  expect(String(url)).toContain('groupId=g1');
  expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify({ ownerNames: ['ALEX SMITH'] }) });
});

it('sends an empty list to turn name matching off', async () => {
  mockFetchOnce({ success: true, data: { ownerNames: [] } });

  await updateStatementSettings([]);

  expect(String((lastCall()[1] as RequestInit).body)).toBe('{"ownerNames":[]}');
});
