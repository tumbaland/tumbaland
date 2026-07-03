import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';

describe('App', () => {
  it('shows the logged-in view once the existing session is verified', async () => {
    render(
      <ConfigProvider>
        <App />
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome back, test user!/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/configuration error/i)).not.toBeInTheDocument();
  });
});
