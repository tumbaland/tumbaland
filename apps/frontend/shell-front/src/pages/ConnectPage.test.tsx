import { render, screen } from '@testing-library/react';
import ConnectPage from './ConnectPage';

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
