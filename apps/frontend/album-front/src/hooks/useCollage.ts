import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collageService } from '../services/collageService';
import { Collage, CollageInput } from '../types/collage';
import { useTenantFilter } from '@tumbaland/frontend-core';

const collageKeys = {
  all: ['collages'] as const,
  list: (albumId: string | null, groupId: string | null) => [...collageKeys.all, 'list', albumId, groupId] as const,
  detail: (id?: string) => [...collageKeys.all, 'detail', id] as const
};

export const useCollageList = (options?: { albumId?: string; enabled?: boolean }) => {
  const tenantGroupId = useTenantFilter();
  const albumId = options?.albumId ?? null;
  const groupId = tenantGroupId ?? null;

  return useQuery<Collage[], Error>({
    queryKey: collageKeys.list(albumId, groupId),
    queryFn: () => collageService.getCollages({ albumId: options?.albumId, groupId: tenantGroupId }),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true
  });
};

export const useCollageDetails = (collageId?: string) => {
  return useQuery({
    queryKey: collageKeys.detail(collageId),
    queryFn: () => collageService.getCollageById(collageId as string),
    enabled: Boolean(collageId),
    // Signed photo URLs expire after 60 minutes; refetching keeps them fresh
    // while a collage stays open (the editor only re-reads URLs, not layout).
    refetchInterval: 45 * 60 * 1000,
    refetchIntervalInBackground: true
  });
};

export const useCollageMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (input: CollageInput) => collageService.createCollage(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collageKeys.all });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CollageInput> }) => collageService.updateCollage(id, input),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: collageKeys.all });
      queryClient.invalidateQueries({ queryKey: collageKeys.detail(variables.id) });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collageService.deleteCollage(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: collageKeys.all });
      queryClient.invalidateQueries({ queryKey: collageKeys.detail(id) });
    }
  });

  return {
    createCollage: createMutation.mutateAsync,
    updateCollage: (id: string, input: Partial<CollageInput>) => updateMutation.mutateAsync({ id, input }),
    deleteCollage: deleteMutation.mutateAsync
  };
};
