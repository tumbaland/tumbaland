import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('../services/serviceWorker', () => ({ applyUpdate: vi.fn() }));

import { applyUpdate } from '../services/serviceWorker';
import { UpdatePrompt } from './UpdatePrompt';

beforeEach(() => vi.clearAllMocks());

it('says nothing while closed', () => {
  render(<UpdatePrompt open={false} onDismiss={vi.fn()} />);
  expect(screen.queryByText('A new version is ready')).not.toBeInTheDocument();
});

it('applies the update when the person reloads', async () => {
  const onDismiss = vi.fn();
  render(<UpdatePrompt open onDismiss={onDismiss} />);

  await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

  expect(applyUpdate).toHaveBeenCalledTimes(1);
  expect(onDismiss).not.toHaveBeenCalled();
});

it('keeps the current version on Later', async () => {
  const onDismiss = vi.fn();
  render(<UpdatePrompt open onDismiss={onDismiss} />);

  await userEvent.click(screen.getByRole('button', { name: 'Later' }));

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(applyUpdate).not.toHaveBeenCalled();
});

it('is dismissed with Escape, but not by a click elsewhere', async () => {
  const onDismiss = vi.fn();
  render(
    <>
      <button type="button">elsewhere</button>
      <UpdatePrompt open onDismiss={onDismiss} />
    </>
  );

  // A choice to make, not a notice to miss: tapping the page behind does not answer it.
  await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
  expect(onDismiss).not.toHaveBeenCalled();

  await userEvent.keyboard('{Escape}');
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
