import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router';
import { vi } from 'vitest';

vi.mock('../../hooks/useCollage', () => ({ useCollageList: vi.fn() }));

import { useCollageList } from '../../hooks/useCollage';
import RecentCollages from './RecentCollages';

const mockedUseCollageList = useCollageList as unknown as ReturnType<typeof vi.fn>;

/** Reports which mode the collage route was entered in. */
const CollageRoute = () => {
  const [params] = useSearchParams();
  return <div>collage detail: {params.get('mode') ?? 'edit'}</div>;
};

const collage = (id: string, title: string, updatedAt: string) => ({
  _id: id,
  title,
  config: {},
  albumIds: [],
  ownerId: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt
});

const renderWidget = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<RecentCollages />} />
        <Route path="/album/collages" element={<div>collages page</div>} />
        <Route path="/album/collages/:id" element={<CollageRoute />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

it('lists the most recently edited collages first', () => {
  mockedUseCollageList.mockReturnValue({
    data: [
      collage('c1', 'Older', '2026-02-01T00:00:00.000Z'),
      collage('c2', 'Newest', '2026-05-01T00:00:00.000Z'),
      collage('c3', 'Middle', '2026-03-01T00:00:00.000Z')
    ],
    error: null
  });

  renderWidget();

  const titles = screen.getAllByRole('button', { name: /edited/i }).map((b) => b.textContent);
  expect(titles?.[0]).toContain('Newest');
  expect(titles?.[1]).toContain('Middle');
  expect(titles?.[2]).toContain('Older');
});

it('shows at most four, however many there are', () => {
  mockedUseCollageList.mockReturnValue({
    data: Array.from({ length: 9 }, (_, i) => collage(`c${i}`, `Wall ${i}`, `2026-0${(i % 9) + 1}-01T00:00:00.000Z`)),
    error: null
  });

  renderWidget();

  expect(screen.getAllByRole('button', { name: /edited/i })).toHaveLength(4);
});

it('opens a collage in view mode, not the editor', async () => {
  mockedUseCollageList.mockReturnValue({
    data: [collage('c1', 'Summer wall', '2026-05-01T00:00:00.000Z')],
    error: null
  });

  renderWidget();
  await userEvent.click(screen.getByRole('button', { name: /Summer wall, edited/i }));

  // View, not edit: tapping a thumbnail on a dashboard is a request to look
  // at it, and the bare route mounts the full editor.
  expect(screen.getByText('collage detail: view')).toBeInTheDocument();
});

it('leads to the full list', async () => {
  mockedUseCollageList.mockReturnValue({
    data: [collage('c1', 'Summer wall', '2026-05-01T00:00:00.000Z')],
    error: null
  });

  renderWidget();
  await userEvent.click(screen.getByRole('button', { name: /see all/i }));

  expect(screen.getByText('collages page')).toBeInTheDocument();
});

it('renders nothing at all when there are no collages', () => {
  mockedUseCollageList.mockReturnValue({ data: [], error: null });

  const { container } = renderWidget();

  expect(container).toBeEmptyDOMElement();
});

it('stays silent when the list fails, rather than breaking the dashboard', () => {
  mockedUseCollageList.mockReturnValue({ data: undefined, error: new Error('network down') });

  const { container } = renderWidget();

  expect(container).toBeEmptyDOMElement();
});
