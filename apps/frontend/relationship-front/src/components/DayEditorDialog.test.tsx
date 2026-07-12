import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn()
}));
vi.mock('../services/activities', () => ({
  getActivityDescriptions: vi.fn()
}));
vi.mock('../services/days', () => ({
  getDays: vi.fn(),
  saveDay: vi.fn()
}));

import { getActivityTypes } from '../services/activityTypes';
import { getActivityDescriptions } from '../services/activities';
import { getDays, saveDay } from '../services/days';
import DayEditorDialog from './DayEditorDialog';

const mockedGetTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;
const mockedGetDescriptions = getActivityDescriptions as unknown as ReturnType<typeof vi.fn>;
const mockedGetDays = getDays as unknown as ReturnType<typeof vi.fn>;
const mockedSaveDay = saveDay as unknown as ReturnType<typeof vi.fn>;

const booleanType = { _id: 'b1', id: 'b1', name: 'Kissed', slug: 'kissed', valueType: 'boolean', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1' };
const numberType = { _id: 'n1', id: 'n1', name: 'Exercise', slug: 'exercise', valueType: 'number', isActive: true, sortOrder: 1, createdAt: '', updatedAt: '', userId: 'u1' };
const stringType = { _id: 's1', id: 's1', name: 'Notes', slug: 'notes', valueType: 'string', isActive: true, sortOrder: 2, createdAt: '', updatedAt: '', userId: 'u1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetDescriptions.mockResolvedValue([]);
  mockedGetDays.mockResolvedValue({ days: [] });
});

it('shows a spinner while loading', () => {
  mockedGetTypes.mockReturnValue(new Promise(() => {}));
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when loading the day fails', async () => {
  mockedGetTypes.mockRejectedValue(new Error('boom'));
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(await screen.findByText('Failed to load this day')).toBeInTheDocument();
});

it('shows a prompt when there are no activity types', async () => {
  mockedGetTypes.mockResolvedValue({ data: [], pagination: {} as any });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(await screen.findByText(/create some under activity types first/i)).toBeInTheDocument();
});

it('renders the formatted date as the title when not date-editable', async () => {
  mockedGetTypes.mockResolvedValue({ data: [booleanType], pagination: {} as any });
  render(<DayEditorDialog open date="2024-01-15" onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(await screen.findByText('Monday, January 15, 2024')).toBeInTheDocument();
});

it('shows a date field and "Log a day" title when date-editable', async () => {
  mockedGetTypes.mockResolvedValue({ data: [booleanType], pagination: {} as any });
  render(<DayEditorDialog open date="2024-01-15" dateEditable onClose={vi.fn()} onSaved={vi.fn()} />);
  await screen.findByText('Log a day');
  expect(document.querySelector('input[type="date"]')).toHaveValue('2024-01-15');
});

it('pre-fills drafts from existing day entries', async () => {
  mockedGetTypes.mockResolvedValue({ data: [numberType], pagination: {} as any });
  mockedGetDays.mockResolvedValue({
    days: [{ date: '2024-01-01', entries: [{ _id: 'e1', typeId: 'n1', hours: 3 }] }]
  });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  expect(await screen.findByLabelText('Hours')).toHaveValue(3);
});

it('toggles a boolean type on and saves it with no extra fields', async () => {
  mockedGetTypes.mockResolvedValue({ data: [booleanType], pagination: {} as any });
  mockedSaveDay.mockResolvedValue({ date: '2024-01-01', entries: [] });
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<DayEditorDialog open date="2024-01-01" onClose={onClose} onSaved={onSaved} />);

  await screen.findByText('Kissed');
  await userEvent.click(screen.getByText('Kissed'));
  await userEvent.click(screen.getByRole('button', { name: 'Save day' }));

  await waitFor(() =>
    expect(mockedSaveDay).toHaveBeenCalledWith('2024-01-01', [{ typeId: 'b1' }], 'g1')
  );
  expect(onSaved).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('enters hours for a number type and validates non-negative whole numbers', async () => {
  mockedGetTypes.mockResolvedValue({ data: [numberType], pagination: {} as any });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  await screen.findByText('Exercise');
  await userEvent.click(screen.getByText('Exercise'));

  const hoursField = await screen.findByLabelText('Hours');
  await userEvent.type(hoursField, '-1');
  await userEvent.click(screen.getByRole('button', { name: 'Save day' }));

  expect(await screen.findByText(/hours must be a non-negative whole number/)).toBeInTheDocument();
  expect(mockedSaveDay).not.toHaveBeenCalled();
});

it('adds and removes description drafts for a string type', async () => {
  mockedGetTypes.mockResolvedValue({ data: [stringType], pagination: {} as any });
  mockedSaveDay.mockResolvedValue({ date: '2024-01-01', entries: [] });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  await screen.findByText('Notes');
  await userEvent.click(screen.getByText('Notes'));

  const [firstInput] = await screen.findAllByPlaceholderText(/pick a past entry or type new/);
  await userEvent.type(firstInput, 'Went for a walk');

  await userEvent.click(screen.getByRole('button', { name: /add another notes/i }));
  expect(await screen.findAllByPlaceholderText(/pick a past entry or type new/)).toHaveLength(2);

  await userEvent.click(screen.getAllByRole('button', { name: 'Remove this entry' })[1]);
  expect(await screen.findAllByPlaceholderText(/pick a past entry or type new/)).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'Save day' }));
  await waitFor(() =>
    expect(mockedSaveDay).toHaveBeenCalledWith('2024-01-01', [{ typeId: 's1', description: 'Went for a walk' }], 'g1')
  );
});

it('shows an error message when saving fails', async () => {
  mockedGetTypes.mockResolvedValue({ data: [booleanType], pagination: {} as any });
  mockedSaveDay.mockRejectedValue(new Error('save failed'));
  const onClose = vi.fn();
  render(<DayEditorDialog open date="2024-01-01" onClose={onClose} onSaved={vi.fn()} />);

  await screen.findByText('Kissed');
  await userEvent.click(screen.getByText('Kissed'));
  await userEvent.click(screen.getByRole('button', { name: 'Save day' }));

  expect(await screen.findByText('save failed')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it('calls onClose from the Cancel button', async () => {
  mockedGetTypes.mockResolvedValue({ data: [booleanType], pagination: {} as any });
  const onClose = vi.fn();
  render(<DayEditorDialog open date="2024-01-01" onClose={onClose} onSaved={vi.fn()} />);
  await screen.findByText('Kissed');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
