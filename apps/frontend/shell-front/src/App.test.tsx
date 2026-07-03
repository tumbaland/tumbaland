import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';

describe('App', () => {
  it('renders a todo fetched from the public service', async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/api/todo/random')) {
        return { ok: true, status: 200, json: async () => ({ todo: 'Write more tests' }), text: async () => '' } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '' } as Response;
    });

    render(
      <ConfigProvider>
        <App />
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Write more tests')).toBeInTheDocument();
    });

    expect(screen.queryByText(/failed to load todo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration error/i)).not.toBeInTheDocument();
  });
});
