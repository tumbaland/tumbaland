import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStatementSettings,
  updateStatementSettings,
  StatementSettings
} from '../services/statementSettingsService';

export const useStatementSettings = (groupId?: string) =>
  useQuery<StatementSettings>({
    queryKey: ['statementSettings', groupId],
    queryFn: () => getStatementSettings(groupId)
  });

export const useUpdateStatementSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerNames, groupId }: { ownerNames: string[]; groupId?: string }) =>
      updateStatementSettings(ownerNames, groupId),
    // Only the settings themselves: a name change decides what the *next*
    // import treats as an own-account transfer, and rewrites nothing already
    // held, so the figures on screen are still correct.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statementSettings'] })
  });
};
