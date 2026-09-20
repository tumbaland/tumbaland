import { renderHook } from '@testing-library/react';
import { useTenantFilter } from './useTenantDataRefresh';

describe('useTenantFilter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns undefined when nothing is stored', () => {
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current).toBeUndefined();
  });

  it('returns undefined for a personal tenant', () => {
    localStorage.setItem('selectedTenant', JSON.stringify({ id: 'personal', name: 'Personal', type: 'personal' }));
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current).toBeUndefined();
  });

  it('returns the group id for a group tenant', () => {
    localStorage.setItem('selectedTenant', JSON.stringify({ id: 'g1', name: 'Group A', type: 'group' }));
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current).toBe('g1');
  });

  it('returns undefined and does not throw when the stored value is corrupted JSON', () => {
    localStorage.setItem('selectedTenant', '{not valid json');
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current).toBeUndefined();
  });
});
