import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@tumbaland/frontend-core';

// Create a client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors: asking again will not change the answer.
        // Judged by the status, not by digits in the message, which "Failed to
        // fetch 24 items" would also have matched.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});