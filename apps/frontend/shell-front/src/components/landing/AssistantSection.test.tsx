import { render, screen } from '@testing-library/react';

import AssistantSection from './AssistantSection';

/**
 * Before this section existed, the assistant feature had no presence on the
 * landing page at all — it was reachable only from a footer link, so the thing
 * that most distinguishes Tumbaland from a notes app was invisible to everyone
 * deciding whether to sign up.
 */
describe('AssistantSection', () => {
  beforeEach(() => render(<AssistantSection />));

  it('names the assistants people actually have', () => {
    expect(screen.getByText(/Claude, ChatGPT or Gemini/)).toBeInTheDocument();
  });

  it('leads to the guide rather than explaining the protocol here', () => {
    // "MCP server" and "connector" mean nothing to the person this page is for.
    expect(screen.getByRole('link', { name: /How connecting works/ })).toHaveAttribute(
      'href',
      '/connect'
    );
  });

  it('says the connection is bounded and reversible, next to the invitation', () => {
    // The reassurance has to sit with the ask; a visitor who has to go looking
    // for it has already decided.
    expect(screen.getByText(/You pick what it can reach/)).toBeInTheDocument();
    expect(screen.getByText(/Disconnect it whenever you like/)).toBeInTheDocument();
  });

  it('hides the staged conversation from screen readers', () => {
    // It is an illustration. Read aloud, a fabricated exchange sounds like real
    // content, and the heading above already carries the meaning.
    // The name appears in both the question and the answer, which is the point
    // of the illustration — so match the line, not the restaurant.
    const staged = screen
      .getByText(/when did we last see a film together/)
      .closest('[aria-hidden="true"]');

    expect(staged).not.toBeNull();
  });
});
