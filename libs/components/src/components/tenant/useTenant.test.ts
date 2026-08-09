import { renderHook, waitFor, act } from '@testing-library/react';
import { useTenant } from './useTenant';

// fetchGroupsGlobally caches in-flight/recent requests in module-level state
// keyed by groupApiUrl. Giving each test its own unique URL (via a counter)
// sidesteps that cache entirely instead of fighting module-reset complexity.
let urlCounter = 0;
function uniqueGroupApiUrl() {
  urlCounter += 1;
  return `https://group-api.example/${urlCounter}`;
}

function mockGroupsResponse(groups: Array<{ _id: string; name: string }>) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ success: true, data: groups.map((g) => ({ ...g, members: [] })) })
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
  localStorage.clear();
});

describe('useTenant', () => {
  it('does not fetch and sets loading:false when no userEmail is given', async () => {
    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.availableTenants).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('defaults to the Personal tenant when there is no saved selection', async () => {
    mockGroupsResponse([{ _id: 'g1', name: 'Group A' }]);
    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.availableTenants).toEqual([
      { id: 'personal', name: 'Personal', type: 'personal' },
      { id: 'g1', name: 'Group A', type: 'group' }
    ]);
    expect(result.current.selectedTenant).toEqual({ id: 'personal', name: 'Personal', type: 'personal' });
    expect(localStorage.getItem('selectedTenant')).toBe(
      JSON.stringify({ id: 'personal', name: 'Personal', type: 'personal', userEmail: 'ada@example.com' })
    );
  });

  it('restores a saved tenant selection when it still exists among the fetched groups', async () => {
    localStorage.setItem('selectedTenant', JSON.stringify({ id: 'g1', name: 'Group A', type: 'group' }));
    mockGroupsResponse([{ _id: 'g1', name: 'Group A' }]);
    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selectedTenant).toEqual({ id: 'g1', name: 'Group A', type: 'group' });
  });

  it('falls back to Personal when the saved tenant no longer exists among the fetched groups', async () => {
    localStorage.setItem('selectedTenant', JSON.stringify({ id: 'stale-group', name: 'Gone', type: 'group' }));
    mockGroupsResponse([{ _id: 'g1', name: 'Group A' }]);
    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selectedTenant).toEqual({ id: 'personal', name: 'Personal', type: 'personal' });
    expect(localStorage.getItem('selectedTenant')).toBe(
      JSON.stringify({ id: 'personal', name: 'Personal', type: 'personal', userEmail: 'ada@example.com' })
    );
  });

  it('discards a group selected by a different account, even one this account also belongs to', async () => {
    // Sign in as someone else in the same browser: localStorage is per-origin,
    // so bea's pick is still sitting there and useTenantFilter reads it
    // synchronously — every group-scoped request would go out as bea's group.
    localStorage.setItem(
      'selectedTenant',
      JSON.stringify({ id: 'g1', name: 'Group A', type: 'group', userEmail: 'bea@example.com' })
    );
    mockGroupsResponse([{ _id: 'g1', name: 'Group A' }]);
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: reloadSpy } });

    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selectedTenant).toEqual({ id: 'personal', name: 'Personal', type: 'personal' });
    expect(localStorage.getItem('selectedTenant')).toBe(
      JSON.stringify({ id: 'personal', name: 'Personal', type: 'personal', userEmail: 'ada@example.com' })
    );
    // Siblings already fired requests against the discarded id before this ran.
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('does not reload when the discarded selection was Personal', async () => {
    localStorage.setItem(
      'selectedTenant',
      JSON.stringify({ id: 'personal', name: 'Personal', type: 'personal', userEmail: 'bea@example.com' })
    );
    mockGroupsResponse([]);
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: reloadSpy } });

    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(reloadSpy).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('falls back to Personal-only and sets an error message when the groups fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('Failed to fetch groups');
    expect(result.current.availableTenants).toEqual([{ id: 'personal', name: 'Personal', type: 'personal' }]);
    expect(result.current.selectedTenant).toEqual({ id: 'personal', name: 'Personal', type: 'personal' });
  });

  it('keeps showing the saved group when the groups fetch fails, matching what requests still send', async () => {
    const saved = { id: 'g1', name: 'Group A', type: 'group', userEmail: 'ada@example.com' };
    localStorage.setItem('selectedTenant', JSON.stringify(saved));
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // A transient failure is not evidence the selection is stale, so it stays
    // on disk — and the hook must not claim "Personal" while useTenantFilter
    // keeps sending g1.
    expect(result.current.selectedTenant).toEqual({ id: 'g1', name: 'Group A', type: 'group' });
    expect(localStorage.getItem('selectedTenant')).toBe(JSON.stringify(saved));
  });

  it('sets an error when the groups API reports success:false', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: false, data: [] })
    });
    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('API returned unsuccessful response');
  });

  it('returns no groups (without fetching) when groupApiUrl is empty', async () => {
    const { result } = renderHook(() => useTenant('', 'ada@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.availableTenants).toEqual([{ id: 'personal', name: 'Personal', type: 'personal' }]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent requests for the same user into a single fetch call', async () => {
    mockGroupsResponse([{ _id: 'g1', name: 'Group A' }]);
    const url = uniqueGroupApiUrl();

    const first = renderHook(() => useTenant(url, 'ada@example.com'));
    const second = renderHook(() => useTenant(url, 'ada@example.com'));

    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not serve one account the cached group list of another', async () => {
    mockGroupsResponse([{ _id: 'g1', name: 'Group A' }]);
    const url = uniqueGroupApiUrl();

    const first = renderHook(() => useTenant(url, 'ada@example.com'));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    // Same URL, well inside the 30s cache window, but a different session —
    // reusing ada's groups here is what let a stale selection validate.
    const second = renderHook(() => useTenant(url, 'bea@example.com'));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('setSelectedTenant saves the choice to localStorage and reloads the page', async () => {
    mockGroupsResponse([]);
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: reloadSpy } });

    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const groupTenant = { id: 'g9', name: 'Group Nine', type: 'group' as const };
    act(() => {
      result.current.setSelectedTenant(groupTenant);
    });

    expect(localStorage.getItem('selectedTenant')).toBe(
      JSON.stringify({ ...groupTenant, userEmail: 'ada@example.com' })
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('does not throw and treats storage as empty when localStorage.getItem throws', async () => {
    mockGroupsResponse([]);
    const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selectedTenant).toEqual({ id: 'personal', name: 'Personal', type: 'personal' });
    getItemSpy.mockRestore();
  });

  it('does not throw when localStorage.setItem throws while saving the selection', async () => {
    mockGroupsResponse([]);
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useTenant(uniqueGroupApiUrl(), 'ada@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectedTenant).toEqual({ id: 'personal', name: 'Personal', type: 'personal' });
    setItemSpy.mockRestore();
  });
});
