import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

// group-front's App component wraps itself in ConfigProvider, so no
// external wrapping is needed here (unlike the other fronts).
describe('App', () => {
  it('renders the groups page once the user is authenticated', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText(/checking authentication/i)).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/access restricted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration error/i)).not.toBeInTheDocument();
  });

  it('shows the unauthorized page when the user is not authenticated', async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/auth/verify')) {
        return { ok: true, status: 200, json: async () => ({ success: true, authenticated: false, user: null }), text: async () => '' } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '' } as Response;
    });

    render(<App />);

    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
  });
});
