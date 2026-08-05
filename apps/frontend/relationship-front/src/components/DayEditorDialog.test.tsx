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
vi.mock('../services/places', () => ({
  getPlaces: vi.fn()
}));

// The place picker owns its own map and geocoder, both covered by its own
// tests; here it is reduced to the contract this dialog depends on.
vi.mock('./map/LocationPicker', () => ({
  default: ({
    value,
    onChange,
    label
  }: {
    value: { label: string; lat: number; lng: number } | null;
    onChange: (location: { label: string; lat: number; lng: number } | null) => void;
    label?: string;
  }) => (
    <div>
      <span data-testid="picker-label">{label}</span>
      <span data-testid="picker-value">{value ? value.label : 'none'}</span>
      <button type="button" onClick={() => onChange({ label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 })}>
        pick place
      </button>
      <button type="button" onClick={() => onChange(null)}>
        clear place
      </button>
    </div>
  )
}));

import { getActivityTypes } from '../services/activityTypes';
import { getActivityDescriptions } from '../services/activities';
import { getDays, saveDay } from '../services/days';
import { getPlaces } from '../services/places';
import { ActivityTypesResponse } from '../services/activityTypes';
import DayEditorDialog from './DayEditorDialog';

const mockedGetTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;
const mockedGetDescriptions = getActivityDescriptions as unknown as ReturnType<typeof vi.fn>;
const mockedGetDays = getDays as unknown as ReturnType<typeof vi.fn>;
const mockedSaveDay = saveDay as unknown as ReturnType<typeof vi.fn>;
const mockedGetPlaces = getPlaces as unknown as ReturnType<typeof vi.fn>;

const booleanType = { _id: 'b1', id: 'b1', name: 'Kissed', slug: 'kissed', valueType: 'boolean', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1' };
const numberType = { _id: 'n1', id: 'n1', name: 'Exercise', slug: 'exercise', valueType: 'number', isActive: true, sortOrder: 1, createdAt: '', updatedAt: '', userId: 'u1' };
const stringType = { _id: 's1', id: 's1', name: 'Notes', slug: 'notes', valueType: 'string', isActive: true, sortOrder: 2, createdAt: '', updatedAt: '', userId: 'u1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetDescriptions.mockResolvedValue([]);
  mockedGetDays.mockResolvedValue({ days: [] });
  mockedGetPlaces.mockResolvedValue([]);
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

const locationType = {
  _id: 'l1',
  id: 'l1',
  name: 'Restaurants',
  slug: 'restaurants',
  valueType: 'string' as const,
  hasLocation: true,
  isActive: true,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
  userId: 'u1'
};

const savedPlace = {
  id: '59.4405,24.7453',
  label: 'Kolm Sõsarat',
  lat: 59.4405,
  lng: 24.7453,
  visits: 2,
  firstVisit: '2024-01-02',
  lastVisit: '2024-06-11',
  types: []
};

it('does not fetch saved places when no type tracks a location', async () => {
  mockedGetTypes.mockResolvedValue({ data: [booleanType], pagination: {} as ActivityTypesResponse['pagination'] });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  await screen.findByText('Kissed');
  expect(mockedGetPlaces).not.toHaveBeenCalled();
});

it('fetches saved places for the scope when a type tracks a location', async () => {
  mockedGetTypes.mockResolvedValue({ data: [locationType], pagination: {} as ActivityTypesResponse['pagination'] });
  mockedGetPlaces.mockResolvedValue([savedPlace]);
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  await screen.findByText('Restaurants');
  await waitFor(() => expect(mockedGetPlaces).toHaveBeenCalledWith({ groupId: 'g1' }));
});

it('shows the place picker only for types that track a location', async () => {
  mockedGetTypes.mockResolvedValue({ data: [booleanType, locationType], pagination: {} as ActivityTypesResponse['pagination'] });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  await screen.findByText('Kissed');
  await userEvent.click(screen.getByText('Kissed'));
  expect(screen.queryByTestId('picker-value')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('Restaurants'));
  expect(await screen.findByTestId('picker-value')).toHaveTextContent('none');
});

it('saves a picked place with the entry', async () => {
  mockedGetTypes.mockResolvedValue({ data: [locationType], pagination: {} as ActivityTypesResponse['pagination'] });
  mockedSaveDay.mockResolvedValue({ date: '2024-01-01', entries: [] });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  await screen.findByText('Restaurants');
  await userEvent.click(screen.getByText('Restaurants'));
  await userEvent.click(await screen.findByRole('button', { name: 'pick place' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save day' }));

  await waitFor(() =>
    expect(mockedSaveDay).toHaveBeenCalledWith(
      '2024-01-01',
      [{ typeId: 'l1', location: { label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 } }],
      'g1'
    )
  );
});

it('sends a null location so clearing a place removes it on save', async () => {
  mockedGetTypes.mockResolvedValue({ data: [locationType], pagination: {} as ActivityTypesResponse['pagination'] });
  mockedGetDays.mockResolvedValue({
    days: [
      {
        date: '2024-01-01',
        entries: [
          {
            _id: 'e1',
            typeId: 'l1',
            description: '',
            location: { label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 }
          }
        ]
      }
    ]
  });
  mockedSaveDay.mockResolvedValue({ date: '2024-01-01', entries: [] });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  expect(await screen.findByTestId('picker-value')).toHaveTextContent('Kolm Sõsarat');
  await userEvent.click(screen.getByRole('button', { name: 'clear place' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save day' }));

  await waitFor(() =>
    expect(mockedSaveDay).toHaveBeenCalledWith('2024-01-01', [{ _id: 'e1', typeId: 'l1', location: null }], 'g1')
  );
});

it('numbers the pickers when a location type has several entries', async () => {
  mockedGetTypes.mockResolvedValue({ data: [locationType], pagination: {} as ActivityTypesResponse['pagination'] });
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  await screen.findByText('Restaurants');
  await userEvent.click(screen.getByText('Restaurants'));
  expect(await screen.findByTestId('picker-label')).toHaveTextContent('Place');

  await userEvent.click(screen.getByRole('button', { name: /add another restaurants/i }));

  const labels = await screen.findAllByTestId('picker-label');
  expect(labels.map((node) => node.textContent)).toEqual(['Place 1', 'Place 2']);
});

it('still renders the day when loading saved places fails', async () => {
  mockedGetTypes.mockResolvedValue({ data: [locationType], pagination: {} as ActivityTypesResponse['pagination'] });
  mockedGetPlaces.mockRejectedValue(new Error('boom'));
  render(<DayEditorDialog open date="2024-01-01" onClose={vi.fn()} onSaved={vi.fn()} />);

  expect(await screen.findByText('Restaurants')).toBeInTheDocument();
  expect(screen.queryByText('Failed to load this day')).not.toBeInTheDocument();
});
