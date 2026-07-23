import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CheckInDialog from './CheckInDialog';
import { AssetClass } from '../../types';

const assetClasses: AssetClass[] = [
  { _id: 'a1', name: 'Stocks', color: '#111111', userId: 'u1', createdAt: '', updatedAt: '' },
  { _id: 'a2', name: 'Cash', userId: 'u1', createdAt: '', updatedAt: '' }
];

function setMobile(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => setMobile(false));

function renderDialog(overrides: Partial<React.ComponentProps<typeof CheckInDialog>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <CheckInDialog
      open
      onClose={onClose}
      onSubmit={onSubmit}
      assetClasses={assetClasses}
      initialEntries={new Map()}
      defaultMonth="2024-05"
      saving={false}
      {...overrides}
    />
  );
  return { onClose, onSubmit };
}

it('shows the "Monthly check-in" title and hint copy when creating', () => {
  renderDialog();
  expect(screen.getByText('Monthly check-in')).toBeInTheDocument();
  expect(screen.getByText(/prefilled from your last/i)).toBeInTheDocument();
});

it('shows the edit title, locks the month field, and hides the hint when editing', () => {
  renderDialog({ editMonth: '2024-04' });
  expect(screen.getByText('Edit check-in · 2024-04')).toBeInTheDocument();
  expect(screen.queryByText(/prefilled from your last/i)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Month')).toBeDisabled();
});

it('prefills values from initialEntries, treating a zero gain as blank', () => {
  const initialEntries = new Map([
    ['a1', { value: 1000, gain: 50 }],
    ['a2', { value: 500, gain: 0 }]
  ]);
  renderDialog({ initialEntries });

  const valueInputs = screen.getAllByPlaceholderText('—') as HTMLInputElement[];
  expect(valueInputs[0].value).toBe('1000');
  expect(valueInputs[1].value).toBe('500');

  const gainInputs = screen.getAllByPlaceholderText('0') as HTMLInputElement[];
  expect(gainInputs[0].value).toBe('50');
  expect(gainInputs[1].value).toBe(''); // zero gain omitted
});

it('computes the net worth total live as values are typed', async () => {
  renderDialog();
  const valueInputs = screen.getAllByPlaceholderText('—');

  await userEvent.type(valueInputs[0], '1000');
  await userEvent.type(valueInputs[1], '500');

  expect(screen.getByText('1500 €')).toBeInTheDocument();
});

it('requires a valid month before submitting', async () => {
  renderDialog({ defaultMonth: '' });
  await userEvent.type(screen.getAllByPlaceholderText('—')[0], '100');

  await userEvent.click(screen.getByRole('button', { name: /save check-in/i }));

  expect(await screen.findByText('Pick a month first')).toBeInTheDocument();
});

it('requires at least one entry before submitting', async () => {
  renderDialog();
  await userEvent.click(screen.getByRole('button', { name: /save check-in/i }));

  expect(await screen.findByText('Enter a value for at least one asset class')).toBeInTheDocument();
});

it('submits entries with parsed values, defaulting a blank gain to 0, then closes', async () => {
  const { onClose, onSubmit } = renderDialog();
  const valueInputs = screen.getAllByPlaceholderText('—');
  await userEvent.type(valueInputs[0], '1000');

  await userEvent.click(screen.getByRole('button', { name: /save check-in/i }));

  await screen.findByRole; // flush a tick
  expect(onSubmit).toHaveBeenCalledWith('2024-05', [{ assetClassId: 'a1', value: 1000, gain: 0 }]);
  expect(onClose).toHaveBeenCalled();
});

it('shows an error message when onSubmit rejects', async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error('fail'));
  renderDialog({ onSubmit });
  await userEvent.type(screen.getAllByPlaceholderText('—')[0], '1000');

  await userEvent.click(screen.getByRole('button', { name: /save check-in/i }));

  expect(await screen.findByText('Failed to save check-in')).toBeInTheDocument();
});

it('disables the save button and shows "Saving…" while saving', () => {
  renderDialog({ saving: true });
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
});

it('calls onClose from the Cancel button', async () => {
  const { onClose } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});

it('allows changing the month and a gain value, computing the total from values only', async () => {
  renderDialog({ defaultMonth: '' });

  await userEvent.type(screen.getByLabelText('Month'), '2024-06');
  const valueInputs = screen.getAllByPlaceholderText('—');
  const gainInputs = screen.getAllByPlaceholderText('0');
  await userEvent.type(valueInputs[0], '1000');
  await userEvent.type(gainInputs[0], '50');

  expect(screen.getByText('1000 €')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /save check-in/i }));
  expect(screen.queryByText('Pick a month first')).not.toBeInTheDocument();
});

it('renders stacked cards in the mobile layout, supporting value/gain entry there too', async () => {
  setMobile(true);
  const { onSubmit } = renderDialog();

  const valueInputs = screen.getAllByPlaceholderText('—');
  const gainInputs = screen.getAllByPlaceholderText('0');
  await userEvent.type(valueInputs[0], '1000');
  await userEvent.type(gainInputs[0], '25');
  expect(screen.getByText('1000 €')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /save check-in/i }));
  expect(onSubmit).toHaveBeenCalledWith('2024-05', [{ assetClassId: 'a1', value: 1000, gain: 25 }]);
});
