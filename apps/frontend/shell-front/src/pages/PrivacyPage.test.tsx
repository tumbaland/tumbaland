import { render, screen } from '@testing-library/react';
import PrivacyPage from './PrivacyPage';
import ConnectPage from './ConnectPage';
import TermsPage from './TermsPage';

describe('PrivacyPage', () => {
  it('names every third party that receives anything', () => {
    render(<PrivacyPage />);

    // A policy that omits one of these is inaccurate, and these are exactly the
    // services the code talks to.
    for (const party of ['Google', 'OpenStreetMap', 'Alpha Vantage']) {
      expect(screen.getAllByText(new RegExp(party)).length).toBeGreaterThan(0);
    }
  });

  it('mentions no payment provider and claims no public source code', () => {
    // Tumbaland is free and its code is not published, so neither belongs in
    // the policy.
    render(<PrivacyPage />);
    expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/open source/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open source|github/i })).not.toBeInTheDocument();
  });

  it('says plainly that photos carry a location and that Tumbaland reads it', () => {
    // The single most surprising thing the product does with uploaded files.
    render(<PrivacyPage />);
    expect(screen.getByText(/Photos usually contain a location/)).toBeInTheDocument();
  });

  it('warns that a connected assistant receives journal content', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText(/the content involved goes to whoever runs that assistant/i)
    ).toBeInTheDocument();
  });

  it('tells people how to get their data out and delete it', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Export\./)).toBeInTheDocument();
    expect(screen.getByText(/Deletion\./)).toBeInTheDocument();
  });

  it('carries a last-updated date', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
  });

  it('says it counts which days and which parts, and that it never records what was looked at', () => {
    // The administrator's usage screens read exactly this, so the policy has to
    // name it. It is also kept apart from the claim that no analytics service
    // is involved: it is counted on our own server.
    render(<PrivacyPage />);
    expect(screen.getByText(/Which days you opened Tumbaland/)).toBeInTheDocument();
    expect(screen.getByText(/never what you looked at/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent to an external analytics/)).toBeInTheDocument();
  });
});

describe('ConnectPage', () => {
  it('gives the server address, which is the one thing nobody can guess', () => {
    render(<ConnectPage />);
    expect(screen.getAllByText(/mcp\.tumbaland\.eu\/mcp/).length).toBeGreaterThan(0);
  });

  it('calls out the per-conversation toggle people miss', () => {
    render(<ConnectPage />);
    expect(screen.getAllByText(/no matching tools/i).length).toBeGreaterThan(0);
  });

  it('documents every tool the server exposes', () => {
    render(<ConnectPage />);

    for (const tool of ['list_activity_types', 'log_day', 'log_activity', 'search_activities', 'get_stats']) {
      expect(screen.getByText(tool)).toBeInTheDocument();
    }
  });

  it('is explicit about what a connection cannot reach', () => {
    render(<ConnectPage />);
    expect(screen.getByText(/Touch anything you did not grant/)).toBeInTheDocument();
  });

  it('says the journal and money permissions are separate', () => {
    // The page lists fifteen tools; without this someone granting one domain
    // would reasonably assume they had granted both.
    render(<ConnectPage />);
    expect(
      screen.getByText(/An assistant granted one is never shown the other/)
    ).toBeInTheDocument();
  });

  it('warns that nothing can read the picture itself', () => {
    // A tool that implied otherwise would search album after album and report
    // nothing found, which reads as a broken search rather than a missing one.
    render(<ConnectPage />);
    expect(screen.getByText(/It cannot tell what is in a picture/)).toBeInTheDocument();
  });

  it('warns that a one-off expense cannot be recorded at all', () => {
    // Not an MCP limitation: nothing in the product creates a transaction, and
    // an assistant that quietly logs a trade instead would be worse than one
    // that refuses.
    render(<ConnectPage />);
    expect(screen.getByText(/It cannot record a one-off expense/)).toBeInTheDocument();
  });
});

describe('TermsPage', () => {
  it('is reachable without an account, like the other two documents', () => {
    // The version this replaced lived inside the billing app behind a link that
    // dead-ended, and the people who read terms are deciding whether to sign up.
    render(<TermsPage />);
    expect(screen.getByRole('heading', { name: 'Terms', level: 1 })).toBeInTheDocument();
  });

  it('carries a fixed date, not one generated at render time', () => {
    // The old page stamped itself with today's date on every render, so it
    // claimed to have been revised daily and could never be checked.
    render(<TermsPage />);

    const today = new Date().toLocaleDateString();
    expect(screen.queryByText(new RegExp(today.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeNull();
    expect(screen.getByText(/Last updated 14 September 2026/)).toBeInTheDocument();
  });

  it('says it is free, with nothing to subscribe to and nothing to refund', () => {
    render(<TermsPage />);

    expect(screen.getByText(/no paid tier holding back the real/)).toBeInTheDocument();
    expect(screen.getByText(/nothing to subscribe to/)).toBeInTheDocument();
    expect(screen.queryByText(/Stripe|subscription|refund/i)).not.toBeInTheDocument();
  });

  it('points at the other two documents rather than mentioning them', () => {
    render(<TermsPage />);

    expect(screen.getByRole('link', { name: /privacy page/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /Connecting an assistant/i })).toHaveAttribute(
      'href',
      '/connect'
    );
  });
});
