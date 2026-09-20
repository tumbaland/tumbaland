import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import HeroSection from './HeroSection';

const renderHero = () => {
  const onSignIn = vi.fn();
  const onSeeHow = vi.fn();
  render(<HeroSection onSignIn={onSignIn} onSeeHow={onSeeHow} />);
  return { onSignIn, onSeeHow };
};

describe('HeroSection', () => {
  it('leads with the assistant rather than with a list of modules', () => {
    renderHero();

    // The old headline named photos, finance and a journal, which puts
    // Tumbaland beside four products it cannot out-feature. The connector is
    // the part none of them have.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Just tell your assistant/
    );
  });

  it('names only the client that has actually been tested', () => {
    renderHero();

    // The page used to promise ChatGPT and Gemini as well, on the reasoning
    // that both support MCP connectors — true of the protocol, and never true
    // of anything anyone had run. The standard covers the rest without naming
    // a product nobody has verified.
    expect(screen.getByText(/Works with Claude . and any MCP client/)).toBeInTheDocument();
    expect(screen.queryByText(/ChatGPT|Gemini/)).not.toBeInTheDocument();
  });

  it('shows the exchange rather than describing the protocol', () => {
    renderHero();

    // "MCP server" and "connector" mean nothing to the person this page is for.
    // What they want to know is what it feels like to use.
    expect(screen.getByText(/we went to Sushi House on Friday/)).toBeInTheDocument();
    expect(screen.getByText(/Logged for Friday 4 September/)).toBeInTheDocument();
  });

  it('plays the tools it really calls, under the reply they produced', () => {
    renderHero();

    // The claim is that something happens when you send it, and the tool names
    // are the evidence. Each one ships on the MCP server under this name.
    ['log_day', 'get_spending', 'get_photo_memories'].forEach((tool) => {
      expect(screen.getByText(tool)).toBeInTheDocument();
    });
  });

  it('shows the whole exchange where it cannot be played', () => {
    renderHero();

    // jsdom has no IntersectionObserver, which is also the case in a browser
    // old enough to lack one and for anyone who asked for less motion. The
    // conversation then sits there finished rather than never starting.
    expect(screen.getByText(/Nine photos from Nice/)).toBeInTheDocument();
  });

  it('hides the staged conversation from screen readers', () => {
    renderHero();

    // It is an illustration. Read aloud, a fabricated exchange sounds like real
    // content, and the heading beside it already carries the meaning. The
    // screen is what is hidden, not the whole block: a control that can be
    // focused must never sit inside an aria-hidden subtree.
    const exchange = screen.getByTestId('hero-exchange');
    expect(within(exchange).getByTestId('phone-screen')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows both halves of the product in the exchange, not only the journal', () => {
    renderHero();

    // One turn writes and one turn reads, and they are deliberately different
    // modules: the claim is that it reaches everything, not that it takes notes.
    expect(screen.getByText(/how much did we spend on restaurants/)).toBeInTheDocument();
  });

  it('says the connection is bounded before asking anyone to make one', () => {
    renderHero();
    expect(screen.getByText(/You pick what it can reach/)).toBeInTheDocument();
    expect(screen.getByText(/Disconnect whenever/)).toBeInTheDocument();
  });

  it('offers signing in and reading how it works, and nothing else', async () => {
    const user = userEvent.setup();
    const { onSignIn, onSeeHow } = renderHero();

    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(onSignIn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /See how it connects/ }));
    expect(onSeeHow).toHaveBeenCalledTimes(1);

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
