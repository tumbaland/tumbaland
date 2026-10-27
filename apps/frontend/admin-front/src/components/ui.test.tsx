import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import type { Loaded } from '../hooks/useLoad';
import { LoadState } from './ui';

const state = <T,>(overrides: Partial<Loaded<T>>): Loaded<T> => ({
  data: null,
  loading: false,
  error: null,
  reload: vi.fn(),
  ...overrides
});

describe('LoadState', () => {
  it('spins while there is nothing to show yet', () => {
    render(<LoadState state={state({ loading: true })}>{() => <p>content</p>}</LoadState>);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('keeps what is on screen while it updates, and says it is updating', () => {
    render(<LoadState state={state({ data: 'x', loading: true })}>{(data) => <p>content {data}</p>}</LoadState>);

    expect(screen.getByText('content x')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Updating' })).toBeInTheDocument();
  });

  it('shows no bar once it has updated', () => {
    render(<LoadState state={state({ data: 'x' })}>{(data) => <p>content {data}</p>}</LoadState>);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
