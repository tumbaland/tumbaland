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
    renderAt('/admin/overview');

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('draws the section bar, so the app run on its own still has a navigation', () => {
    renderAt('/admin/users');

    expect(screen.getByRole('navigation', { name: 'Admin sections' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Deletions' })).toHaveAttribute('href', '/admin/deletions');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
  });
});
