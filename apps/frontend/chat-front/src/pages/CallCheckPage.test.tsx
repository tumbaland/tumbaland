import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const iceServers = vi.fn();
const checkRoutes = vi.fn();

vi.mock('../services/chatApi', () => ({ chatApi: { iceServers: () => iceServers() } }));
vi.mock('../services/connectionCheck', () => ({
  canCheck: () => true,
  checkRoutes: (...args: unknown[]) => checkRoutes(...args)
}));

import CallCheckPage, { verdict } from './CallCheckPage';

const relayConfig = {
  iceServers: [{ urls: 'turn:turn.example:3478', username: 'u', credential: 'c' }],
  relay: true,
  expiresAt: '2026-09-23T18:00:00Z'
};

afterEach(() => vi.clearAllMocks());

describe('CallCheckPage', () => {
  it('checks with the servers chat-service hands out and says calls will connect', async () => {
    iceServers.mockResolvedValue(relayConfig);
    checkRoutes.mockResolvedValue({ local: true, internet: true, relay: true });

    render(<CallCheckPage />);

    expect(await screen.findByText('Calls will connect from here.')).toBeInTheDocument();
    expect(checkRoutes).toHaveBeenCalledWith(relayConfig.iceServers);
    expect(screen.getByText('Through the relay: works')).toBeInTheDocument();
  });

  it('says so when the check cannot run', async () => {
    iceServers.mockRejectedValue(new Error('offline'));

    render(<CallCheckPage />);

    expect(await screen.findByText('Could not run the check. Are you online?')).toBeInTheDocument();
  });

  it('runs again on request', async () => {
    iceServers.mockResolvedValue(relayConfig);
    checkRoutes.mockResolvedValue({ local: true, internet: false, relay: false });
    render(<CallCheckPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));

    expect(await screen.findByText('Through the relay: no')).toBeInTheDocument();
    expect(checkRoutes).toHaveBeenCalledTimes(2);
  });
});

describe('verdict', () => {
  const routes = { local: true, internet: true, relay: false };

  it('blames the missing setup, not the network, when no relay is configured', () => {
    expect(verdict({ ...routes, relayConfigured: false }).text).toMatch(/not set up yet/);
  });

  it('warns about mobile data when the relay is configured but unreachable', () => {
    expect(verdict({ ...routes, relayConfigured: true })).toMatchObject({ severity: 'warning' });
  });

  it('says calls will not connect when only the local network works', () => {
    expect(verdict({ local: true, internet: false, relay: false, relayConfigured: true }).severity).toBe('error');
  });
});
