import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('./ChatPanel', () => ({
  ChatPanel: ({ onClose, fill }: { onClose: () => void; fill?: boolean }) => (
    <aside aria-label={fill ? 'Docked chat' : 'Chat'}>
      <button onClick={onClose}>Close chat</button>
    </aside>
  )
}));

import { CHAT_DOCK_EVENT, ChatDockHost } from './ChatDockHost';

const ask = (detail: { container: HTMLElement | null; onClose?: () => void }) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(CHAT_DOCK_EVENT, { detail }));
  });

it('says it is listening, so a module knows to offer chat', () => {
  const { unmount } = render(<ChatDockHost onDockedChange={vi.fn()} />);
  expect((window as unknown as Record<string, unknown>).__tumbalandChatDock).toBe(true);

  unmount();
  expect((window as unknown as Record<string, unknown>).__tumbalandChatDock).toBeUndefined();
});

it('draws chat into the element a module hands over, and takes it away again', async () => {
  const onDockedChange = vi.fn();
  const onClose = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(<ChatDockHost onDockedChange={onDockedChange} />);

  ask({ container, onClose });
  expect(container).toContainElement(screen.getByRole('complementary', { name: 'Docked chat' }));
  expect(onDockedChange).toHaveBeenLastCalledWith(true);

  await userEvent.click(screen.getByRole('button', { name: 'Close chat' }));
  expect(onClose).toHaveBeenCalled();

  ask({ container: null });
  expect(screen.queryByRole('complementary', { name: 'Docked chat' })).not.toBeInTheDocument();
  expect(onDockedChange).toHaveBeenLastCalledWith(false);
  container.remove();
});
