import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn().mockResolvedValue({ data: [], pagination: {} as any })
}));
vi.mock('../services/groupService', () => ({
  getUserGroups: vi.fn().mockResolvedValue([])
}));

import ActivityTypesPage from './ActivityTypesPage';

it('renders the header and dispatches the create-dialog event on button click', async () => {
  render(<ActivityTypesPage />);

  expect(screen.getByText('Activity Types')).toBeInTheDocument();
  const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

  await userEvent.click(screen.getByRole('button', { name: 'Add Activity Type' }));

  expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'openCreateActivityTypeDialog' }));
});
