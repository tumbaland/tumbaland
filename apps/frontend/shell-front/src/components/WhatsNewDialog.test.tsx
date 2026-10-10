import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import { APP_VERSION, RECENT_NOTES, groupByDate } from '../config/releaseNotes';
import { WhatsNewDialog } from './WhatsNewDialog';

it('renders nothing while closed', () => {
  render(<WhatsNewDialog open={false} onClose={vi.fn()} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('lists every note under its date, with the version at the foot', () => {
  render(<WhatsNewDialog open onClose={vi.fn()} />);

  const dialog = screen.getByRole('dialog', { name: "What's new" });
  expect(within(dialog).getAllByRole('heading', { level: 3 })).toHaveLength(groupByDate(RECENT_NOTES).length);
  for (const note of RECENT_NOTES) {
    for (const item of note.items) expect(within(dialog).getByText(item)).toBeInTheDocument();
  }
  expect(within(dialog).getByText(`Tumbaland ${APP_VERSION}`)).toBeInTheDocument();
});

it('closes from the button', async () => {
  const onClose = vi.fn();
  render(<WhatsNewDialog open onClose={onClose} />);

  await userEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
