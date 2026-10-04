import { describe, expect, it, vi } from 'vite-plus/test';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CallScreen, formatElapsed, statusText } from './CallScreen';
import { IDLE, type CallState } from '../../services/callEngine';

const IRJA = { userId: 'u-irja', name: 'Irja', picture: null };

const handlers = () => ({
  onAccept: vi.fn(),
  onDecline: vi.fn(),
  onHangUp: vi.fn(),
  onToggleMute: vi.fn(),
  onDismiss: vi.fn()
});

const state = (patch: Partial<CallState>): CallState => ({ ...IDLE, peer: IRJA, ...patch });

describe('CallScreen', () => {
  it('draws nothing without a call', () => {
    const { container } = render(<CallScreen state={IDLE} {...handlers()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers Answer and Decline for an incoming call', async () => {
    const on = handlers();
    render(<CallScreen state={state({ phase: 'incoming' })} {...on} />);

    expect(screen.getByText('Calling you')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    expect(on.onAccept).toHaveBeenCalled();
    expect(on.onDecline).toHaveBeenCalled();
  });

  it('offers Mute and End once talking', async () => {
    const on = handlers();
    render(<CallScreen state={state({ phase: 'active', connectedAt: Date.now() })} {...on} />);

    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));
    await userEvent.click(screen.getByRole('button', { name: 'End' }));

    expect(on.onToggleMute).toHaveBeenCalled();
    expect(on.onHangUp).toHaveBeenCalled();
  });

  it('can only be ended while still calling out', () => {
    render(<CallScreen state={state({ phase: 'outgoing' })} {...handlers()} />);
    expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End' })).toBeInTheDocument();
  });
});

describe('statusText', () => {
  it('says what is happening at each stage', () => {
    expect(statusText(state({ phase: 'outgoing' }), null)).toBe('Calling…');
    expect(statusText(state({ phase: 'connecting' }), null)).toBe('Connecting…');
    expect(statusText(state({ phase: 'active' }), '1:05')).toBe('1:05');
    expect(statusText(state({ phase: 'active', reconnecting: true }), '1:05')).toBe('Reconnecting…');
    expect(statusText(state({ phase: 'ended', message: 'No answer' }), null)).toBe('No answer');
  });
});

describe('formatElapsed', () => {
  it('counts minutes and seconds, and hours past the hour', () => {
    expect(formatElapsed(5_000)).toBe('0:05');
    expect(formatElapsed(187_000)).toBe('3:07');
    expect(formatElapsed(3_727_000)).toBe('1:02:07');
  });
});

describe('minimized', () => {
  it('shrinks a call to a bar that can still mute, end and come back', async () => {
    const on = { ...handlers(), onExpand: vi.fn() };
    render(<CallScreen state={state({ phase: 'active', connectedAt: Date.now() })} {...on} minimized />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open call' }));
    await userEvent.click(screen.getByRole('button', { name: 'End' }));

    expect(on.onToggleMute).toHaveBeenCalled();
    expect(on.onExpand).toHaveBeenCalled();
    expect(on.onHangUp).toHaveBeenCalled();
  });

  it('never hides a ringing call in the bar', () => {
    render(<CallScreen state={state({ phase: 'incoming' })} {...handlers()} minimized />);
    expect(screen.getByRole('button', { name: 'Answer' })).toBeInTheDocument();
  });

  it('offers to minimize once talking', async () => {
    const onMinimize = vi.fn();
    render(<CallScreen state={state({ phase: 'connecting' })} {...handlers()} onMinimize={onMinimize} />);
    await userEvent.click(screen.getByRole('button', { name: 'Minimize call' }));
    expect(onMinimize).toHaveBeenCalled();
  });
});

describe('dragging the bar', () => {
  const bar = () => screen.getByRole('region', { name: 'Call with Irja' });

  it('moves where it is dragged, stays there next time, and does not open the call on letting go', () => {
    window.localStorage.clear();
    const on = { ...handlers(), onExpand: vi.fn() };
    const { unmount } = render(
      <CallScreen state={state({ phase: 'active', connectedAt: Date.now() })} {...on} minimized />
    );
    bar().getBoundingClientRect = () => ({ left: 100, top: 500, width: 300, height: 50 }) as DOMRect;

    const openButton = screen.getByRole('button', { name: 'Open call' });
    fireEvent.pointerDown(openButton, { pointerId: 1, button: 0, clientX: 150, clientY: 520 });
    fireEvent.pointerMove(openButton, { pointerId: 1, clientX: 130, clientY: 320 });
    fireEvent.pointerUp(openButton, { pointerId: 1, clientX: 130, clientY: 320 });
    fireEvent.click(openButton);

    expect(bar()).toHaveStyle({ left: '80px', top: '300px' });
    expect(on.onExpand).not.toHaveBeenCalled();

    unmount();
    render(<CallScreen state={state({ phase: 'active', connectedAt: Date.now() })} {...handlers()} minimized />);
    expect(bar()).toHaveStyle({ left: '80px', top: '300px' });
  });

  it('treats a press that barely moves as a tap', () => {
    window.localStorage.clear();
    const on = { ...handlers(), onExpand: vi.fn() };
    render(<CallScreen state={state({ phase: 'active', connectedAt: Date.now() })} {...on} minimized />);

    const openButton = screen.getByRole('button', { name: 'Open call' });
    fireEvent.pointerDown(openButton, { pointerId: 1, button: 0, clientX: 150, clientY: 520 });
    fireEvent.pointerMove(openButton, { pointerId: 1, clientX: 152, clientY: 521 });
    fireEvent.pointerUp(openButton, { pointerId: 1, clientX: 152, clientY: 521 });
    fireEvent.click(openButton);

    expect(on.onExpand).toHaveBeenCalled();
  });
});
