import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MenuList from '@mui/material/MenuList';

const pushSupport = vi.fn();
const enableNotifications = vi.fn();
const disableNotifications = vi.fn();

vi.mock('../services/pushNotifications', () => ({
  pushSupport: () => pushSupport(),
  enableNotifications: () => enableNotifications(),
  disableNotifications: () => disableNotifications()
}));

import { NotificationSetting } from './NotificationSetting';

/**
 * It lives inside the account menu, and MUI's MenuItem reads a context that
 * only Menu or MenuList provides.
 */
const render = (element: React.ReactElement) => rtlRender(<MenuList>{element}</MenuList>);

const getSubscription = vi.fn();

beforeEach(() => {
  pushSupport.mockReturnValue('needs-permission');
  enableNotifications.mockResolvedValue('ready');
  disableNotifications.mockResolvedValue(undefined);
  getSubscription.mockResolvedValue(null);

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription } }) }
  });
});

afterEach(() => vi.clearAllMocks());

describe('when notifications can be turned on', () => {
  it('shows a switch', () => {
    render(<NotificationSetting />);

    expect(screen.getByRole('switch', { name: 'Message notifications' })).toBeInTheDocument();
  });

  it('subscribes when switched on', async () => {
    render(<NotificationSetting />);

    await userEvent.click(screen.getByText('Message notifications'));

    expect(enableNotifications).toHaveBeenCalled();
  });

  it('only asks from the tap, never on render', () => {
    // iOS refuses a permission request without a gesture, and Chrome holds
    // asking-on-load against the site's standing.
    render(<NotificationSetting />);

    expect(enableNotifications).not.toHaveBeenCalled();
  });

  it('reflects an existing subscription as already on', async () => {
    pushSupport.mockReturnValue('ready');
    getSubscription.mockResolvedValue({ endpoint: 'https://push/abc' });

    render(<NotificationSetting />);

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Message notifications' })).toBeChecked()
    );
  });

  it('shows off when permission is granted but nothing is subscribed', async () => {
    // Granted permission is not the same as a live subscription.
    pushSupport.mockReturnValue('ready');
    getSubscription.mockResolvedValue(null);

    render(<NotificationSetting />);

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Message notifications' })).not.toBeChecked()
    );
  });

  it('unsubscribes when switched off', async () => {
    pushSupport.mockReturnValue('ready');
    getSubscription.mockResolvedValue({ endpoint: 'https://push/abc' });
    render(<NotificationSetting />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());

    await userEvent.click(screen.getByText('Message notifications'));

    expect(disableNotifications).toHaveBeenCalled();
  });

  it('stays off when permission is refused', async () => {
    enableNotifications.mockResolvedValue('denied');
    render(<NotificationSetting />);

    await userEvent.click(screen.getByText('Message notifications'));

    await waitFor(() => expect(screen.getByText(/blocked/i)).toBeInTheDocument());
  });
});

describe('when notifications cannot be turned on', () => {
  it('tells an iPhone in a tab to install, rather than claiming no support', async () => {
    pushSupport.mockReturnValue('needs-install');

    render(<NotificationSetting />);

    expect(screen.getByText(/Add Tumbaland to your Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('explains that a block can only be undone in browser settings', () => {
    pushSupport.mockReturnValue('denied');

    render(<NotificationSetting />);

    expect(screen.getByText(/browser settings/)).toBeInTheDocument();
  });

  it('says plainly when the browser cannot do it at all', () => {
    pushSupport.mockReturnValue('unsupported');

    render(<NotificationSetting />);

    expect(screen.getByText(/cannot show notifications/)).toBeInTheDocument();
  });

  it('cannot be tapped when unavailable', () => {
    pushSupport.mockReturnValue('unsupported');
    render(<NotificationSetting />);

    expect(screen.getByRole('menuitem')).toHaveAttribute('aria-disabled', 'true');
    expect(enableNotifications).not.toHaveBeenCalled();
  });
});
