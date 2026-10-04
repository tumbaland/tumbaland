import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('../../services/apiKeyService', async () => {
  const actual = await vi.importActual<typeof import('../../services/apiKeyService')>('../../services/apiKeyService');
  return { ...actual, connectionService: { list: vi.fn(), revoke: vi.fn() } };
});

vi.mock('@tumbaland/frontend-core', async () => {
  const actual = await vi.importActual('@tumbaland/frontend-core');
  return { ...actual, logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } };
});

import { connectionService, Connection } from '../../services/apiKeyService';
import ConnectionsTab from './ConnectionsTab';

const mocked = connectionService as unknown as {
  list: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
};

const connection = (over: Partial<Connection> = {}): Connection => ({
  id: 'c1',
  clientId: 'tmb-client-abc',
  clientName: 'Claude',
  scopes: ['relationship:read', 'relationship:write'],
  tenants: ['personal'],
  defaultTenant: 'personal',
  tenantNames: { personal: 'My own data' },
  createdAt: '2026-09-01T00:00:00.000Z',
  lastRenewedAt: null,
  revokedAt: null,
  ...over
});

const renderSection = async (connections: Connection[] = [connection()]) => {
  mocked.list.mockResolvedValue(connections);
  const result = render(<ConnectionsTab />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  return result;
};

beforeEach(() => vi.clearAllMocks());

it('points at the connector flow when nothing is connected', async () => {
  await renderSection([]);
  expect(screen.getByText(/Nothing connected yet/)).toBeInTheDocument();
});

it('lists a connected assistant with what it may do', async () => {
  await renderSection();

  expect(screen.getByText('Claude')).toBeInTheDocument();
  expect(screen.getByText('relationship:read')).toBeInTheDocument();
  expect(screen.getByText('relationship:write')).toBeInTheDocument();
});

it('offers no way to reveal anything, because there is no secret', async () => {
  // A connection was approved on a consent screen; unlike an API key there is
  // nothing the user ever copied, so a reveal control would be meaningless.
  await renderSection();

  expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
});

it('names every journal the assistant can reach, as the user saw them', async () => {
  await renderSection([
    connection({
      tenants: ['personal', 'g1'],
      tenantNames: { personal: 'My own data', g1: 'Irja & Tom' }
    })
  ]);

  expect(screen.getByText('My own data · Irja & Tom')).toBeInTheDocument();
});

it('labels a personal connection as such', async () => {
  await renderSection();
  expect(screen.getByText('My own data')).toBeInTheDocument();
});

it('disconnects by client, and removes it from the list', async () => {
  const user = userEvent.setup();
  mocked.revoke.mockResolvedValue(undefined);
  await renderSection();

  await user.click(screen.getByRole('button', { name: 'Disconnect' }));

  expect(mocked.revoke).toHaveBeenCalledWith('tmb-client-abc');
  await waitFor(() => expect(screen.queryByText('Claude')).not.toBeInTheDocument());
});

it('is honest that revoking is not instant', async () => {
  const user = userEvent.setup();
  mocked.revoke.mockResolvedValue(undefined);
  await renderSection();

  await user.click(screen.getByRole('button', { name: 'Disconnect' }));

  // Access tokens are stateless and live an hour; implying an immediate cut
  // would be a lie the user could act on.
  expect(await screen.findByText(/within the hour/)).toBeInTheDocument();
});

it('hides a connection that was already revoked', async () => {
  await renderSection([connection({ revokedAt: '2026-09-02T00:00:00.000Z' })]);

  expect(screen.queryByText('Claude')).not.toBeInTheDocument();
  expect(screen.getByText(/Nothing connected yet/)).toBeInTheDocument();
});

it('reports a failed revoke without dropping the connection from the list', async () => {
  const user = userEvent.setup();
  mocked.revoke.mockRejectedValue(new Error('boom'));
  await renderSection();

  await user.click(screen.getByRole('button', { name: 'Disconnect' }));

  expect(await screen.findByText(/Could not disconnect/)).toBeInTheDocument();
  expect(screen.getByText('Claude')).toBeInTheDocument();
});

it('reports a failed load', async () => {
  mocked.list.mockRejectedValue(new Error('boom'));
  render(<ConnectionsTab />);

  expect(await screen.findByText(/Could not load connected apps/)).toBeInTheDocument();
});
