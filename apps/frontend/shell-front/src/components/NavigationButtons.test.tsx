import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { vi } from 'vitest';
import { Home } from '@mui/icons-material';
import { NavigationButtons } from './NavigationButtons';

const items = [
  { key: 'home', label: 'Home', route: '/home', icon: Home },
  { key: 'other', label: 'Other', route: '/other', icon: Home }
];

function renderAt(path: string, props: Partial<Parameters<typeof NavigationButtons>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<NavigationButtons items={items} currentRoute={path} {...props} />} />
      </Routes>
    </MemoryRouter>
  );
}

it('renders text buttons by default and highlights the active route', () => {
  renderAt('/home');
  const homeButton = screen.getByRole('button', { name: 'Home' });
  expect(homeButton).toHaveClass('MuiButton-colorPrimary');
  const otherButton = screen.getByRole('button', { name: 'Other' });
  expect(otherButton).not.toHaveClass('MuiButton-colorPrimary');
});

it('renders icon buttons when variant is "icons"', () => {
  renderAt('/other', { variant: 'icons' });
  expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument();
});

it('navigates and calls onRouteChange when a button is clicked', async () => {
  const onRouteChange = vi.fn();
  renderAt('/home', { onRouteChange });

  await userEvent.click(screen.getByRole('button', { name: 'Other' }));

  expect(onRouteChange).toHaveBeenCalledWith('/other');
});
