import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../../services/auditService', async () => {
  const actual = await vi.importActual<typeof import('../../services/auditService')>(
    '../../services/auditService'
  );
  return { ...actual, auditService: { list: vi.fn() } };
});

vi.mock('@tumbaland/frontend-core', async () => {
  const actual = await vi.importActual('@tumbaland/frontend-core');
  return { ...actual, logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } };
});

import { auditService, AuditEntry } from '../../services/auditService';
import ActivityTab from './ActivityTab';

const mocked = auditService as unknown as { list: ReturnType<typeof vi.fn> };

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 'e1',
  at: new Date().toISOString(),
  service: 'relationship-service',
  action: 'create',
  resource: 'activity',
  actorKind: 'assistant',
  actorLabel: 'Claude',
  actorCredentialId: 'client-1',
  tenant: 'g1',
  ...over
});

const page = (events: AuditEntry[], over: Record<string, number> = {}) => ({
  events,
  total: events.length,
  page: 1,
  totalPages: 1,
  ...over
});

async function renderTab(events: AuditEntry[] = [entry()]) {
  mocked.list.mockResolvedValue(page(events));
  render(<ActivityTab />);
  await waitFor(() => expect(mocked.list).toHaveBeenCalled());
}

beforeEach(() => vi.clearAllMocks());

describe('reading the trail', () => {
  it('names the actor by its own label, not an id', async () => {
    await renderTab();
    // "Claude" is what someone recognises; "client-1" is what they cannot act on.
    expect(await screen.findByText('Claude')).toBeInTheDocument();
    expect(screen.queryByText('client-1')).not.toBeInTheDocument();
  });

  it('says what an update actually changed, not just that it changed', async () => {
    await renderTab([
      entry({ action: 'update', changes: { hours: { from: 3, to: 2 } } })
    ]);

    // The whole reason the trail stores before-and-after: "Claude changed an
    // activity" is barely worth reading.
    expect(await screen.findByText(/hours: 3 → 2/)).toBeInTheDocument();
  });

  it('spells out an absent value rather than leaving a gap', async () => {
    await renderTab([
      entry({ action: 'update', changes: { description: { from: null, to: 'Sushi' } } })
    ]);

    // A change from nothing to something and a change nobody can see look
    // identical when the cell is simply empty.
    expect(await screen.findByText(/nothing → “Sushi”/)).toBeInTheDocument();
  });

  it('shows what a delete removed, since nothing else holds it', async () => {
    await renderTab([
      entry({ action: 'delete', snapshot: { description: 'Naraka Bladepoint' } })
    ]);

    expect(await screen.findByText(/Naraka Bladepoint/)).toBeInTheDocument();
    expect(screen.getByText(/removed/)).toBeInTheDocument();
  });

  it('says how much an assistant read, not merely that it read', async () => {
    await renderTab([entry({ action: 'read', resource: 'activities', count: 47 })]);

    expect(await screen.findByText(/read 47 activities/)).toBeInTheDocument();
  });

  it('groups by day, with today named rather than dated', async () => {
    await renderTab();
    expect(await screen.findByText('Today')).toBeInTheDocument();
  });

  it('names yesterday too, and dates anything older', async () => {
    const daysAgo = (n: number) => {
      const date = new Date();
      date.setDate(date.getDate() - n);
      return date.toISOString();
    };

    await renderTab([
      entry({ at: daysAgo(1) }),
      entry({ id: 'e2', at: daysAgo(9) })
    ]);

    expect(await screen.findByText('Yesterday')).toBeInTheDocument();
    // Older days get a real date; "9 days ago" is arithmetic nobody wants to do.
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.getAllByText(/\d/).length).toBeGreaterThan(0);
  });

  it('distinguishes a person from software at a glance', async () => {
    await renderTab([
      entry({ actorKind: 'person', actorLabel: 'Tom' }),
      entry({ id: 'e2', actorKind: 'key', actorLabel: 'Claude Code' })
    ]);

    expect(await screen.findByText('Tom')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });
});

describe('filtering', () => {
  it('asks the server for one kind of actor', async () => {
    const user = userEvent.setup();
    await renderTab();

    await user.click(screen.getByRole('button', { name: 'Assistants' }));

    await waitFor(() =>
      expect(mocked.list).toHaveBeenLastCalledWith(expect.objectContaining({ actorKind: 'assistant' }))
    );
  });

  it('narrows to one area, since the trail now spans three services', async () => {
    const user = userEvent.setup();
    await renderTab();

    await user.click(screen.getByRole('button', { name: 'Photos' }));

    // Named for what it is to a person: nobody thinks of their photos as
    // "album-service".
    await waitFor(() =>
      expect(mocked.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ service: 'album-service' })
      )
    );
  });

  it('reads a record from any service, not only the journal', async () => {
    await renderTab([
      entry({ resource: 'photo', service: 'album-service' }),
      entry({ id: 'e2', resource: 'transaction', service: 'finance-service', action: 'update',
              changes: { amount: { from: 10, to: 12 } } })
    ]);

    expect(await screen.findByText(/added a photo/)).toBeInTheDocument();
    expect(screen.getByText(/changed a transaction/)).toBeInTheDocument();
    // "a activity" is the kind of thing nobody reports and everybody notices.
    expect(screen.queryByText(/\ba (?:a|e|i|o|u)/)).not.toBeInTheDocument();
    expect(screen.getByText(/amount: 10 → 12/)).toBeInTheDocument();
  });

  it('covers account changes too, which is where a new key would show up', async () => {
    await renderTab([
      entry({ resource: 'api_key', service: 'auth-service', actorKind: 'person', actorLabel: 'Tom' })
    ]);

    // A credential nobody remembers creating is the one that matters.
    expect(await screen.findByText(/added an api key/)).toBeInTheDocument();
  });

  it('asks for one kind of action', async () => {
    const user = userEvent.setup();
    await renderTab();

    await user.click(screen.getByRole('button', { name: 'Removed' }));

    await waitFor(() =>
      expect(mocked.list).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'delete' }))
    );
  });

  it('restarts the listing rather than stacking two queries', async () => {
    const user = userEvent.setup();
    await renderTab([entry({ actorLabel: 'Claude' })]);

    mocked.list.mockResolvedValue(page([entry({ id: 'e9', actorLabel: 'Tom', actorKind: 'person' })]));
    await user.click(screen.getByRole('button', { name: 'You' }));

    await waitFor(() => expect(screen.queryByText('Claude')).not.toBeInTheDocument());
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });

  it('explains an empty result that is empty by design', async () => {
    const user = userEvent.setup();
    await renderTab();

    await user.click(screen.getByRole('button', { name: 'You' }));
    await user.click(screen.getByRole('button', { name: 'Read' }));

    // Nothing recorded and nothing to record look identical without this.
    expect(await screen.findByText(/Your own reading is never recorded/)).toBeInTheDocument();
  });
});

describe('when there is nothing, or something is wrong', () => {
  it('says the trail is empty rather than showing a blank page', async () => {
    await renderTab([]);
    expect(await screen.findByText('Nothing recorded yet.')).toBeInTheDocument();
  });

  it('reports a failure instead of an empty trail, which would be a lie', async () => {
    mocked.list.mockRejectedValue(new Error('relationship-service down'));
    render(<ActivityTab />);

    expect(await screen.findByText('Could not load your activity.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing recorded yet.')).not.toBeInTheDocument();
  });
});

describe('paging', () => {
  it('appends the next page rather than replacing what is shown', async () => {
    const user = userEvent.setup();
    mocked.list.mockResolvedValue({
      events: [entry({ actorLabel: 'Claude' })],
      total: 2,
      page: 1,
      totalPages: 2
    });
    render(<ActivityTab />);
    await screen.findByText('Claude');

    mocked.list.mockResolvedValue({
      events: [entry({ id: 'e2', actorLabel: 'Tom', actorKind: 'person' })],
      total: 2,
      page: 2,
      totalPages: 2
    });
    await user.click(screen.getByRole('button', { name: /Show more/ }));

    await waitFor(() => expect(screen.getByText('Tom')).toBeInTheDocument());
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('offers no more when there is no more', async () => {
    await renderTab();
    expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
  });
});
