import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlbumStatistics } from '../types';
import { albumService } from '../services/albumService';

const statisticsKeys = {
  all: ['statistics'] as const,
  scoped: (groupId?: string) => [...statisticsKeys.all, groupId ?? 'personal'] as const
};

export const useStatistics = (groupId?: string) => {
  const query = useQuery<AlbumStatistics>({
    queryKey: statisticsKeys.scoped(groupId),
    queryFn: () => albumService.getAlbumStatistics({ groupId: groupId || undefined }),
    // Keep the previous group's numbers on screen while the new group loads,
    // so switching the tenant filter never blanks the whole dashboard.
    placeholderData: keepPreviousData
  });

  return {
    statistics: query.data ?? null,
    loading: query.isPending,
    isFetching: query.isFetching,
    error:
      query.error instanceof Error ? query.error.message : query.error ? 'Failed to load dashboard statistics' : null,
    refetch: query.refetch
  };
};
