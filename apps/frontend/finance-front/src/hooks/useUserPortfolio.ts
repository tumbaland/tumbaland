import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserPortfolios,
  addUserPortfolio,
  updateUserPortfolio,
  deleteUserPortfolio,
  UserPortfolio
} from '../services/userPortfolioService';

// User Portfolio Hooks
export const useUserPortfolios = (groupId?: string) => {
  return useQuery({
    queryKey: ['userPortfolios', groupId],
    queryFn: () => getUserPortfolios(groupId),
  });
};

export const useCreateUserPortfolio = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addUserPortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPortfolios'] });
    },
  });
};

export const useUpdateUserPortfolio = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserPortfolio> }) =>
      updateUserPortfolio(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPortfolios'] });
    },
  });
};

export const useDeleteUserPortfolio = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUserPortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPortfolios'] });
    },
  });
};