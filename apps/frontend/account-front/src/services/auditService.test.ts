import { vi } from 'vitest';

// Hoisted: `vi.mock` is lifted above ordinary declarations, so a plain const
// would not exist yet when the factory runs.
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('./accountApi', () => ({ accountApi: { get } }));

import { auditService } from './auditService';

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ success: true, data: { events: [], total: 0, page: 1, totalPages: 0 } });
});

describe('auditService', () => {
  it('asks auth-service, where keys and connections already live', async () => {
    // The rows span every service, so there is no domain service the trail
    // belongs to more than the others.
    await auditService.list();
    expect(get).toHaveBeenCalledWith('/auth/audit');
  });

  it('sends only the filters that were set', async () => {
    await auditService.list({ actorKind: 'assistant', page: 2 });

    const [path] = get.mock.calls[0];
    expect(path).toContain('actorKind=assistant');
    expect(path).toContain('page=2');
    // An empty filter must not narrow the query to nothing.
    expect(path).not.toContain('action=');
  });

  it('unwraps the envelope so callers see the page itself', async () => {
    get.mockResolvedValue({
      success: true,
      data: { events: [{ id: 'e1' }], total: 1, page: 1, totalPages: 1 }
    });

    await expect(auditService.list()).resolves.toMatchObject({ total: 1 });
  });
});
