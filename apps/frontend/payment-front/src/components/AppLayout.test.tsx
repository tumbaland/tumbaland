import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AppLayout from './AppLayout';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout>
        <div>child content</div>
      </AppLayout>
    </MemoryRouter>
  );
}

it('renders its children', () => {
  renderAt('/payments/plans');

  expect(screen.getByText('child content')).toBeInTheDocument();
});

it('draws the section bar, so the app run on its own still has a navigation', () => {
  renderAt('/payments/subscriptions');

  expect(screen.getByRole('navigation', { name: 'Billing sections' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute('href', '/payments/plans');
  expect(screen.getByRole('link', { name: 'Subscriptions' })).toHaveAttribute('aria-current', 'page');
});
