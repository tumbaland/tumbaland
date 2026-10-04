import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('../services/groupService', () => ({
  getUserGroups: vi.fn()
}));

import { getUserGroups } from '../services/groupService';
import ActivityTypeDialog from './ActivityTypeDialog';
import { ActivityType } from '../services/types';

const mockedGetUserGroups = getUserGroups as unknown as ReturnType<typeof vi.fn>;

const initialData: ActivityType = {
  _id: 't1',
  id: 't1',
  name: 'Reading',
  slug: 'reading',
  description: 'Books',
  color: '#123456',
  valueType: 'number',
  isActive: true,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
  userId: 'u1',
  groupId: 'g1'
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetUserGroups.mockResolvedValue([]);
});

it('renders the create title and default field values when there is no initial data', () => {
  render(<ActivityTypeDialog open onClose={vi.fn()} onSubmit={vi.fn()} />);
  expect(screen.getByText('Create Activity Type')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Name/)).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
});

it('renders the edit title and pre-filled fields when given initial data', () => {
  render(<ActivityTypeDialog open onClose={vi.fn()} onSubmit={vi.fn()} initialData={initialData} />);
  expect(screen.getByText('Edit Activity Type')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Name/)).toHaveValue('Reading');
  expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
});

it('shows a validation error when the name is empty', async () => {
  const onSubmit = vi.fn();
  render(<ActivityTypeDialog open onClose={vi.fn()} onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole('button', { name: 'Create' }));

  expect(await screen.findByText('Name is required')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('auto-generates a slug from the name and submits, then closes', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<ActivityTypeDialog open onClose={onClose} onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText(/^Name/), 'My Cool Activity!!');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Cool Activity!!', slug: 'my-cool-activity' })
    )
  );
  expect(onClose).toHaveBeenCalled();
});

it('shows an error message and re-enables the form when submit fails', async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error('save failed'));
  const onClose = vi.fn();
  render(<ActivityTypeDialog open onClose={onClose} onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText(/^Name/), 'Test');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));

  expect(await screen.findByText('save failed')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
});

it('resets the form and errors each time it reopens', () => {
  const { rerender } = render(
    <ActivityTypeDialog open={false} onClose={vi.fn()} onSubmit={vi.fn()} initialData={initialData} />
  );

  rerender(<ActivityTypeDialog open onClose={vi.fn()} onSubmit={vi.fn()} initialData={initialData} />);

  expect(screen.getByLabelText(/^Name/)).toHaveValue('Reading');
});

it('calls onClose from the Cancel button', async () => {
  const onClose = vi.fn();
  render(<ActivityTypeDialog open onClose={onClose} onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});

it('defaults location tracking to off for a new type', () => {
  render(<ActivityTypeDialog open onClose={vi.fn()} onSubmit={vi.fn()} />);

  expect(screen.getByLabelText('Track where it happened')).not.toBeChecked();
});

it('submits hasLocation when location tracking is switched on', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<ActivityTypeDialog open onClose={vi.fn()} onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText(/^Name/), 'Restaurants');
  await userEvent.click(screen.getByLabelText('Track where it happened'));
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Restaurants', hasLocation: true }))
  );
});

it("reflects an existing type's location setting when editing", () => {
  render(
    <ActivityTypeDialog open onClose={vi.fn()} onSubmit={vi.fn()} initialData={{ ...initialData, hasLocation: true }} />
  );

  expect(screen.getByLabelText('Track where it happened')).toBeChecked();
});

it('can switch location tracking back off', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <ActivityTypeDialog
      open
      onClose={vi.fn()}
      onSubmit={onSubmit}
      initialData={{ ...initialData, hasLocation: true }}
    />
  );

  await userEvent.click(screen.getByLabelText('Track where it happened'));
  await userEvent.click(screen.getByRole('button', { name: 'Update' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ hasLocation: false })));
});
