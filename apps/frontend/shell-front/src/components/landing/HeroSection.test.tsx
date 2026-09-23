import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import HeroSection from './HeroSection';

const renderHero = () => {
  const onSignIn = vi.fn();
  const onSeeInside = vi.fn();
  render(<HeroSection onSignIn={onSignIn} onSeeInside={onSeeInside} />);
  return { onSignIn, onSeeInside };
};

describe('HeroSection', () => {
  it('leads with what the app is for: a place for two people, not a connector', () => {
    renderHero();

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/private app for the two of you/i);
    // The assistant is further down the page, as something you can add.
    expect(screen.queryByText(/MCP|assistant/i)).not.toBeInTheDocument();
  });

  it('shows the chat rather than describing it', () => {
    renderHero();

    // A photo that files itself into the trip's album, and a call between the
    // two of them, are the parts no other messenger does in one place.
    const chat = screen.getByTestId('hero-chat');
    expect(within(chat).getByText('look where we ended up')).toBeInTheDocument();
    expect(within(chat).getByText('In Rome')).toBeInTheDocument();
    expect(within(chat).getByText(/Call, 14 min/)).toBeInTheDocument();
  });

  it('renders the chat finished where nothing can animate it', () => {
    // jsdom has no IntersectionObserver, like an old browser. The thread must
    // arrive at its end state, not stay blank.
    renderHero();
    expect(screen.getByText('Irja is typing')).toBeInTheDocument();
  });

  it('keeps the made-up conversation away from screen readers', () => {
    renderHero();
    expect(within(screen.getByTestId('hero-chat')).getByTestId('phone-screen')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows no settings, only what the app is', () => {
    renderHero();
    expect(screen.queryByText(/dark|light mode|theme|notification/i)).not.toBeInTheDocument();
  });

  it('says it is free and private before asking anyone to sign in', () => {
    renderHero();
    expect(screen.getByText('Free. Only the people you invite can see it.')).toBeInTheDocument();
  });

  it('offers signing in and seeing inside, and nothing else', async () => {
    const user = userEvent.setup();
    const { onSignIn, onSeeInside } = renderHero();

    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(onSignIn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /See how it looks/ }));
    expect(onSeeInside).toHaveBeenCalledTimes(1);

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
