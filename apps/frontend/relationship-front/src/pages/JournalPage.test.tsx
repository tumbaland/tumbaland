import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/days', () => ({
  getDays: vi.fn()
}));
vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn()
}));
vi.mock('../components/DayEditorDialog', () => ({
  default: ({ open, date, onClose, onSaved }: any) =>
    open ? (
      <div>
        <div>DayEditorDialog for {date}</div>
        <button onClick={onClose}>close-editor</button>
        <button onClick={onSaved}>save-editor</button>
      </div>
    ) : null
}));

import { getDays } from '../services/days';
import { getActivityTypes } from '../services/activityTypes';
import JournalPage from './JournalPage';

const mockedGetDays = getDays as unknown as ReturnType<typeof vi.fn>;
const mockedGetActivityTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;

const readingType = { _id: 't1', id: 't1', name: 'Reading', slug: 'reading', color: '#111', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1' };

const todayKey = () => new Date().toISOString().slice(0, 10);

const dayWithEntry = (date: string, overrides: Partial<any> = {}) => ({
  date,
  entries: [{ _id: 'e1', typeId: 't1', type: readingType, description: 'Book club', ...overrides }]
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetActivityTypes.mockResolvedValue({ data: [readingType], pagination: {} as any });
});

it('shows a spinner while loading', () => {
  mockedGetDays.mockReturnValue(new Promise(() => {}));
  render(<JournalPage />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when loading fails', async () => {
  mockedGetDays.mockRejectedValue(new Error('boom'));
  render(<JournalPage />);
  expect(await screen.findByText('Failed to load the journal')).toBeInTheDocument();
});

it('shows an empty state with a Log today shortcut when there are no days', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  render(<JournalPage />);
  expect(await screen.findByText('Nothing logged yet')).toBeInTheDocument();
  expect(screen.getByText('Your days together')).toBeInTheDocument();
});

it('renders days grouped by month with entry chips, and a day count', async () => {
  mockedGetDays.mockResolvedValue({
    days: [dayWithEntry('2024-05-01')],
    page: 1,
    totalPages: 1,
    total: 1
  });
  render(<JournalPage />);

  expect(await screen.findByText('1 day logged')).toBeInTheDocument();
  expect(screen.getByText('May 2024')).toBeInTheDocument();
  expect(screen.getByText(/Book club/)).toBeInTheDocument();
});

it('opens the editor for today via "Log today" and shows "Edit today\'s log" once today exists', async () => {
  mockedGetDays.mockResolvedValue({
    days: [dayWithEntry(todayKey())],
    page: 1,
    totalPages: 1,
    total: 1
  });
  render(<JournalPage />);

  const editButton = await screen.findByRole('button', { name: "Edit today's log" });
  await userEvent.click(editButton);

  expect(screen.getByText(`DayEditorDialog for ${todayKey()}`)).toBeInTheDocument();
});

it('opens a date-editable editor via "Other day"', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  render(<JournalPage />);
  await screen.findByText('Nothing logged yet');

  await userEvent.click(screen.getByRole('button', { name: 'Other day' }));
  expect(screen.getByText(`DayEditorDialog for ${todayKey()}`)).toBeInTheDocument();
});

it('opens the editor for a specific day from its card', async () => {
  mockedGetDays.mockResolvedValue({
    days: [dayWithEntry('2024-05-01')],
    page: 1,
    totalPages: 1,
    total: 1
  });
  render(<JournalPage />);
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByText(/Book club/));
  expect(screen.getByText('DayEditorDialog for 2024-05-01')).toBeInTheDocument();
});

it('reloads the journal when the editor reports a save', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  render(<JournalPage />);
  await screen.findByText('Nothing logged yet');

  await userEvent.click(screen.getAllByRole('button', { name: 'Log today' })[0]);
  await userEvent.click(screen.getByText('save-editor'));

  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledTimes(2));
});

it('filters by search text after debounce', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  render(<JournalPage />);
  await screen.findByText('Nothing logged yet');

  await userEvent.type(screen.getByPlaceholderText('Search descriptions…'), 'walk');

  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ search: 'walk' })), {
    timeout: 1000
  });
  expect(screen.getByText('No days match these filters')).toBeInTheDocument();
});

it('filters by activity type', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  render(<JournalPage />);
  await screen.findByText('Nothing logged yet');

  const typeSelect = await screen.findByLabelText('Activity');
  await userEvent.click(typeSelect);
  await userEvent.click(await screen.findByText('Reading'));

  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ typeId: 't1' })));
});

it('loads more days via the Load older days button', async () => {
  mockedGetDays
    .mockResolvedValueOnce({ days: [dayWithEntry('2024-05-01')], page: 1, totalPages: 2, total: 2 })
    .mockResolvedValueOnce({ days: [dayWithEntry('2024-04-01')], page: 2, totalPages: 2, total: 2 });
  render(<JournalPage />);
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByRole('button', { name: 'Load older days' }));

  expect(await screen.findByText('April 2024')).toBeInTheDocument();
});

it('exports a CSV when the Export button is clicked', async () => {
  mockedGetDays.mockResolvedValue({
    days: [dayWithEntry('2024-05-01')],
    page: 1,
    totalPages: 1,
    total: 1
  });
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  (URL as any).createObjectURL = createObjectURL;
  (URL as any).revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  render(<JournalPage />);
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

  expect(createObjectURL).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
});
