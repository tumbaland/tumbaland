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

describe('AppLayout', () => {
  it('renders its children', () => {
    renderAt('/account/profile');

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('draws the section bar, so the app run on its own still has a navigation', () => {
    renderAt('/account/api-keys');

    expect(screen.getByRole('navigation', { name: 'Profile sections' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connections' })).toHaveAttribute('href', '/account/connections');
    expect(screen.getByRole('link', { name: 'API keys' })).toHaveAttribute('aria-current', 'page');
  });
});
