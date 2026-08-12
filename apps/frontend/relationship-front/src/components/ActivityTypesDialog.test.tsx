import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('./ActivityTypesManagement', () => ({
  default: ({ groupId, onChanged }: { groupId?: string; onChanged?: () => void }) => (
    <div>
      <div>Management for {groupId ?? 'personal'}</div>
      <button onClick={onChanged}>report-change</button>
    </div>
  )
}));

import ActivityTypesDialog from './ActivityTypesDialog';

it('renders nothing while closed', () => {
  render(<ActivityTypesDialog open={false} onClose={vi.fn()} />);
  expect(screen.queryByText('Activity Types')).not.toBeInTheDocument();
});

it('renders the management list for the active group', () => {
  render(<ActivityTypesDialog open onClose={vi.fn()} groupId="g1" />);

  expect(screen.getByText('Activity Types')).toBeInTheDocument();
  expect(screen.getByText('Management for g1')).toBeInTheDocument();
});

it('closes from both the close icon and Done', async () => {
  const onClose = vi.fn();
  render(<ActivityTypesDialog open onClose={onClose} />);

  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: 'Done' }));

  expect(onClose).toHaveBeenCalledTimes(2);
});

it('forwards changes to the caller', async () => {
  const onChanged = vi.fn();
  render(<ActivityTypesDialog open onClose={vi.fn()} onChanged={onChanged} />);

  await userEvent.click(screen.getByText('report-change'));

  expect(onChanged).toHaveBeenCalled();
});
