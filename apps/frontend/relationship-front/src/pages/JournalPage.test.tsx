import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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
vi.mock('../components/ActivityTypesDialog', () => ({
  default: ({ open, groupId, onClose, onChanged }: any) =>
    open ? (
      <div>
        <div>ActivityTypesDialog for {groupId}</div>
        <button onClick={onClose}>close-types</button>
        <button onClick={onChanged}>change-types</button>
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

// The page reads ?date= to deep-link a day from the map, so it needs a Router.
const renderPage = (initialEntry = '/journal') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <JournalPage />
    </MemoryRouter>
  );

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
  renderPage();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when loading fails', async () => {
  mockedGetDays.mockRejectedValue(new Error('boom'));
  renderPage();
  expect(await screen.findByText('Failed to load the journal')).toBeInTheDocument();
});

it('shows an empty state with a Log today shortcut when there are no days', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
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
  renderPage();

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
  renderPage();

  const editButton = await screen.findByRole('button', { name: "Edit today's log" });
  await userEvent.click(editButton);

  expect(screen.getByText(`DayEditorDialog for ${todayKey()}`)).toBeInTheDocument();
});

it('opens a date-editable editor via "Other day"', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
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
  renderPage();
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByText(/Book club/));
  expect(screen.getByText('DayEditorDialog for 2024-05-01')).toBeInTheDocument();
});

it('reloads the journal when the editor reports a save', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
  await screen.findByText('Nothing logged yet');

  await userEvent.click(screen.getAllByRole('button', { name: 'Log today' })[0]);
  await userEvent.click(screen.getByText('save-editor'));

  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledTimes(2));
});

it('filters by search text after debounce', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
  await screen.findByText('Nothing logged yet');

  await userEvent.type(screen.getByPlaceholderText('Search descriptions…'), 'walk');

  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ search: 'walk' })), {
    timeout: 1000
  });
  expect(screen.getByText('No days match these filters')).toBeInTheDocument();
});

it('filters by activity type', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
  await screen.findByText('Nothing logged yet');

  const typeSelect = await screen.findByLabelText('Activity');
  await userEvent.click(typeSelect);
  await userEvent.click(await screen.findByText('Reading'));

  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ typeId: 't1' })));
});

it('manages activity types in a dialog opened from the journal', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
  await screen.findByText('Nothing logged yet');

  await userEvent.click(screen.getByRole('button', { name: 'Manage types' }));
  expect(screen.getByText('ActivityTypesDialog for g1')).toBeInTheDocument();

  await userEvent.click(screen.getByText('close-types'));
  expect(screen.queryByText('ActivityTypesDialog for g1')).not.toBeInTheDocument();
});

it('refreshes the types and the days after a type is changed', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
  await screen.findByText('Nothing logged yet');

  await userEvent.click(screen.getByRole('button', { name: 'Manage types' }));
  await userEvent.click(screen.getByText('change-types'));

  await waitFor(() => expect(mockedGetActivityTypes).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledTimes(2));
});

// Filtering by a type that gets deleted in the manage dialog would otherwise
// leave the journal permanently empty with no obvious way back.
it('drops the activity filter when that type no longer exists', async () => {
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 1, total: 0 });
  renderPage();
  await screen.findByText('Nothing logged yet');

  await userEvent.click(await screen.findByLabelText('Activity'));
  await userEvent.click(await screen.findByText('Reading'));
  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ typeId: 't1' })));

  mockedGetActivityTypes.mockResolvedValue({ data: [], pagination: {} as any });
  await userEvent.click(screen.getByRole('button', { name: 'Manage types' }));
  await userEvent.click(screen.getByText('change-types'));

  await waitFor(() =>
    expect(mockedGetDays).toHaveBeenLastCalledWith(expect.objectContaining({ typeId: undefined }))
  );
});

it('loads more days via the Load older days button', async () => {
  mockedGetDays
    .mockResolvedValueOnce({ days: [dayWithEntry('2024-05-01')], page: 1, totalPages: 2, total: 2 })
    .mockResolvedValueOnce({ days: [dayWithEntry('2024-04-01')], page: 2, totalPages: 2, total: 2 });
  renderPage();
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

  renderPage();
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

  expect(createObjectURL).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
});

it('shows the place on an entry chip when one was logged', async () => {
  mockedGetDays.mockResolvedValue({
    days: [
      {
        date: '2024-05-01',
        entries: [
          {
            _id: 'e1',
            typeId: 't1',
            type: readingType,
            description: 'tasting menu',
            location: { label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 }
          }
        ]
      }
    ],
    total: 1,
    page: 1,
    totalPages: 1
  });
  renderPage();

  expect(await screen.findByText('Kolm Sõsarat')).toBeInTheDocument();
});

it('opens the day editor for a ?date= deep link from the map', async () => {
  mockedGetDays.mockResolvedValue({ days: [], total: 0, page: 1, totalPages: 0 });
  renderPage('/journal?date=2024-05-01');

  expect(await screen.findByText('DayEditorDialog for 2024-05-01')).toBeInTheDocument();
});

it('ignores a malformed ?date= value', async () => {
  mockedGetDays.mockResolvedValue({ days: [], total: 0, page: 1, totalPages: 0 });
  renderPage('/journal?date=last-tuesday');

  await screen.findByText('Nothing logged yet');
  expect(screen.queryByText(/DayEditorDialog for/)).not.toBeInTheDocument();
});

it('includes the place columns in the CSV export', async () => {
  let exported = '';
  const createObjectURL = vi.fn((blob: Blob) => {
    void blob.text().then((text) => {
      exported = text;
    });
    return 'blob:mock';
  });
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  mockedGetDays.mockResolvedValue({
    days: [
      dayWithEntry('2024-05-01', {
        description: 'tasting menu',
        location: { label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 }
      })
    ],
    page: 1,
    totalPages: 1,
    total: 1
  });
  renderPage();
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

  await waitFor(() => expect(exported).toContain('"Place","Latitude","Longitude"'));
  expect(exported).toContain('"Kolm Sõsarat","59.4405","24.7453"');
});

it('exports every matching day, not just the pages already loaded', async () => {
  let exported = '';
  URL.createObjectURL = vi.fn((blob: Blob) => {
    void blob.text().then((text) => {
      exported = text;
    });
    return 'blob:mock';
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  // On screen: one page of the paginated view. The export must re-fetch and
  // walk every page rather than serialising what happens to be in state.
  mockedGetDays.mockImplementation(({ limit, page }: any) => {
    if (limit === 30) {
      return Promise.resolve({ days: [dayWithEntry('2024-05-01')], page: 1, totalPages: 3, total: 3 });
    }
    return Promise.resolve({
      days: [dayWithEntry(page === 1 ? '2024-05-01' : '2024-03-01')],
      page,
      totalPages: 2,
      total: 2
    });
  });

  renderPage();
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

  await waitFor(() => expect(exported).toContain('2024-03-01'));
  expect(exported).toContain('2024-05-01');
  // page 1 and page 2 of the export-sized pages, on top of the initial view load
  expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ limit: 200, page: 1 }));
  expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ limit: 200, page: 2 }));
});

it('reports a failure to export without wiping the journal', async () => {
  mockedGetDays.mockImplementation(({ limit }: any) =>
    limit === 30
      ? Promise.resolve({ days: [dayWithEntry('2024-05-01')], page: 1, totalPages: 1, total: 1 })
      : Promise.reject(new Error('boom'))
  );

  renderPage();
  await screen.findByText('May 2024');

  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

  expect(await screen.findByText('Failed to export the journal')).toBeInTheDocument();
  expect(screen.getByText('May 2024')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
});
