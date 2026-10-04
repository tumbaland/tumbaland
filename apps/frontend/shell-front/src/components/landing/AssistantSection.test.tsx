import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

import AssistantSection from './AssistantSection';

/**
 * The connector, as something you can add: the recorded exchange beside the
 * address and the three steps. It led the page once; the chat does now.
 */
describe('AssistantSection', () => {
  it('names Claude, and leaves everything else to the standard', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    expect(screen.getByText(/connector settings in Claude/)).toBeInTheDocument();
    expect(screen.queryByText(/ChatGPT|Gemini/)).not.toBeInTheDocument();
  });

  it('says plainly which client has been tested', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    // "Should work, because it is a standard" and "we have run it" are
    // different claims, and only one of them is this page's to make.
    expect(screen.getByText(/We have tested it with Claude/)).toBeInTheDocument();
  });

  it('shows the connector address, which is the one thing nobody can guess', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    // The detail that turns "sounds nice" into "I could set that up now".
    expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
  });

  it('says which standard it speaks, so it reads as ordinary rather than proprietary', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    expect(screen.getByText(/Tumbaland is an MCP connector/)).toBeInTheDocument();
  });

  it('copies the address to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // jsdom exposes navigator.clipboard as a getter, so it is redefined rather
    // than assigned — and after setup(), which installs a stub of its own.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<AssistantSection onOpenGuide={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Copy/ }));

    expect(writeText).toHaveBeenCalledWith('https://mcp.tumbaland.eu/mcp');
    // Confirmed in place rather than by a toast: the button is what was
    // pressed, so it is where a person looks to see whether anything happened.
    await waitFor(() => expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument());
  });

  it('survives a browser that refuses clipboard access', async () => {
    // Denied on an insecure origin, and in plenty of locked-down browsers. The
    // address is on screen and selectable either way, so there is nothing to
    // report and nothing to fix.
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true
    });
    render(<AssistantSection onOpenGuide={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Copy/ }));

    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
  });

  it('gives the three steps in the order they are done', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    ['Add the address', 'Sign in', 'Talk to it'].forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });

  it('shows the exchange rather than describing the protocol', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);

    // "MCP server" and "connector" mean nothing to most people this page is
    // for. What they want to know is what it feels like to use.
    expect(screen.getByText(/we went to Sushi House on Friday/)).toBeInTheDocument();
    expect(screen.getByText(/Logged for Friday 4 September/)).toBeInTheDocument();
  });

  it('plays the tools it really calls, under the reply they produced', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);

    // Each one ships on the MCP server under this name.
    ['log_day', 'get_stats', 'get_photo_memories'].forEach((tool) => {
      expect(screen.getByText(tool)).toBeInTheDocument();
    });
  });

  it('shows the whole exchange where it cannot be played', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);

    // jsdom has no IntersectionObserver, like an old browser and like anyone
    // who asked for less motion. The conversation then sits there finished.
    expect(screen.getByText(/Nine photos from Nice/)).toBeInTheDocument();
  });

  it('hides the staged conversation from screen readers', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    const exchange = screen.getByTestId('assistant-exchange');
    expect(within(exchange).getByTestId('phone-screen')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the exchange about the two of you, with no money in it', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    expect(screen.getByText(/what have we been doing most lately/)).toBeInTheDocument();
    expect(screen.queryByText(/spend/i)).not.toBeInTheDocument();
  });

  it('opens the full guide over the page, and keeps its real address for a new tab', async () => {
    const onOpenGuide = vi.fn();
    const user = userEvent.setup();
    render(<AssistantSection onOpenGuide={onOpenGuide} />);

    const link = screen.getByRole('link', { name: /Full setup guide/ });
    expect(link).toHaveAttribute('href', '/connect');

    await user.click(link);
    expect(onOpenGuide).toHaveBeenCalledTimes(1);
  });

  it('says the connection is bounded and reversible, next to the invitation', () => {
    // The reassurance has to sit with the ask; a visitor who has to go looking
    // for it has already decided.
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    expect(screen.getByText(/only sees what you allow/)).toBeInTheDocument();
    expect(screen.getByText(/disconnect it from your account page/)).toBeInTheDocument();
  });
});
