import { useCallback, useEffect, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { ActivityType, Day, DaysResponse } from '../services/types';
import { getDays } from '../services/days';
import { getActivityTypes } from '../services/activityTypes';

const PAGE_SIZE = 30;

/**
 * The journal's list of days: what is loaded, the filters on it, and paging
 * further back. The page keeps what is about dialogs, the calendar and export.
 */
export const useJournalDays = (tenantGroupId: string | undefined) => {
  const [days, setDays] = useState<Day[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [types, setTypes] = useState<ActivityType[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  const loadTypes = useCallback(async () => {
    try {
      const response = await getActivityTypes({ groupId: tenantGroupId });
      setTypes(response.data);
      // A type the filter points at may have just been deleted in the manage
      // dialog — fall back to "all" so the list doesn't come back empty.
      setTypeFilter((current) => (current && !response.data.some((t) => t._id === current) ? '' : current));
    } catch (e) {
      logger.error('Failed to load activity types', e);
    }
  }, [tenantGroupId]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const fetchPage = useCallback(
    async (pageToLoad: number, limit: number = PAGE_SIZE): Promise<DaysResponse> =>
      getDays({
        page: pageToLoad,
        limit,
        groupId: tenantGroupId,
        typeId: typeFilter || undefined,
        search: debouncedSearch || undefined
      }),
    [tenantGroupId, typeFilter, debouncedSearch]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(1);
      setDays(result.days);
      setPage(1);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (e) {
      logger.error('Failed to load days', e);
      setError('Failed to load the journal');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await fetchPage(page + 1);
      setDays((prev) => [...prev, ...result.days]);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (e) {
      logger.error('Failed to load more days', e);
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    days,
    total,
    totalPages,
    page,
    loading,
    loadingMore,
    error,
    setError,
    typeFilter,
    setTypeFilter,
    search,
    setSearch,
    debouncedSearch,
    types,
    loadTypes,
    fetchPage,
    reload,
    loadMore
  };
};
