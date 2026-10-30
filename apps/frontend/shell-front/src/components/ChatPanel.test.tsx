import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('../remotes', () => ({
  remoteComponent: vi.fn(),
  forgetRemote: vi.fn()
}));

import { CHAT_APP } from '../config/apps';
import { forgetRemote, remoteComponent } from '../remotes';
import { CHAT_PANEL_MODULE, ChatPanel, PANEL_WIDTH, clampWidth } from './ChatPanel';

const renderPanel = (props: { onClose?: () => void; fill?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <ChatPanel onClose={props.onClose ?? vi.fn()} fill={props.fill} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.innerWidth = 1600;
  vi.mocked(remoteComponent).mockReturnValue((() => <p>Conversations</p>) as never);
});

it('shows chat\'s panel module under its own title', () => {
  renderPanel();

  expect(screen.getByRole('complementary', { name: 'Chat' })).toBeInTheDocument();
  expect(screen.getByText('Conversations')).toBeInTheDocument();
  expect(remoteComponent).toHaveBeenCalledWith(expect.anything(), CHAT_PANEL_MODULE);
});

it('links to the full page and closes', async () => {
  const onClose = vi.fn();
  renderPanel({ onClose });

  expect(screen.getByRole('link', { name: 'Open chat full page' })).toHaveAttribute('href', CHAT_APP.route);
  await userEvent.click(screen.getByRole('button', { name: 'Close chat' }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

it('leaves out the way to the full page when docked in a module', () => {
  renderPanel({ fill: true });

  expect(screen.queryByRole('link', { name: 'Open chat full page' })).not.toBeInTheDocument();
});

it('forgets the panel module when it fails to load and tries it again', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const Broken = () => {
    throw new Error('chunk failed to load');
  };
  // Broken until it is forgotten; see RemoteOutlet.test.tsx for why a mock that
  // mends itself on the second call would never show the boundary.
  let loaded = false;
  vi.mocked(forgetRemote).mockImplementation(() => {
    loaded = true;
  });
  vi.mocked(remoteComponent).mockImplementation((() =>
    loaded ? () => <p>Conversations</p> : Broken) as never);

  renderPanel();
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

  expect(forgetRemote).toHaveBeenCalledWith(expect.anything(), CHAT_PANEL_MODULE);
  expect(await screen.findByText('Conversations')).toBeInTheDocument();
});

describe('its width', () => {
  const panel = () => screen.getByRole('complementary', { name: 'Chat' });
  const edge = () => screen.getByRole('separator', { name: 'Resize chat' });

  it('starts wide enough to read a conversation', () => {
    renderPanel();
    expect(panel()).toHaveStyle({ width: `${PANEL_WIDTH.initial}px` });
  });

  it('is dragged wider from its left edge, and remembered', () => {
    renderPanel();
    fireEvent.pointerDown(edge(), { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(edge(), { clientX: 900, pointerId: 1 });
    expect(panel()).toHaveStyle({ width: `${PANEL_WIDTH.initial + 100}px` });
    fireEvent.pointerUp(edge(), { clientX: 880, pointerId: 1 });
    expect(panel()).toHaveStyle({ width: `${PANEL_WIDTH.initial + 120}px` });
    expect(localStorage.getItem('tumbaland.chatPanel.width')).toBe(String(PANEL_WIDTH.initial + 120));
  });

  it('opens at the width it was left at', () => {
    localStorage.setItem('tumbaland.chatPanel.width', '600');
    renderPanel();
    expect(panel()).toHaveStyle({ width: '600px' });
  });

  it('moves with the arrow keys, and goes back to the start on a double-click', async () => {
    renderPanel();
    edge().focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(panel()).toHaveStyle({ width: `${PANEL_WIDTH.initial + 2 * PANEL_WIDTH.step}px` });
    await userEvent.keyboard('{ArrowRight}');
    expect(panel()).toHaveStyle({ width: `${PANEL_WIDTH.initial + PANEL_WIDTH.step}px` });
    await userEvent.dblClick(edge());
    expect(panel()).toHaveStyle({ width: `${PANEL_WIDTH.initial}px` });
  });

  it('fits a smaller window', () => {
    localStorage.setItem('tumbaland.chatPanel.width', '900');
    renderPanel();
    window.innerWidth = 1000;
    fireEvent(window, new Event('resize'));
    expect(panel()).toHaveStyle({ width: '600px' });
  });

  it('has no edge to drag when docked in a module', () => {
    renderPanel({ fill: true });
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps between its smallest and a share of the window', () => {
    expect(clampWidth(100, 1600)).toBe(PANEL_WIDTH.min);
    expect(clampWidth(5000, 1600)).toBe(960);
    expect(clampWidth(500, 400)).toBe(PANEL_WIDTH.min);
  });
});
