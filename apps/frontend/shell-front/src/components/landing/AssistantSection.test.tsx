import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import AssistantSection from './AssistantSection';

/**
 * The connector is what the page leads with now, so this section stopped being
 * an illustration and became the practical half: the address and the three
 * steps, and nothing beyond them. The conversation is the hero's job, and the
 * example questions that used to sit here in cards are played there instead.
 */
describe('AssistantSection', () => {
  it('names Claude, and leaves everything else to the standard', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    expect(screen.getByText(/In Claude, or any assistant that takes MCP connectors/)).toBeInTheDocument();
    expect(screen.queryByText(/ChatGPT|Gemini/)).not.toBeInTheDocument();
  });

  it('says plainly which client has been tested', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    // "Should work, because it is a standard" and "we have run it" are
    // different claims, and only one of them is this page's to make.
    expect(screen.getByText(/Claude is the one we have tested end to end/)).toBeInTheDocument();
  });

  it('shows the connector address, which is the one thing nobody can guess', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    // The detail that turns "sounds nice" into "I could set that up now".
    expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
  });

  it('says which standard it speaks, so it reads as ordinary rather than proprietary', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    expect(screen.getByText(/standard MCP server/)).toBeInTheDocument();
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
    ['Add the address', 'Pick what it can reach', 'Talk to it'].forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });

  it('does not repeat the example questions the hero already plays', () => {
    render(<AssistantSection onOpenGuide={vi.fn()} />);
    // This section carried three cards of them. The hero now runs those same
    // questions against the real tools, so the cards were the claim twice.
    expect(screen.queryByText(/what did we spend at Selver/)).not.toBeInTheDocument();
    expect(screen.queryByText(/when did we last go out for dinner/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/only ever sees what you tick/)).toBeInTheDocument();
    expect(screen.getByText(/disconnect it from your account page/)).toBeInTheDocument();
  });
});
