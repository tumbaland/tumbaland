import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../../services/deviceService', () => ({
  deviceService: { list: vi.fn(), signOut: vi.fn(), signOutOthers: vi.fn() }
}));

vi.mock('@tumbaland/frontend-core', async () => {
  const actual = await vi.importActual('@tumbaland/frontend-core');
  return { ...actual, logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } };
});

import { Device, deviceService } from '../../services/deviceService';
import DevicesTab from './DevicesTab';

const mocked = deviceService as unknown as {
  list: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  signOutOthers: ReturnType<typeof vi.fn>;
};

const device = (over: Partial<Device> = {}): Device => ({
  id: 's1',
  device: 'Safari on iPhone',
  country: 'EE',
  method: 'google',
  createdAt: '2026-09-19T19:40:00.000Z',
  lastSeenAt: '2026-09-19T20:12:00.000Z',
  expiresAt: '2026-10-19T20:12:00.000Z',
  current: false,
  ...over
});

const renderTab = async (devices: Device[]) => {
  mocked.list.mockResolvedValue(devices);
  render(<DevicesTab />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
};

beforeEach(() => vi.clearAllMocks());

it('lists each device with where it was last seen, marking this one', async () => {
  await renderTab([
    device({ id: 'here', device: 'Chrome on Android', current: true }),
    device({ id: 'there', device: 'Safari on iPhone', country: 'EE' })
  ]);

  expect(screen.getByText('Chrome on Android')).toBeInTheDocument();
  expect(screen.getByText('Safari on iPhone')).toBeInTheDocument();
  expect(screen.getByText('This device')).toBeInTheDocument();
  expect(screen.getAllByText('Estonia').length).toBeGreaterThan(0);
});

it('signs out another device and drops it from the list', async () => {
  mocked.signOut.mockResolvedValue(false);
  await renderTab([device({ id: 'here', device: 'Chrome on Android', current: true }), device({ id: 'there' })]);

  await userEvent.click(screen.getByRole('button', { name: 'Sign out device' }));

  expect(mocked.signOut).toHaveBeenCalledWith('there');
  await waitFor(() => expect(screen.queryByText('Safari on iPhone')).not.toBeInTheDocument());
  expect(screen.getByText('Signed out Safari on iPhone.')).toBeInTheDocument();
});

it('reloads when this device signs itself out', async () => {
  mocked.signOut.mockResolvedValue(true);
  const reload = vi.fn();
  const original = window.location;
  Object.defineProperty(window, 'location', { writable: true, value: { ...original, reload } });
  await renderTab([device({ id: 'here', current: true })]);

  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

  await waitFor(() => expect(reload).toHaveBeenCalled());
  Object.defineProperty(window, 'location', { writable: true, value: original });
});

it('signs out every other device at once', async () => {
  mocked.signOutOthers.mockResolvedValue(2);
  await renderTab([
    device({ id: 'here', device: 'Chrome on Android', current: true }),
    device({ id: 'a', device: 'Safari on iPhone' }),
    device({ id: 'b', device: 'Firefox on Windows' })
  ]);

  await userEvent.click(screen.getByRole('button', { name: 'Sign out all other devices' }));

  expect(await screen.findByText('Signed out 2 other devices.')).toBeInTheDocument();
  expect(screen.queryByText('Firefox on Windows')).not.toBeInTheDocument();
  expect(screen.getByText('Chrome on Android')).toBeInTheDocument();
});

it('offers no "all other devices" button when this is the only one', async () => {
  await renderTab([device({ current: true })]);

  expect(screen.queryByRole('button', { name: 'Sign out all other devices' })).not.toBeInTheDocument();
});

it('says so when the list cannot be loaded', async () => {
  mocked.list.mockRejectedValue(new Error('down'));
  render(<DevicesTab />);

  expect(await screen.findByText('Could not load your devices.')).toBeInTheDocument();
});
