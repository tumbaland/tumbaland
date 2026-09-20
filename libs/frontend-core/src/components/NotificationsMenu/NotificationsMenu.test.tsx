import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsMenu, NotificationsMenuProps } from './NotificationsMenu';

// The component is a controlled anchorEl/onClick/onClose triple driven by the
// parent (see AuthHeader) — a tiny stateful harness exercises it the same way.
function NotificationsMenuHarness(props: Partial<NotificationsMenuProps>) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  return (
    <NotificationsMenu
      notificationCount={props.notificationCount}
      marginRight={props.marginRight}
      anchorEl={anchorEl}
      onClick={(event) => setAnchorEl(event.currentTarget)}
      onClose={() => setAnchorEl(null)}
    />
  );
}

describe('NotificationsMenu', () => {
  it('does not show menu content until opened', () => {
    render(<NotificationsMenuHarness />);

    expect(screen.queryByText(/no new notifications/i)).not.toBeInTheDocument();
  });

  it('opens on click and shows the empty state when there are no notifications', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenuHarness />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText(/no new notifications/i)).toBeInTheDocument();
  });

  it('shows a pluralized notification count message', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenuHarness notificationCount={3} />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText('You have 3 new notifications')).toBeInTheDocument();
  });

  it('shows a singular message for exactly one notification', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenuHarness notificationCount={1} />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText('You have 1 new notification')).toBeInTheDocument();
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<NotificationsMenuHarness notificationCount={2} />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findByText(/new notifications/i)).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByText(/new notifications/i)).not.toBeInTheDocument();
  });
});
