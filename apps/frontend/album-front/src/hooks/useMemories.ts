import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Memories } from '../types';
import { photoService } from '../services/photoService';

const memoriesKeys = {
  all: ['memories'] as const,
  scoped: (groupId?: string) => [...memoriesKeys.all, groupId ?? 'personal'] as const
};

export const useMemories = (groupId?: string) => {
  const query = useQuery<Memories>({
    queryKey: memoriesKeys.scoped(groupId),
    queryFn: () => photoService.getMemories({ groupId: groupId || undefined }),
    // The answer only changes at midnight, so re-fetching on every mount of the
    // albums page is wasted work — and the signed URLs it carries outlive it.
    staleTime: 5 * 60 * 1000,
    // Keep the previous scope's strip on screen while the new one loads, rather
    // than collapsing the section and shifting the album grid up.
    placeholderData: keepPreviousData
  });

  return {
    memories: query.data ?? null,
    loading: query.isPending,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load memories' : null
  };
};
