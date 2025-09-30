# React Query Integration

This document explains how to use React Query (TanStack Query) for optimized API calls in the finance front.

## Setup

React Query is already configured in `src/lib/queryClient.ts` and wrapped around the app in `src/main.tsx`.

## Available Hooks

### Authentication Hooks (`src/hooks/useAuth.ts`)

```typescript
import { useCurrentUser, useLogout, useLogin } from '../hooks/useAuth';

// Get current user (with JWT caching)
const { data: user, isLoading } = useCurrentUser();

// Logout (clears cache and redirects)
const logoutMutation = useLogout();
const handleLogout = () => logoutMutation.mutate();

// Login (redirects to auth service)
const loginMutation = useLogin();
const handleLogin = () => loginMutation.mutate();
```

### Finance Records Hooks (`src/hooks/useFinance.ts`)

```typescript
import {
  useFinanceRecords,
  useCreateFinanceRecord,
  useUpdateFinanceRecord,
  useDeleteFinanceRecord,
  useFetchFinanceRecords
} from '../hooks/useFinance';

// Get finance records (cached for 2 minutes)
const { data: records, isLoading, error } = useFinanceRecords(groupId);

// Create record
const createMutation = useCreateFinanceRecord();
const handleCreate = (data) => createMutation.mutate(data);

// Update record
const updateMutation = useUpdateFinanceRecord();
const handleUpdate = (id, data) => updateMutation.mutate({ id, data });

// Delete record
const deleteMutation = useDeleteFinanceRecord();
const handleDelete = (id) => deleteMutation.mutate(id);

// Fetch from external source
const fetchMutation = useFetchFinanceRecords();
const handleFetch = () => fetchMutation.mutate();
```

## Benefits

- **Automatic Caching**: API responses are cached and reused
- **Background Refetching**: Data stays fresh automatically
- **Optimistic Updates**: UI updates immediately, then syncs with server
- **Error Handling**: Built-in retry logic and error states
- **Loading States**: Consistent loading indicators
- **Reduced API Calls**: Eliminates duplicate requests

## Cache Configuration

- **Auth data**: 5 minutes stale time
- **Finance records**: 2 minutes stale time
- **Garbage collection**: 10 minutes
- **Retry logic**: Up to 3 retries, no retries on 4xx errors

## Creating New Hooks

For new services, follow this pattern:

```typescript
// 1. Define query keys
export const serviceKeys = {
  all: ['service'] as const,
  items: () => [...serviceKeys.all, 'items'] as const,
  item: (id: string) => [...serviceKeys.all, 'item', id] as const,
};

// 2. Create query hook
export const useItems = (params) => {
  return useQuery({
    queryKey: serviceKeys.items(),
    queryFn: () => service.getItems(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// 3. Create mutation hooks
export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: service.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.items() });
    },
  });
};
```

## Best Practices

1. **Use descriptive query keys** for proper cache invalidation
2. **Set appropriate staleTime** based on data freshness needs
3. **Invalidate related queries** in mutation onSuccess callbacks
4. **Handle loading and error states** in components
5. **Use optimistic updates** for better UX when appropriate

## Migration Guide

Replace manual API calls:

```typescript
// Before
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  service.getData().then(setData).finally(() => setLoading(false));
}, []);

// After
const { data, isLoading } = useDataQuery();
```