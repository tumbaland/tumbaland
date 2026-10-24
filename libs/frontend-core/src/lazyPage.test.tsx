import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { lazyPage } from './lazyPage';

class Catch extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <div>failed: {this.state.error.message}</div> : this.props.children;
  }
}

const renderPage = (Page: ReturnType<typeof lazyPage>) =>
  render(
    <Catch>
      <Suspense fallback={<div>loading</div>}>
        <Page />
      </Suspense>
    </Catch>
  );

describe('lazyPage', () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockReset();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  it('renders the page once its code arrives', async () => {
    const Page = lazyPage(async () => ({ default: () => <div>the page</div> }));

    renderPage(Page);

    expect(await screen.findByText('the page')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once when the page code is gone, as after a deploy', async () => {
    const Page = lazyPage(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));

    renderPage(Page);

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('shows the error instead of reloading again right after a reload', async () => {
    window.sessionStorage.setItem('tumbaland.pageReloadedAt', String(Date.now() - 5_000));
    const Page = lazyPage(() => Promise.reject(new Error('gone')));

    renderPage(Page);

    expect(await screen.findByText('failed: gone')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads again once the last reload is long past', async () => {
    window.sessionStorage.setItem('tumbaland.pageReloadedAt', String(Date.now() - 10 * 60_000));
    const Page = lazyPage(() => Promise.reject(new Error('gone')));

    renderPage(Page);

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });
});
