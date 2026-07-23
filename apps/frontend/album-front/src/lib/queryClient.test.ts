import { queryClient } from './queryClient';

it('configures the default query options', () => {
  const queries = queryClient.getDefaultOptions().queries;

  expect(queries?.staleTime).toBe(60 * 1000);
  expect(queries?.refetchOnWindowFocus).toBe(false);
  expect(queries?.retry).toBe(1);
});
