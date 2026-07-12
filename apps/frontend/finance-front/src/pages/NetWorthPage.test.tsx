import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../hooks/useSnapshots', () => ({
  useSnapshots: vi.fn(),
  useSaveSnapshot: vi.fn(),
  useDeleteSnapshot: vi.fn()
}));
vi.mock('../hooks/useAssetClasses', () => ({ useAssetClasses: vi.fn() }));

vi.mock('../components/net-worth/CheckInDialog', () => ({
  default: ({ open, onSubmit, onClose, editMonth, defaultMonth }: any) =>
    open ? (
      <div>
        <div>check-in dialog · {editMonth || defaultMonth}</div>
        <button onClick={() => onSubmit(editMonth || defaultMonth, [{ assetClassId: 'a1', value: 100, gain: 0 }])}>
          submit check-in
        </button>
        <button onClick={onClose}>close check-in</button>
      </div>
    ) : null
}));

vi.mock('../components/net-worth/AssetClassManagerDialog', () => ({
  default: ({ open, onClose }: any) => (open ? <div>class manager<button onClick={onClose}>close classes</button></div> : null)
}));

import { useSnapshots, useSaveSnapshot, useDeleteSnapshot } from '../hooks/useSnapshots';
import { useAssetClasses } from '../hooks/useAssetClasses';
import NetWorthPage from './NetWorthPage';

const mockedUseSnapshots = useSnapshots as unknown as ReturnType<typeof vi.fn>;
const mockedUseSaveSnapshot = useSaveSnapshot as unknown as ReturnType<typeof vi.fn>;
const mockedUseDeleteSnapshot = useDeleteSnapshot as unknown as ReturnType<typeof vi.fn>;
const mockedUseAssetClasses = useAssetClasses as unknown as ReturnType<typeof vi.fn>;

const mockedSaveMutateAsync = vi.fn();
const mockedDeleteMutateAsync = vi.fn();

const snapshots = [
  {
    _id: 's2',
    date: '2024-06-01T00:00:00.000Z',
    entries: [
      { assetClassId: 'a1', value: 1200, gain: 100 },
      { assetClassId: 'a2', value: 300, gain: 0 }
    ],
    userId: 'u1',
    createdAt: '',
    updatedAt: ''
  },
  {
    _id: 's1',
    date: '2024-05-01T00:00:00.000Z',
    entries: [{ assetClassId: 'a1', value: 1000, gain: 50 }],
    userId: 'u1',
    createdAt: '',
    updatedAt: ''
  }
];

const assetClasses = [
  { _id: 'a1', name: 'Stocks', color: '#111111', userId: 'u1', createdAt: '', updatedAt: '' },
  { _id: 'a2', name: 'Cash', userId: 'u1', createdAt: '', updatedAt: '' }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseSaveSnapshot.mockReturnValue({ mutateAsync: mockedSaveMutateAsync, isPending: false });
  mockedUseDeleteSnapshot.mockReturnValue({ mutateAsync: mockedDeleteMutateAsync });
  mockedUseAssetClasses.mockReturnValue({ data: assetClasses });
});

it('shows a spinner while loading', () => {
  mockedUseSnapshots.mockReturnValue({ data: [], isLoading: true, error: null });
  render(<NetWorthPage />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the query fails', () => {
  mockedUseSnapshots.mockReturnValue({ data: [], isLoading: false, error: new Error('boom') });
  render(<NetWorthPage />);
  expect(screen.getByText('Failed to load net worth history')).toBeInTheDocument();
});

it('shows the empty state with no summary cards when there are no snapshots', () => {
  mockedUseSnapshots.mockReturnValue({ data: [], isLoading: false, error: null });
  render(<NetWorthPage />);
  expect(screen.getByText('No check-ins yet')).toBeInTheDocument();
  expect(screen.queryByText(/Net worth ·/)).not.toBeInTheDocument();
});

it('renders the summary cards, month-over-month change, and history rows', () => {
  mockedUseSnapshots.mockReturnValue({ data: snapshots, isLoading: false, error: null });
  render(<NetWorthPage />);

  expect(screen.getByText('Net worth · 2024-06')).toBeInTheDocument();
  expect(screen.getByText('Change vs previous month')).toBeInTheDocument();
  // total 1500 vs prev 1000 -> +500 change
  expect(screen.getByText('2024-06')).toBeInTheDocument();
  expect(screen.getByText('2024-05')).toBeInTheDocument();
});

it('expands a row to show its per-asset-class breakdown, then collapses it', async () => {
  mockedUseSnapshots.mockReturnValue({ data: snapshots, isLoading: false, error: null });
  render(<NetWorthPage />);

  await userEvent.click(screen.getByText('2024-06'));
  expect(await screen.findByText(/Stocks: /)).toBeInTheDocument();

  await userEvent.click(screen.getByText('2024-06'));
});

it('opens the check-in dialog for a new entry, submits, and shows a success snackbar', async () => {
  mockedUseSnapshots.mockReturnValue({ data: snapshots, isLoading: false, error: null });
  mockedSaveMutateAsync.mockResolvedValue({});
  render(<NetWorthPage />);

  await userEvent.click(screen.getByRole('button', { name: /add check-in/i }));
  expect(screen.getByText(/check-in dialog · 2024-07/)).toBeInTheDocument();

  await userEvent.click(screen.getByText('submit check-in'));

  expect(mockedSaveMutateAsync).toHaveBeenCalledWith({
    month: '2024-07',
    entries: [{ assetClassId: 'a1', value: 100, gain: 0 }],
    groupId: 'g1'
  });
  expect(await screen.findByText('Check-in for 2024-07 saved')).toBeInTheDocument();
});

it('opens the check-in dialog pre-targeted at an existing row for editing', async () => {
  mockedUseSnapshots.mockReturnValue({ data: snapshots, isLoading: false, error: null });
  render(<NetWorthPage />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);

  expect(screen.getByText('check-in dialog · 2024-06')).toBeInTheDocument();
});

it('deletes a check-in after confirming, and shows a success snackbar', async () => {
  mockedUseSnapshots.mockReturnValue({ data: snapshots, isLoading: false, error: null });
  mockedDeleteMutateAsync.mockResolvedValue({});
  render(<NetWorthPage />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(mockedDeleteMutateAsync).toHaveBeenCalledWith('s2');
  expect(await screen.findByText('Check-in deleted')).toBeInTheDocument();
});

it('shows an error snackbar when deleting a check-in fails', async () => {
  mockedUseSnapshots.mockReturnValue({ data: snapshots, isLoading: false, error: null });
  mockedDeleteMutateAsync.mockRejectedValue(new Error('fail'));
  render(<NetWorthPage />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(await screen.findByText('Failed to delete check-in')).toBeInTheDocument();
});

it('opens and closes the asset class manager', async () => {
  mockedUseSnapshots.mockReturnValue({ data: snapshots, isLoading: false, error: null });
  render(<NetWorthPage />);

  await userEvent.click(screen.getByRole('button', { name: /asset classes/i }));
  expect(screen.getByText('class manager')).toBeInTheDocument();

  await userEvent.click(screen.getByText('close classes'));
  expect(screen.queryByText('class manager')).not.toBeInTheDocument();
});
