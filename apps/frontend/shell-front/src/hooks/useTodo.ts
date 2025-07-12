import { useState, useCallback, useRef, useEffect } from 'react';
import { useConfig } from './useConfig';

export function useTodo() {
  const config = useConfig();
  const API_URL = config.PUBLIC_API_URL;
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
      const res = await fetch(`${API_URL}/api/todo/random`);

      if (!res.ok) {
        throw new Error(`Failed to fetch todo: ${res.status}`);
      }

      const data: { todo: string } = await res.json();

      if (data && data.todo) {
        setTodo(data.todo);
      } else {
        throw new Error('Invalid todo data received');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch todo';
      console.error('Failed to fetch todo:', err);
      setError(errorMessage);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [API_URL]);

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
