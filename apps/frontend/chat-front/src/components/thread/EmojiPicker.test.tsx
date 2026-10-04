import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiPicker, QUICK_REACTIONS } from './EmojiPicker';

const anchor = () => document.createElement('button');

describe('EmojiPicker', () => {
  it('renders nothing while closed', () => {
    render(<EmojiPicker anchorEl={null} onClose={() => {}} onPick={() => {}} />);

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('offers the quick reactions', () => {
    render(<EmojiPicker anchorEl={anchor()} onClose={() => {}} onPick={() => {}} />);

    for (const emoji of QUICK_REACTIONS) {
      expect(screen.getByRole('button', { name: emoji })).toBeInTheDocument();
    }
  });

  it('reports a pick and closes', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<EmojiPicker anchorEl={anchor()} onClose={onClose} onPick={onPick} />);

    await userEvent.click(screen.getByRole('button', { name: '❤️' }));

    expect(onPick).toHaveBeenCalledWith('❤️');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows no escalation when there is nowhere to escalate to', () => {
    render(<EmojiPicker anchorEl={anchor()} onClose={() => {}} onPick={() => {}} />);

    expect(screen.queryByRole('button', { name: 'More emoji' })).not.toBeInTheDocument();
  });

  it('hands over to the full picker, anchored where the button was', async () => {
    const onMore = vi.fn();
    const onClose = vi.fn();
    render(<EmojiPicker anchorEl={anchor()} onClose={onClose} onPick={() => {}} onMore={onMore} />);

    await userEvent.click(screen.getByRole('button', { name: 'More emoji' }));

    // Closed first, so the two popovers are never open at once.
    expect(onClose).toHaveBeenCalled();
    expect(onMore).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('lists message actions under the reactions, and closes before running one', async () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    render(
      <EmojiPicker
        anchorEl={anchor()}
        onClose={onClose}
        onPick={() => {}}
        actions={[
          { label: 'Edit', icon: null, onClick: onEdit },
          { label: 'Unsend', icon: null, onClick: () => {}, danger: true }
        ]}
      />
    );

    expect(screen.getByRole('menuitem', { name: 'Unsend' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(onClose).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalled();
  });

  it('shows no action list when there are none', () => {
    render(<EmojiPicker anchorEl={anchor()} onClose={() => {}} onPick={() => {}} />);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
