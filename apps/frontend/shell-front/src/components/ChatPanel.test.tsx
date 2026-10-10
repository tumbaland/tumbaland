import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('../remotes', () => ({
  remoteComponent: vi.fn(),
  forgetRemote: vi.fn()
}));

import { CHAT_APP } from '../config/apps';
import { forgetRemote, remoteComponent } from '../remotes';
import { CHAT_PANEL_MODULE, ChatPanel } from './ChatPanel';

const renderPanel = (props: { onClose?: () => void; fill?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <ChatPanel onClose={props.onClose ?? vi.fn()} fill={props.fill} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
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
