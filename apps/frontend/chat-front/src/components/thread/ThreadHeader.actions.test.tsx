import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThreadHeader } from './ThreadHeader';
import type { ConversationMember } from '../../types';

const member = (userId: string, name: string): ConversationMember => ({
  userId,
  email: `${userId}@x`,
  name,
  joinedAt: ''
});
const members = [member('u-tom', 'Tom'), member('u-irja', 'Irja')];

const header = (props: Partial<React.ComponentProps<typeof ThreadHeader>> = {}) => (
  <ThreadHeader members={members} currentUserId="u-tom" title="" presence={{}} typingNames={[]} {...props} />
);

describe('the buttons', () => {
  it('goes back to the list where there is one', async () => {
    const onBack = vi.fn();
    render(header({ onBack }));

    await userEvent.click(screen.getByRole('button', { name: 'Back to conversations' }));

    expect(onBack).toHaveBeenCalled();
  });

  it('shows the bar with only a back button before the members have loaded', () => {
    render(header({ members: [], onBack: () => {} }));

    expect(screen.getByRole('button', { name: 'Back to conversations' })).toBeInTheDocument();
  });

  it('calls the other person', async () => {
    const onCall = vi.fn();
    render(header({ onCall }));

    await userEvent.click(screen.getByRole('button', { name: 'Call Irja' }));

    expect(onCall).toHaveBeenCalled();
  });

  it('offers no call or menu unless it was given them', () => {
    render(header());

    expect(screen.queryByRole('button', { name: /Call/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conversation options' })).not.toBeInTheDocument();
  });
});

describe('the conversation menu', () => {
  it('opens on the ⋮ button and runs the choice, closing behind it', async () => {
    const onPick = vi.fn();
    render(header({ menu: [{ label: 'Theme', secondary: 'Classic', icon: <span>icon</span>, onClick: onPick }] }));
    const button = screen.getByRole('button', { name: 'Conversation options' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Classic')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('menuitem', { name: /Theme/ }));

    expect(onPick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument());
  });

  it('closes without choosing anything on Escape', async () => {
    const onPick = vi.fn();
    render(header({ menu: [{ label: 'Theme', onClick: onPick }] }));

    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument());
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('"Active … ago" while the thread stays open', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-09-22T12:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps counting as time passes', () => {
    const lastActiveAt = new Date('2026-09-22T11:55:00').toISOString();
    render(header({ presence: { 'u-irja': { userId: 'u-irja', online: false, lastActiveAt } } }));
    expect(screen.getByText(/5 min ago/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    expect(screen.getByText(/10 min ago/)).toBeInTheDocument();
  });
});
