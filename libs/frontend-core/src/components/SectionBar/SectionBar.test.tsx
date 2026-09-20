import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MapIcon from '@mui/icons-material/Map';
import { SectionBar, type SectionBarItem } from './SectionBar';

const items: SectionBarItem[] = [
  { label: 'Dashboard', route: '/album/dashboard', icon: DashboardIcon },
  { label: 'Albums', route: '/album/albums' },
  { label: 'Map', route: '/album/map', icon: MapIcon }
];

function renderBar(currentRoute: string, props: Partial<React.ComponentProps<typeof SectionBar>> = {}) {
  return render(
    <MemoryRouter initialEntries={[currentRoute]}>
      <SectionBar title="Album" items={items} currentRoute={currentRoute} {...props} />
    </MemoryRouter>
  );
}

it('lists every section as a link on a wide screen', () => {
  renderBar('/album/albums');

  expect(screen.getByRole('navigation', { name: 'Album sections' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/album/dashboard');
  expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/album/map');
});

it('marks the section being shown as the current page', () => {
  renderBar('/album/albums');

  expect(screen.getByRole('link', { name: 'Albums' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Map' })).not.toHaveAttribute('aria-current');
});

it('keeps a section current while the reader is deeper inside it', () => {
  renderBar('/album/albums/64f2/photos/abc');

  expect(screen.getByRole('link', { name: 'Albums' })).toHaveAttribute('aria-current', 'page');
});

it('leaves the module unnamed where its sections already say where you are', () => {
  renderBar('/album/albums');

  // The rail entry beside the bar is lit and the active pill reads "Albums".
  // A third "Album" in the corner was furniture.
  expect(screen.queryByText('Album')).not.toBeInTheDocument();
});

it('names the module on a phone too, where the dropdown carries the section', () => {
  renderBar('/album/albums', { compact: true });

  expect(screen.queryByText('Album')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Albums/ })).toBeInTheDocument();
});

it('collapses to one dropdown on a phone, labelled with the section being shown', async () => {
  renderBar('/album/map', { compact: true });

  // The row of links would not fit, so there is one button instead.
  expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: /Map/ });

  await userEvent.click(trigger);

  expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/album/dashboard');
  expect(screen.getByRole('menuitem', { name: 'Map' })).toHaveAttribute('aria-current', 'page');
});

it('falls back to the module name where no section owns the path', () => {
  renderBar('/album', { compact: true });

  expect(screen.getByRole('button', { name: /Album/ })).toBeInTheDocument();
});

it('draws just the title and the end slot for a module with no sections', () => {
  render(
    <MemoryRouter initialEntries={['/groups']}>
      <SectionBar title="Groups" currentRoute="/groups" end={<span>tenant selector</span>} />
    </MemoryRouter>
  );

  expect(screen.getByText('Groups')).toBeInTheDocument();
  expect(screen.getByText('tenant selector')).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
