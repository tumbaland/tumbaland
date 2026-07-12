import { render, screen } from '@testing-library/react';
import TermsPage from './TermsPage';

it('renders the terms sections', () => {
  render(<TermsPage />);
  expect(screen.getByText('Terms and Conditions')).toBeInTheDocument();
  expect(screen.getByText('1. Subscriptions and Billing')).toBeInTheDocument();
  expect(screen.getByText('6. Contact')).toBeInTheDocument();
});
