import { render, screen } from '@testing-library/react';
import PrivacyPage from './PrivacyPage';
import ConnectPage from './ConnectPage';

describe('PrivacyPage', () => {
  it('names every third party that receives anything', () => {
    render(<PrivacyPage />);

    // A policy that omits one of these is inaccurate, and these are exactly the
    // services the code talks to.
    for (const party of ['Google', 'Stripe', 'OpenStreetMap', 'Alpha Vantage']) {
      expect(screen.getAllByText(new RegExp(party)).length).toBeGreaterThan(0);
    }
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
    expect(screen.getByText(/Touch your photos, your finances, or your account/)).toBeInTheDocument();
  });
});
