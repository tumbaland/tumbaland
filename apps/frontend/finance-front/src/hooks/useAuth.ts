import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/authService';

// Query keys
export const authKeys = {
  auth: ['auth'] as const,
  user: () => [...authKeys.auth, 'user'] as const,
  checkAuth: () => [...authKeys.auth, 'checkAuth'] as const,
};

// Hook to check authentication status
export const useAuth = () => {
  return useQuery({
    queryKey: authKeys.checkAuth(),
    queryFn: async () => {
      const result = await authService.checkAuth();
      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry auth failures
  });
};

// Hook to get current user
export const useCurrentUser = () => {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const authResult = await authService.checkAuth();
      return authResult.user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
};

// Hook for login (mutation)
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      authService.redirectToLogin();
      return Promise.resolve();
    },
    onSuccess: () => {
      // Invalidate auth queries on successful login
      void queryClient.invalidateQueries({ queryKey: authKeys.auth });
    },
  });
};

// Hook for logout (mutation)
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
  });
};