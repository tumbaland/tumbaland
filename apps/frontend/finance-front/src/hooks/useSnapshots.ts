import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSnapshots, saveSnapshot, deleteSnapshot } from '../services/snapshotService';
import { SnapshotEntry } from '../types';

export const useSnapshots = (groupId?: string) => {
  return useQuery({
    queryKey: ['snapshots', groupId],
    queryFn: () => getSnapshots(groupId),
  });
};

export const useSaveSnapshot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, entries, groupId }: { month: string; entries: SnapshotEntry[]; groupId?: string }) =>
      saveSnapshot(month, entries, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteSnapshot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSnapshot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
