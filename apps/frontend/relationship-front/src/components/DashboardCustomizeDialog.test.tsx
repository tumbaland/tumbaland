import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import DashboardCustomizeDialog from './DashboardCustomizeDialog';
import { ActivityType } from '../services/types';

const types: ActivityType[] = [
  { _id: 't1', id: 't1', name: 'Reading', slug: 'reading', color: '#111', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1' },
  { _id: 't2', id: 't2', name: 'Gaming', slug: 'gaming', isActive: true, sortOrder: 1, createdAt: '', updatedAt: '', userId: 'u1' }
];

function renderDialog(overrides: Partial<{ types: ActivityType[]; settings: any; onSave: any }> = {}) {
  const onClose = vi.fn();
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  render(
    <DashboardCustomizeDialog
      open
      types={overrides.types ?? types}
      settings={overrides.settings ?? { highlightTypeIds: [], hiddenTypeIds: [] }}
      onClose={onClose}
      onSave={onSave}
    />
  );
  return { onClose, onSave };
}

it('shows a prompt when there are no activity types', () => {
  renderDialog({ types: [] });
  expect(screen.getByText(/create some activity types first/i)).toBeInTheDocument();
});

it('renders a chip per type for both the highlight and hidden rows', () => {
  renderDialog();
  expect(screen.getAllByText('Reading').length).toBe(2); // one chip per row
  expect(screen.getAllByText('Gaming').length).toBe(2);
});

it('pre-selects chips from the current settings', () => {
  renderDialog({ settings: { highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'] } });
  expect(screen.getByText(/features "Reading" as its own color/)).toBeInTheDocument();
});

it('toggles a highlight chip on and off', async () => {
  renderDialog();
  const readingChips = screen.getAllByText('Reading');

  await userEvent.click(readingChips[0]); // highlight row
  expect(screen.getByText(/features "Reading" as its own color/)).toBeInTheDocument();

  await userEvent.click(readingChips[0]);
  expect(screen.queryByText(/features "Reading" as its own color/)).not.toBeInTheDocument();
});

it('saves the selected highlight/hidden ids and closes', async () => {
  const { onClose, onSave } = renderDialog();

  await userEvent.click(screen.getAllByText('Reading')[0]); // highlight
  await userEvent.click(screen.getAllByText('Gaming')[1]); // hidden
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onSave).toHaveBeenCalledWith({
    highlightTypeIds: ['t1'],
    hiddenTypeIds: ['t2'],
    startDate: null
  });
  await screen.findByRole('button', { name: 'Save' });
  expect(onClose).toHaveBeenCalled();
});

it('saves a chosen start date and pre-fills it from the current settings', async () => {
  const { onSave } = renderDialog({ settings: { highlightTypeIds: [], hiddenTypeIds: [], startDate: '2024-01-18' } });

  const field = screen.getByLabelText('Together since');
  expect(field).toHaveValue('2024-01-18');

  await userEvent.clear(field);
  await userEvent.type(field, '2023-05-06');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onSave).toHaveBeenCalledWith({
    highlightTypeIds: [],
    hiddenTypeIds: [],
    startDate: '2023-05-06'
  });
});

it('clears the start date back to the first-entry fallback', async () => {
  const { onSave } = renderDialog({ settings: { highlightTypeIds: [], hiddenTypeIds: [], startDate: '2024-01-18' } });

  await userEvent.clear(screen.getByLabelText('Together since'));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ startDate: null }));
});

it('offers the start date even before any activity types exist', () => {
  renderDialog({ types: [] });
  expect(screen.getByLabelText('Together since')).toBeInTheDocument();
});

it('shows an error message and re-enables the form when saving fails', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('fail'));
  const { onClose } = renderDialog({ onSave });

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('Failed to save dashboard settings')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

it('resets error/selection state and re-syncs from settings each time it opens', () => {
  const { rerender } = render(
    <DashboardCustomizeDialog
      open={false}
      types={types}
      settings={{ highlightTypeIds: ['t1'], hiddenTypeIds: [] }}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />
  );

  rerender(
    <DashboardCustomizeDialog
      open
      types={types}
      settings={{ highlightTypeIds: ['t1'], hiddenTypeIds: [] }}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />
  );

  expect(screen.getByText(/features "Reading" as its own color/)).toBeInTheDocument();
});

it('calls onClose from the Cancel button', async () => {
  const { onClose } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
