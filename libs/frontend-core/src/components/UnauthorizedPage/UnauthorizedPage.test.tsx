import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnauthorizedPage } from './UnauthorizedPage';

describe('UnauthorizedPage', () => {
  it('renders the access restricted message', () => {
    render(<UnauthorizedPage onLogin={() => {}} />);

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/need to be logged in/i)).toBeInTheDocument();
  });

  it('calls onLogin when the sign in button is clicked', async () => {
    const onLogin = vi.fn();
    const user = userEvent.setup();
    render(<UnauthorizedPage onLogin={onLogin} />);

    await user.click(screen.getByRole('button', { name: /sign in to continue/i }));

    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
