import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';
import { queryClient } from './lib/queryClient';
import { authService } from './services/authService';

describe('App', () => {
  it('renders the dashboard once the user is authenticated', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/checking authentication/i)).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/access restricted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration error/i)).not.toBeInTheDocument();
  });

  it('shows the unauthorized page when the user is not authenticated', async () => {
    authService.clearAuthCache();
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/auth/verify')) {
        return { ok: true, status: 200, json: async () => ({ success: true, authenticated: false, user: null }), text: async () => '' } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '' } as Response;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
  });
});
