import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginButton } from './LoginButton';

describe('LoginButton', () => {
  it('renders a button and calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<LoginButton onClick={onClick} />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the login icon', () => {
    render(<LoginButton onClick={() => {}} />);

    expect(screen.getByTestId('LoginIcon')).toBeInTheDocument();
  });

  it('renders the provided text', () => {
    render(<LoginButton onClick={() => {}} text="Sign in" />);

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
