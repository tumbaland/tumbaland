import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

vi.mock('../../hooks/useHighlights', () => ({ useRecentPhotos: vi.fn() }));

import { useRecentPhotos } from '../../hooks/useHighlights';
import RecentUploads from './RecentUploads';

const mockedUseRecentPhotos = useRecentPhotos as unknown as ReturnType<typeof vi.fn>;

const photo = (over: Record<string, unknown> = {}) => ({
  _id: 'p1',
  albumId: 'a1',
  albumName: 'Trip',
  originalName: 'beach.jpg',
  title: '',
  thumbnailSignedUrl: 'https://example.test/beach-thumb.jpg',
  signedUrl: 'https://example.test/beach.jpg',
  takenAt: '2026-09-04T08:00:00.000Z',
  dateSource: 'taken',
  ...over
});

const renderStrip = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<RecentUploads />} />
        <Route path="/album/albums" element={<div>albums page</div>} />
        <Route path="/album/albums/:albumId/photos/:photoId" element={<div>photo page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

it('shows the photos it was given', () => {
  mockedUseRecentPhotos.mockReturnValue({
    photos: [photo(), photo({ _id: 'p2', originalName: 'hill.jpg' })],
    error: null
  });

  renderStrip();

  expect(screen.getByRole('heading', { name: 'Just added' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /\.jpg/ })).toHaveLength(2);
});

it('opens the photo when a tile is activated', async () => {
  mockedUseRecentPhotos.mockReturnValue({ photos: [photo()], error: null });

  renderStrip();
  await userEvent.click(screen.getByRole('button', { name: /beach\.jpg/ }));

  expect(screen.getByText('photo page')).toBeInTheDocument();
});

it('says a photo is dated by its upload rather than implying a capture date', () => {
  mockedUseRecentPhotos.mockReturnValue({ photos: [photo({ dateSource: 'uploaded' })], error: null });

  renderStrip();

  expect(screen.getByRole('button', { name: /\(uploaded\)/ })).toBeInTheDocument();
});

it('renders nothing when there is nothing to show', () => {
  mockedUseRecentPhotos.mockReturnValue({ photos: [], error: null });

  const { container } = renderStrip();

  expect(container).toBeEmptyDOMElement();
});

it('stays silent when the query fails, rather than breaking the dashboard', () => {
  mockedUseRecentPhotos.mockReturnValue({ photos: [], error: 'network down' });

  const { container } = renderStrip();

  expect(container).toBeEmptyDOMElement();
});
