import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { publicApi } from '../services/publicApi';

export function useTodo() {
  const [todo, setTodo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchTodo = useCallback(async () => {
    if (isLoadingRef.current) return; // Prevent multiple concurrent requests

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const data = await publicApi.get<{ todo: string }>('/api/todo/random');

      if (data && data.todo) {
        setTodo(data.todo);
      } else {
        throw new Error('Invalid todo data received');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch todo';
      logger.error('Failed to fetch todo', err);
      setError(errorMessage);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchTodo();
  }, [fetchTodo]);

  return {
    todo,
    isLoading,
    error,
    fetchTodo,
    refetch: fetchTodo
  };
}
