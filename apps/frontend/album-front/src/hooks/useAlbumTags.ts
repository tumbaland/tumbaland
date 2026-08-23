import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { photoService } from '../services/photoService';
import { TagCount } from '../types';

export const albumTagKeys = {
  all: ['photo-tags'] as const,
  album: (albumId: string) => [...albumTagKeys.all, albumId] as const
};

/**
 * The album's tag vocabulary, most used first.
 *
 * Both the filter row and the tag inputs read from this, so a tag typed on one
 * photo immediately shows up as a suggestion on the next one.
 */
export const useAlbumTags = (albumId: string) => {
  const query = useQuery<TagCount[]>({
    queryKey: albumTagKeys.album(albumId),
    queryFn: () => photoService.getAlbumTags(albumId),
    enabled: Boolean(albumId)
  });

  return {
    tags: query.data ?? [],
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null
  };
};

/**
 * Add/remove tags across a selection of photos.
 *
 * Invalidates the album's photo lists as well as its tag list: a bulk add can
 * both introduce a new tag and change which photos a tag filter matches.
 */
export const useBulkTagMutation = (albumId: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ photoIds, add, remove }: { photoIds: string[]; add?: string[]; remove?: string[] }) =>
      photoService.bulkUpdateTags(photoIds, { add, remove }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', albumId] });
      queryClient.invalidateQueries({ queryKey: albumTagKeys.album(albumId) });
      for (const photoId of variables.photoIds) {
        queryClient.invalidateQueries({ queryKey: ['photo', photoId] });
      }
    }
  });

  return {
    bulkUpdateTags: mutation.mutateAsync,
    saving: mutation.isPending
  };
};
