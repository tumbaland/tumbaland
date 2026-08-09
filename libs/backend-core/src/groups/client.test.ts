jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';
import { clearGroupOwnerCache, getGroupOwner, invalidateGroupOwner } from './client';

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function ownerResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    success: true,
    groupId: 'group-1',
    ownerEmail: 'Owner@Example.com',
    memberCount: 3,
    deleted: false,
    ...overrides
  });
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    GROUP_API_URL: 'http://group-service:5006',
    INTERNAL_SERVICE_TOKEN: 'test-internal-token',
    SERVICE_NAME: 'album-service'
  };
  clearGroupOwnerCache();
  global.fetch = jest.fn();
  (logger.error as jest.Mock).mockClear();
  (logger.warn as jest.Mock).mockClear();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

describe('getGroupOwner', () => {
  it('calls the internal endpoint with the service token and normalizes the owner', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

    const result = await getGroupOwner('group-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://group-service:5006/internal/groups/group-1/owner',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-internal-token': 'test-internal-token', 'x-service-id': 'album-service' })
      })
    );
    // Lowercased on arrival: it becomes a UsageMeter subjectId, which is
    // lowercase, so an owner recorded with capitals would open a second meter.
    expect(result?.ownerEmail).toBe('owner@example.com');
    expect(result?.memberCount).toBe(3);
    expect(result?.deleted).toBe(false);
  });

  it('resolves a soft-deleted group rather than dropping its storage', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse({ deleted: true }));

    const result = await getGroupOwner('group-1');

    expect(result?.ownerEmail).toBe('owner@example.com');
    expect(result?.deleted).toBe(true);
  });

  it('serves the cached answer within the TTL and refetches after it', async () => {
    jest.useFakeTimers();
    try {
      (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

      await getGroupOwner('group-1');
      await getGroupOwner('group-1');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60_001);
      await getGroupOwner('group-1');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('collapses a concurrent burst for one group into a single request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

    await Promise.all(Array.from({ length: 10 }, () => getGroupOwner('group-1')));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('drops the cached owner on invalidate, so a transferred group rebills at once', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(ownerResponse())
      .mockResolvedValue(ownerResponse({ ownerEmail: 'new-owner@example.com' }));

    const before = await getGroupOwner('group-1');
    invalidateGroupOwner('group-1');
    const after = await getGroupOwner('group-1');

    expect(before?.ownerEmail).toBe('owner@example.com');
    expect(after?.ownerEmail).toBe('new-owner@example.com');
  });

  it('returns null without calling out on a blank group id', async () => {
    expect(await getGroupOwner('   ')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('when the group cannot be resolved', () => {
  it('returns null on a 404 and warns rather than erroring', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: false }, 404));

    expect(await getGroupOwner('missing')).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns null and errors when group-service is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await getGroupOwner('group-1')).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns null when the answer carries no owner', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse({ ownerEmail: undefined }));

    expect(await getGroupOwner('group-1')).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns null without calling out at all when the channel is unconfigured', async () => {
    delete process.env.GROUP_API_URL;

    expect(await getGroupOwner('group-1')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Group owner lookup not configured', expect.anything());
  });
});

describe('base URL selection', () => {
  it('prefers the container-network address over the public hostname', async () => {
    process.env.GROUP_INTERNAL_URL = 'http://group-service:5006';
    process.env.GROUP_API_URL = 'https://group-api.tumbaland.eu';
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

    await getGroupOwner('group-1');

    // The public variable is what the frontends hand to the browser, so it can
    // never be pointed inward — this is the server-side half of that split.
    expect(global.fetch).toHaveBeenCalledWith(
      'http://group-service:5006/internal/groups/group-1/owner',
      expect.anything()
    );
  });

  it('falls back to the public URL, so local dev and un-migrated deploys still work', async () => {
    delete process.env.GROUP_INTERNAL_URL;
    process.env.GROUP_API_URL = 'https://group-api.tumbaland.eu';
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

    await getGroupOwner('group-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://group-api.tumbaland.eu/internal/groups/group-1/owner',
      expect.anything()
    );
  });

  it('never caches a failure, so recovery is immediate rather than a minute later', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(ownerResponse());

    const failed = await getGroupOwner('group-1');
    const recovered = await getGroupOwner('group-1');

    expect(failed).toBeNull();
    expect(recovered?.ownerEmail).toBe('owner@example.com');
  });

  it('never caches a 404 either — a bad id must not spend a cache slot', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: false }, 404));

    await getGroupOwner('missing');
    await getGroupOwner('missing');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('cache bounds', () => {
  it('evicts the oldest entries instead of growing without limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ownerResponse());

    for (let i = 0; i < 5_001; i++) {
      await getGroupOwner(`group-${i}`);
    }
    const callsAfterFill = (global.fetch as jest.Mock).mock.calls.length;

    // The very first group was evicted by the 5001st, so this is a refetch.
    await getGroupOwner('group-0');
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFill + 1);

    // The most recent group is still cached.
    await getGroupOwner('group-5000');
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFill + 1);
  });
});
