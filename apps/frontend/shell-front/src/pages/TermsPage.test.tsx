import { render, screen } from '@testing-library/react';
import TermsPage from './TermsPage';

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
