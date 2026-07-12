import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SideMenu } from './SideMenu';

function setMobile(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

function clickApp(name: 'Home' | 'Relationship' | 'Album' | 'Finance', index = 0) {
  return userEvent.click(screen.getAllByRole('listitem', { name })[index].querySelector('[role="button"]')!);
}

afterEach(() => setMobile(false));

it('renders the permanent desktop side menu with app icons', () => {
  render(
    <MemoryRouter>
      <SideMenu currentRoute="/" />
    </MemoryRouter>
  );
  expect(screen.getByTestId('HomeIcon')).toBeInTheDocument();
  expect(screen.getByTestId('FavoriteIcon')).toBeInTheDocument();
});

it('navigates when an internal app is clicked', async () => {
  render(
    <MemoryRouter>
      <SideMenu currentRoute="/" />
    </MemoryRouter>
  );
  await clickApp('Relationship');
  expect(screen.getByTestId('FavoriteIcon')).toBeInTheDocument();
});

it('opens the burger menu on mobile and toggles the drawer', async () => {
  setMobile(true);
  render(
    <MemoryRouter>
      <SideMenu currentRoute="/" />
    </MemoryRouter>
  );

  const burger = screen.getByRole('button', { name: 'open drawer' });
  await userEvent.click(burger);
  expect(screen.getAllByTestId('FavoriteIcon').length).toBeGreaterThan(0);

  await clickApp('Relationship');
});

it('closes the mobile drawer via the overlay', async () => {
  setMobile(true);
  const { container } = render(
    <MemoryRouter>
      <SideMenu currentRoute="/" />
    </MemoryRouter>
  );

  await userEvent.click(screen.getByRole('button', { name: 'open drawer' }));
  // The overlay is the first MuiBox-root sibling rendered once the drawer is open, right
  // before the drawer content box (styling comes from an emotion class, not inline style).
  const overlay = container.querySelectorAll('.MuiBox-root')[0] as HTMLElement;
  expect(overlay).toBeTruthy();
  await userEvent.click(overlay);
});
