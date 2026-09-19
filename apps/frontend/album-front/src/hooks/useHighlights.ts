import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Highlights } from '../types';
import { photoService } from '../services/photoService';

const highlightKeys = {
  recent: (groupId?: string) => ['highlights', 'recent', groupId ?? 'personal'] as const,
  random: (groupId?: string) => ['highlights', 'random', groupId ?? 'personal'] as const
};

/** The newest uploads across every album in scope. */
export const useRecentPhotos = (groupId?: string, limit = 8) => {
  const query = useQuery<Highlights>({
    queryKey: [...highlightKeys.recent(groupId), limit],
    queryFn: () => photoService.getRecentPhotos({ groupId: groupId || undefined, limit }),
    // The signed URLs it carries outlive this, and new uploads are the one
    // thing the user just did — so a mount is not worth a refetch.
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData
  });

  return {
    photos: query.data?.photos ?? [],
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load recent photos' : null
  };
};

/**
 * One photo picked at random.
 *
 * `staleTime: Infinity` so the pick survives a re-render, a tab switch and a
 * refocus: a photo that changed on its own while being looked at would be the
 * one thing this card must not do. `refetch` is the only thing that moves it,
 * which is what the "Show another" button calls.
 */
export const useRandomPhoto = (groupId?: string) => {
  const query = useQuery<Highlights>({
    queryKey: highlightKeys.random(groupId),
    queryFn: () => photoService.getRandomPhotos({ groupId: groupId || undefined, limit: 1 }),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  return {
    photo: query.data?.photos?.[0] ?? null,
    loading: query.isPending,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load a photo' : null,
    showAnother: query.refetch
  };
};
