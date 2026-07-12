import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn(),
  createActivityType: vi.fn(),
  updateActivityType: vi.fn(),
  deleteActivityType: vi.fn()
}));
vi.mock('../services/groupService', () => ({
  getUserGroups: vi.fn()
}));

import {
  getActivityTypes,
  createActivityType,
  updateActivityType,
  deleteActivityType
} from '../services/activityTypes';
import { getUserGroups } from '../services/groupService';
import ActivityTypesManagement from './ActivityTypesManagement';

const mockedGetTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;
const mockedCreate = createActivityType as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = updateActivityType as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = deleteActivityType as unknown as ReturnType<typeof vi.fn>;
const mockedGetUserGroups = getUserGroups as unknown as ReturnType<typeof vi.fn>;

const types = [
  { _id: 't1', id: 't1', name: 'Reading', slug: 'reading', color: '#111111', valueType: 'string', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1' },
  { _id: 't2', id: 't2', name: 'Running', slug: 'running', valueType: 'number', isActive: true, sortOrder: 1, createdAt: '', updatedAt: '', userId: 'u1' }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetUserGroups.mockResolvedValue([]);
});

it('shows a spinner while loading', () => {
  mockedGetTypes.mockReturnValue(new Promise(() => {}));
  render(<ActivityTypesManagement />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an empty state when there are no activity types', async () => {
  mockedGetTypes.mockResolvedValue({ data: [], pagination: {} as any });
  render(<ActivityTypesManagement />);
  expect(await screen.findByText('No Activity Types Found')).toBeInTheDocument();
});

it('shows an empty state when loading fails', async () => {
  mockedGetTypes.mockRejectedValue(new Error('boom'));
  render(<ActivityTypesManagement />);
  expect(await screen.findByText('No Activity Types Found')).toBeInTheDocument();
});

it('renders a row per activity type with its value type and color chips', async () => {
  mockedGetTypes.mockResolvedValue({ data: types, pagination: {} as any });
  render(<ActivityTypesManagement groupId="g1" />);

  await screen.findByText('Reading');
  expect(screen.getByText('Number')).toBeInTheDocument();
  expect(screen.getByText('Text')).toBeInTheDocument();
  expect(screen.getByText('#111111')).toBeInTheDocument();
  expect(screen.getAllByText('-').length).toBeGreaterThan(0); // Running has no color
});

it('opens the create dialog and creates a new type', async () => {
  mockedGetTypes.mockResolvedValue({ data: types, pagination: {} as any });
  mockedCreate.mockResolvedValue(undefined);
  render(<ActivityTypesManagement />);
  await screen.findByText('Reading');

  window.dispatchEvent(new Event('openCreateActivityTypeDialog'));
  expect(await screen.findByText('Create Activity Type')).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/^Name/), 'Gaming');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
  expect(mockedGetTypes).toHaveBeenCalledTimes(2);
});

it('opens the edit dialog with the selected type and updates it', async () => {
  mockedGetTypes.mockResolvedValue({ data: types, pagination: {} as any });
  mockedUpdate.mockResolvedValue(undefined);
  render(<ActivityTypesManagement />);
  await screen.findByText('Reading');

  await userEvent.click(screen.getAllByLabelText('Edit')[0]);
  expect(await screen.findByText('Edit Activity Type')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Name/)).toHaveValue('Reading');

  await userEvent.click(screen.getByRole('button', { name: 'Update' }));
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('t1', expect.anything()));
});

it('deletes a type after confirmation', async () => {
  mockedGetTypes.mockResolvedValue({ data: types, pagination: {} as any });
  mockedDelete.mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ActivityTypesManagement />);
  await screen.findByText('Reading');

  await userEvent.click(screen.getAllByLabelText('Delete')[0]);

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('t1'));
  expect(mockedGetTypes).toHaveBeenCalledTimes(2);
});

it('does not delete when confirmation is declined', async () => {
  mockedGetTypes.mockResolvedValue({ data: types, pagination: {} as any });
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<ActivityTypesManagement />);
  await screen.findByText('Reading');

  await userEvent.click(screen.getAllByLabelText('Delete')[0]);

  expect(mockedDelete).not.toHaveBeenCalled();
});

it('shows an alert when deletion fails', async () => {
  mockedGetTypes.mockResolvedValue({ data: types, pagination: {} as any });
  mockedDelete.mockRejectedValue(new Error('nope'));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  render(<ActivityTypesManagement />);
  await screen.findByText('Reading');

  await userEvent.click(screen.getAllByLabelText('Delete')[0]);

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to delete activity type: nope'));
});
