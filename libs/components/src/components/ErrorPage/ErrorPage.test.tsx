import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorPage } from './ErrorPage';

describe('ErrorPage', () => {
  it('renders the default title, message and retry button', () => {
    render(<ErrorPage />);

    expect(screen.getByText('Configuration Error')).toBeInTheDocument();
    expect(screen.getByText(/failed to load application configuration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders a custom title and string message', () => {
    render(<ErrorPage title="Custom Error" message="Something specific broke" />);

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Something specific broke')).toBeInTheDocument();
  });

  it('renders ReactNode message content', () => {
    render(<ErrorPage message={<span data-testid="custom-message">Custom node content</span>} />);

    expect(screen.getByTestId('custom-message')).toBeInTheDocument();
  });

  it('hides the retry button when showRetry is false', () => {
    render(<ErrorPage showRetry={false} />);

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('calls the provided onRetry handler when the retry button is clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorPage onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a custom icon in place of the default error icon', () => {
    render(<ErrorPage icon={<span data-testid="custom-icon" />} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
