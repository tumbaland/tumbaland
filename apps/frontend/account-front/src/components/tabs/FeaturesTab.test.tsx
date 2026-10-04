import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const get = vi.fn();
const updateProfile = vi.fn();

vi.mock('../../services/accountApi', () => ({ accountApi: { get: (path: string) => get(path) } }));
vi.mock('../../services/profileService', () => ({
  profileService: { updateProfile: (body: unknown) => updateProfile(body) }
}));

import FeaturesTab from './FeaturesTab';
import { FEATURES_CHANGED_EVENT } from '../../services/features';

beforeEach(() => {
  get.mockReset();
  updateProfile.mockReset();
});

describe('FeaturesTab', () => {
  it('shows Money off for someone who never turned it on', async () => {
    get.mockResolvedValue({ success: true, user: {} });
    render(<FeaturesTab />);

    expect(await screen.findByRole('switch', { name: 'Money' })).not.toBeChecked();
  });

  it('turns Money on and tells the shell, so the menu changes without a reload', async () => {
    get.mockResolvedValue({ success: true, user: { showMoney: false } });
    updateProfile.mockResolvedValue({ success: true, user: { showMoney: true } });
    const heard = vi.fn();
    window.addEventListener(FEATURES_CHANGED_EVENT, heard);
    render(<FeaturesTab />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Money' }));

    expect(updateProfile).toHaveBeenCalledWith({ showMoney: true });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Money' })).toBeChecked());
    expect((heard.mock.calls[0]![0] as CustomEvent).detail).toEqual({ showMoney: true });
    window.removeEventListener(FEATURES_CHANGED_EVENT, heard);
  });

  it('keeps the old setting and says so when saving fails', async () => {
    get.mockResolvedValue({ success: true, user: { showMoney: true } });
    updateProfile.mockRejectedValue(new Error('down'));
    render(<FeaturesTab />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Money' }));

    expect(await screen.findByText('Could not change that. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Money' })).toBeChecked();
  });
});
