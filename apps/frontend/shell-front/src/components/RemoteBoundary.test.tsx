import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import { RemoteBoundary } from './RemoteBoundary';

const Boom = () => {
  throw new Error('remote failed to load');
};

beforeEach(() => {
  // React logs the caught error itself; the test is about what the page shows.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

it('renders its children while nothing has failed', () => {
  render(
    <RemoteBoundary appTitle="Album" onRetry={vi.fn()}>
      <div>album pages</div>
    </RemoteBoundary>
  );

  expect(screen.getByText('album pages')).toBeInTheDocument();
});

it('names the module that failed rather than blanking the page', () => {
  render(
    <RemoteBoundary appTitle="Album" onRetry={vi.fn()}>
      <Boom />
    </RemoteBoundary>
  );

  // Without this the failure takes the shell's navigation down too, leaving
  // no way out of the broken page.
  expect(screen.getByText('Album would not load')).toBeInTheDocument();
  expect(screen.getByText(/rest of Tumbaland still works/i)).toBeInTheDocument();
});

it('offers a retry, and asks for the module to be loaded afresh', async () => {
  const onRetry = vi.fn();
  render(
    <RemoteBoundary appTitle="Album" onRetry={onRetry}>
      <Boom />
    </RemoteBoundary>
  );

  await userEvent.click(screen.getByRole('button', { name: /try again/i }));

  expect(onRetry).toHaveBeenCalledTimes(1);
});
