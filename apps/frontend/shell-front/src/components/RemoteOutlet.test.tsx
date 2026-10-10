import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('../remotes', () => ({
  remoteComponent: vi.fn(),
  forgetRemote: vi.fn()
}));

import { getAppByRoute } from '../config/apps';
import { forgetRemote, remoteComponent } from '../remotes';
import { RemoteOutlet } from './RemoteOutlet';

const renderAt = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <RemoteOutlet />
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

it('renders nothing where no module owns the address', () => {
  const { container } = renderAt('/no-such-module');

  expect(container).toBeEmptyDOMElement();
  expect(remoteComponent).not.toHaveBeenCalled();
});

it('renders the module that owns the address', () => {
  vi.mocked(remoteComponent).mockReturnValue((() => <p>The album module</p>) as never);

  renderAt('/album/albums');

  expect(screen.getByText('The album module')).toBeInTheDocument();
  expect(remoteComponent).toHaveBeenCalledWith(getAppByRoute('/album/albums'));
});

it('forgets a module that failed to load and tries it again', async () => {
  // The error boundary logs what it catches; that is the test's subject, not noise to keep.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const Broken = () => {
    throw new Error('chunk failed to load');
  };
  // Broken until it is forgotten: React re-renders once after a throw, and a
  // mock that mended itself on the second call would never reach the boundary.
  let loaded = false;
  vi.mocked(forgetRemote).mockImplementation(() => {
    loaded = true;
  });
  vi.mocked(remoteComponent).mockImplementation((() =>
    loaded ? () => <p>The album module</p> : Broken) as never);

  renderAt('/album/albums');
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

  expect(forgetRemote).toHaveBeenCalledWith(getAppByRoute('/album/albums'));
  expect(await screen.findByText('The album module')).toBeInTheDocument();
});
