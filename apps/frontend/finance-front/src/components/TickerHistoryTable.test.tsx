import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TickerHistoryTable from './TickerHistoryTable';

const rows = [
  { date: '2024-05-01', price: 150.5, open: 149, high: 151, low: 148, volume: 1000000 },
  { date: '2024-05-02', price: 152.25 }
];

it('renders a row per history entry, formatting the date and defaulting missing fields to "-"', () => {
  render(<TickerHistoryTable rows={rows} />);

  expect(screen.getByText('01.05.2024')).toBeInTheDocument();
  expect(screen.getByText('149.00')).toBeInTheDocument();
  expect(screen.getByText('1,000,000')).toBeInTheDocument();
  // second row has no open/high/low/volume
  expect(screen.getAllByText('-').length).toBe(4);
  expect(screen.getByText('152.25')).toBeInTheDocument();
});

it('disables the delete button when no onDeleteRow handler is given', () => {
  render(<TickerHistoryTable rows={rows} />);
  const deleteButtons = screen.getAllByRole('button', { name: 'delete' });
  expect(deleteButtons[0]).toBeDisabled();
});

it('calls onDeleteRow with the clicked row and stops propagation', async () => {
  const onDeleteRow = vi.fn();
  render(<TickerHistoryTable rows={rows} onDeleteRow={onDeleteRow} />);

  const deleteButtons = screen.getAllByRole('button', { name: 'delete' });
  expect(deleteButtons[0]).toBeEnabled();
  await userEvent.click(deleteButtons[0]);

  expect(onDeleteRow).toHaveBeenCalledWith(rows[0]);
});
