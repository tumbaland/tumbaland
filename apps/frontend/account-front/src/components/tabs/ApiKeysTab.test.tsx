import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../../services/apiKeyService', async () => {
  const actual = await vi.importActual<typeof import('../../services/apiKeyService')>(
    '../../services/apiKeyService'
  );
  return {
    ...actual,
    apiKeyService: {
      list: vi.fn(),
      create: vi.fn(),
      reveal: vi.fn(),
      revoke: vi.fn(),
      remove: vi.fn()
    }
  };
});

vi.mock('../../services/groupService', () => ({ getUserGroups: vi.fn() }));

// Rendered inside this tab but tested on its own; stubbed so these tests stay
// about keys.
vi.mock('./ConnectionsSection', () => ({ default: () => <div>connections section</div> }));

vi.mock('@tumbaland/frontend-core', async () => {
  const actual = await vi.importActual('@tumbaland/frontend-core');
  return { ...actual, logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } };
});

import { apiKeyService, ApiKey } from '../../services/apiKeyService';
import { getUserGroups } from '../../services/groupService';
import ApiKeysTab from './ApiKeysTab';

const mockedGetUserGroups = getUserGroups as unknown as ReturnType<typeof vi.fn>;

const mocked = apiKeyService as unknown as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  reveal: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const TOKEN = 'tmb_live_abcdef123456_supersecretvalue';

const key = (over: Partial<ApiKey> = {}): ApiKey => ({
  id: 'k1',
  name: 'Claude Code',
  prefix: 'tmb_live_abcdef123456',
  scopes: ['relationship:read', 'relationship:write'],
  tenants: ['personal'],
  defaultTenant: 'personal',
  createdAt: '2026-09-01T00:00:00.000Z',
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  ...over
});

const renderTab = async (keys: ApiKey[] = [key()]) => {
  mocked.list.mockResolvedValue(keys);
  const result = render(<ApiKeysTab />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  return result;
};

const writeText = vi.fn().mockResolvedValue(undefined);

// jsdom exposes navigator.clipboard as a getter, so it has to be redefined
// rather than assigned.
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  configurable: true
});

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  mockedGetUserGroups.mockResolvedValue([]);
});

it('shows an empty state when there are no keys', async () => {
  await renderTab([]);
  expect(screen.getByText(/No keys yet/)).toBeInTheDocument();
});

it('lists a key masked, never showing the secret until asked', async () => {
  await renderTab();

  expect(screen.getByText('Claude Code')).toBeInTheDocument();
  expect(screen.getByText(/tmb_live_abcdef123456•+/)).toBeInTheDocument();
  expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  expect(mocked.reveal).not.toHaveBeenCalled();
});

it('reveals the key when the eye is clicked', async () => {
  const user = userEvent.setup();
  mocked.reveal.mockResolvedValue(TOKEN);
  await renderTab();

  await user.click(screen.getByRole('button', { name: 'Show Claude Code' }));

  expect(mocked.reveal).toHaveBeenCalledWith('k1');
  expect(await screen.findByText(TOKEN)).toBeInTheDocument();
});

it('hides the key again without a second reveal', async () => {
  const user = userEvent.setup();
  mocked.reveal.mockResolvedValue(TOKEN);
  await renderTab();

  await user.click(screen.getByRole('button', { name: 'Show Claude Code' }));
  await screen.findByText(TOKEN);
  await user.click(screen.getByRole('button', { name: 'Hide Claude Code' }));

  expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  // Hiding is local state, so it must not spend another audited reveal.
  expect(mocked.reveal).toHaveBeenCalledTimes(1);
});

it('reports a failed reveal without breaking the list', async () => {
  const user = userEvent.setup();
  mocked.reveal.mockRejectedValue(new Error('rate limited'));
  await renderTab();

  await user.click(screen.getByRole('button', { name: 'Show Claude Code' }));

  expect(await screen.findByText(/Could not reveal/)).toBeInTheDocument();
  expect(screen.getByText('Claude Code')).toBeInTheDocument();
});

it('only allows copying once the key is visible', async () => {
  const user = userEvent.setup();
  // userEvent.setup() installs its own clipboard stub, so ours is reinstated
  // after it rather than before.
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  mocked.reveal.mockResolvedValue(TOKEN);
  await renderTab();

  expect(screen.getByRole('button', { name: 'Copy Claude Code' })).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'Show Claude Code' }));
  await screen.findByText(TOKEN);
  await user.click(screen.getByRole('button', { name: 'Copy Claude Code' }));

  expect(writeText).toHaveBeenCalledWith(TOKEN);
});

it('shows a newly created key already revealed, without spending a reveal', async () => {
  const user = userEvent.setup();
  mocked.create.mockResolvedValue({ ...key({ id: 'k2', name: 'New Key' }), token: TOKEN });
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));
  await user.type(screen.getByLabelText('Name'), 'New Key');
  await user.click(screen.getByRole('button', { name: 'Create key' }));

  expect(await screen.findByText(TOKEN)).toBeInTheDocument();
  // The create response already carried the token.
  expect(mocked.reveal).not.toHaveBeenCalled();
});

it('creates a personal key by default with the chosen scopes', async () => {
  const user = userEvent.setup();
  mocked.create.mockResolvedValue({ ...key({ id: 'k2' }), token: TOKEN });
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));
  await user.type(screen.getByLabelText('Name'), 'Agent');
  await user.click(screen.getByRole('button', { name: 'Create key' }));

  expect(mocked.create).toHaveBeenCalledWith({
    name: 'Agent',
    scopes: ['relationship:read', 'relationship:write'],
    tenants: ['personal'],
    defaultTenant: 'personal'
  });
});

it('will not create a key with no name or no scopes', async () => {
  const user = userEvent.setup();
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));
  expect(screen.getByRole('button', { name: 'Create key' })).toBeDisabled();

  await user.type(screen.getByLabelText('Name'), 'Agent');
  expect(screen.getByRole('button', { name: 'Create key' })).toBeEnabled();

  // Clearing every scope disables it again — a key that can do nothing is a mistake.
  await user.click(screen.getByLabelText('Relationship — read'));
  await user.click(screen.getByLabelText('Relationship — write'));
  expect(screen.getByRole('button', { name: 'Create key' })).toBeDisabled();
});

it('marks a revoked key and stops offering to revoke it again', async () => {
  await renderTab([key({ revokedAt: '2026-09-02T00:00:00.000Z' })]);

  expect(screen.getByText('Revoked')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
});

it('marks a key whose expiry has passed', async () => {
  await renderTab([key({ expiresAt: '2020-01-01T00:00:00.000Z' })]);
  expect(screen.getByText('Expired')).toBeInTheDocument();
});

it('revokes a key in place', async () => {
  const user = userEvent.setup();
  mocked.revoke.mockResolvedValue(key({ revokedAt: '2026-09-03T00:00:00.000Z' }));
  await renderTab();

  await user.click(screen.getByRole('button', { name: 'Revoke' }));

  expect(mocked.revoke).toHaveBeenCalledWith('k1');
  expect(await screen.findByText('Revoked')).toBeInTheDocument();
});

it('removes a deleted key from the list', async () => {
  const user = userEvent.setup();
  mocked.remove.mockResolvedValue(undefined);
  await renderTab();

  await user.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(screen.queryByText('Claude Code')).not.toBeInTheDocument());
  expect(mocked.remove).toHaveBeenCalledWith('k1');
});

it('says which tenant a key acts in', async () => {
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Us Two' }]);
  await renderTab([key({ tenants: ['g1'], defaultTenant: 'g1' })]);

  expect(await screen.findByText('Us Two')).toBeInTheDocument();
});

it('lists every tenant a key reaches, not just one', async () => {
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Us Two' }]);
  await renderTab([key({ tenants: ['personal', 'g1'], defaultTenant: 'g1' })]);

  expect(await screen.findByText('My own data · Us Two')).toBeInTheDocument();
});

it('labels a personal key as personal', async () => {
  await renderTab([key({ tenants: ['personal'], defaultTenant: 'personal' })]);
  expect(screen.getByText('My own data')).toBeInTheDocument();
});

it('still lists keys when the group service is unreachable', async () => {
  mockedGetUserGroups.mockRejectedValue(new Error('group service down'));
  await renderTab();

  expect(screen.getByText('Claude Code')).toBeInTheDocument();
});

it('offers the user’s groups alongside their own data when creating a key', async () => {
  const user = userEvent.setup();
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Us Two' }]);
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));

  expect(screen.getByRole('checkbox', { name: 'My own data' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Us Two' })).toBeInTheDocument();
});

it('grants a new key every tenant that is ticked', async () => {
  const user = userEvent.setup();
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Us Two' }]);
  mocked.create.mockResolvedValue({
    ...key({ id: 'k2', tenants: ['personal', 'g1'], defaultTenant: 'personal' }),
    token: TOKEN
  });
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));
  await user.type(screen.getByLabelText('Name'), 'Shared agent');
  await user.click(screen.getByRole('checkbox', { name: 'Us Two' }));
  await user.click(screen.getByRole('button', { name: 'Create key' }));

  expect(mocked.create).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Shared agent', tenants: ['personal', 'g1'] })
  );
});

it('always includes the default in the grant, so a key can never reach nothing', async () => {
  const user = userEvent.setup();
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Us Two' }]);
  mocked.create.mockResolvedValue({ ...key({ id: 'k2' }), token: TOKEN });
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));
  await user.type(screen.getByLabelText('Name'), 'Solo');

  // The default's own box is disabled precisely so it cannot be unticked; a key
  // granted nothing would authenticate and then fail every call it made.
  expect(screen.getByRole('checkbox', { name: 'My own data' })).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'Create key' }));

  expect(mocked.create).toHaveBeenCalledWith(
    expect.objectContaining({ tenants: ['personal'], defaultTenant: 'personal' })
  );
});

it('sends exactly the scopes that are ticked', async () => {
  const user = userEvent.setup();
  mocked.create.mockResolvedValue({ ...key({ id: 'k2' }), token: TOKEN });
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));
  await user.type(screen.getByLabelText('Name'), 'Reader');
  // Drop the default write, add photos read.
  await user.click(screen.getByLabelText('Relationship — write'));
  await user.click(screen.getByLabelText('Photos — read'));
  await user.click(screen.getByRole('button', { name: 'Create key' }));

  expect(mocked.create).toHaveBeenCalledWith(
    expect.objectContaining({ scopes: ['relationship:read', 'album:read'] })
  );
});

it('reports a failed creation and keeps the dialog open so the input is not lost', async () => {
  const user = userEvent.setup();
  mocked.create.mockRejectedValue(new Error('server said no'));
  await renderTab([]);

  await user.click(screen.getByRole('button', { name: /New key/ }));
  await user.type(screen.getByLabelText('Name'), 'Doomed');
  await user.click(screen.getByRole('button', { name: 'Create key' }));

  expect(await screen.findByText(/Could not create/)).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveValue('Doomed');
});

it('shows what each key is allowed to do', async () => {
  await renderTab([key({ scopes: ['relationship:read', 'album:write'] })]);

  expect(screen.getByText('relationship:read')).toBeInTheDocument();
  expect(screen.getByText('album:write')).toBeInTheDocument();
});

it('shows when a key was last used, and says so plainly when it never has been', async () => {
  await renderTab([key({ lastUsedAt: null })]);
  expect(screen.getByText(/Last used —/)).toBeInTheDocument();
});

it('shows an expiry only when the key has one', async () => {
  await renderTab([key({ expiresAt: null })]);
  expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
});

it('keeps each key’s reveal independent', async () => {
  const user = userEvent.setup();
  mocked.reveal.mockResolvedValue(TOKEN);
  await renderTab([key(), key({ id: 'k2', name: 'Second' })]);

  await user.click(screen.getByRole('button', { name: 'Show Claude Code' }));
  await screen.findByText(TOKEN);

  // The other key stays masked — revealing is per key, not a global toggle.
  expect(screen.getByRole('button', { name: 'Show Second' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Hide Second' })).not.toBeInTheDocument();
});
