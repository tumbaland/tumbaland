import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import AssistantSection from './AssistantSection';

/**
 * The connector is what the page leads with now, so this section stopped being
 * an illustration and became the practical half: the address, the three steps,
 * and what the assistant can actually do once it is in. The staged conversation
 * that used to live here has moved into the hero, where it is the pitch.
 */
describe('AssistantSection', () => {
  it('names Claude, and leaves everything else to the standard', () => {
    render(<AssistantSection />);
    expect(screen.getByText(/In Claude, or any assistant that takes MCP connectors/)).toBeInTheDocument();
    expect(screen.queryByText(/ChatGPT|Gemini/)).not.toBeInTheDocument();
  });

  it('says plainly which client has been tested', () => {
    render(<AssistantSection />);
    // "Should work, because it is a standard" and "we have run it" are
    // different claims, and only one of them is this page's to make.
    expect(screen.getByText(/Claude is the one we have tested end to end/)).toBeInTheDocument();
  });

  it('shows the connector address, which is the one thing nobody can guess', () => {
    render(<AssistantSection />);
    // The detail that turns "sounds nice" into "I could set that up now".
    expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
  });

  it('says which standard it speaks, so it reads as ordinary rather than proprietary', () => {
    render(<AssistantSection />);
    expect(screen.getByText(/standard MCP server/)).toBeInTheDocument();
  });

  it('copies the address to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // jsdom exposes navigator.clipboard as a getter, so it is redefined rather
    // than assigned — and after setup(), which installs a stub of its own.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<AssistantSection />);

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
    render(<AssistantSection />);

    await user.click(screen.getByRole('button', { name: /Copy/ }));

    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
  });

  it('gives the three steps in the order they are done', () => {
    render(<AssistantSection />);
    ['Add the address', 'Pick what it can reach', 'Talk to it'].forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });

  it('says what it can do as things a person would say, not as tool names', () => {
    render(<AssistantSection />);
    // `search_transactions` is accurate and tells a visitor nothing.
    expect(screen.getByText(/what did we spend at Selver this year/)).toBeInTheDocument();
    expect(screen.getByText(/when did we last go out for dinner/)).toBeInTheDocument();
    expect(screen.queryByText(/search_transactions/)).not.toBeInTheDocument();
  });

  it('leads to the full guide rather than explaining every client here', () => {
    render(<AssistantSection />);
    expect(screen.getByRole('link', { name: /Full setup guide/ })).toHaveAttribute(
      'href',
      '/connect'
    );
  });

  it('says the connection is bounded and reversible, next to the invitation', () => {
    // The reassurance has to sit with the ask; a visitor who has to go looking
    // for it has already decided.
    render(<AssistantSection />);
    expect(screen.getByText(/only ever sees what you tick/)).toBeInTheDocument();
    expect(screen.getByText(/disconnect it from your account page/)).toBeInTheDocument();
  });
});
