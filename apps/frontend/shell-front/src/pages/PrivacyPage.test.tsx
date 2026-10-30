import { render, screen } from '@testing-library/react';
import PrivacyPage from './PrivacyPage';

describe('PrivacyPage', () => {
  it('names every third party that receives anything', () => {
    render(<PrivacyPage />);

    // A policy that omits one of these is inaccurate, and these are exactly the
    // services the code talks to.
    for (const party of ['Google', 'OpenStreetMap', 'Alpha Vantage', 'Anthropic']) {
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

describe('assistants in a chat', () => {
  it('says that a mention sends the message and its surroundings to Anthropic, and that nothing else is sent', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/the recent ones around it are sent to Anthropic/)).toBeInTheDocument();
    expect(screen.getByText(/Messages that do not mention an assistant are not sent/)).toBeInTheDocument();
  });

  it('says it is off until everyone has agreed, and that it never reaches money', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/until everyone in it has turned it on/)).toBeInTheDocument();
    expect(screen.getByText(/but never money/)).toBeInTheDocument();
  });

  it('writes in plain words, with no em dashes', () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).not.toContain('\u2014');
  });
});
