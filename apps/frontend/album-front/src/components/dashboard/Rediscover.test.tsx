import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

vi.mock('../../hooks/useHighlights', () => ({ useRandomPhoto: vi.fn() }));

import { useRandomPhoto } from '../../hooks/useHighlights';
import Rediscover from './Rediscover';

const mockedUseRandomPhoto = useRandomPhoto as unknown as ReturnType<typeof vi.fn>;

const photo = (over: Record<string, unknown> = {}) => ({
  _id: 'p1',
  albumId: 'a1',
  albumName: 'Trip',
  originalName: 'beach.jpg',
  title: '',
  thumbnailSignedUrl: 'https://example.test/beach-thumb.jpg',
  signedUrl: 'https://example.test/beach.jpg',
  takenAt: '2024-07-03T18:20:00.000Z',
  dateSource: 'taken',
  ...over
});

const state = (over: Record<string, unknown> = {}) => ({
  photo: photo(),
  loading: false,
  isFetching: false,
  error: null,
  showAnother: vi.fn(),
  ...over
});

const renderCard = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<Rediscover />} />
        <Route path="/album/albums/:albumId/photos/:photoId" element={<div>photo page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

it('says how long ago the photo is, in words', () => {
  mockedUseRandomPhoto.mockReturnValue(state());

  renderCard();

  expect(screen.getByRole('heading', { name: 'Remember this?' })).toBeInTheDocument();
  expect(screen.getByText('2 years ago')).toBeInTheDocument();
});

it.each([
  ['2026-09-15T00:00:00.000Z', 'this month'],
  ['2026-08-10T00:00:00.000Z', 'last month'],
  ['2026-03-20T00:00:00.000Z', '6 months ago'],
  ['2025-08-20T00:00:00.000Z', 'a year ago']
])('describes %s as "%s"', (takenAt, expected) => {
  mockedUseRandomPhoto.mockReturnValue(state({ photo: photo({ takenAt }) }));

  renderCard();

  expect(screen.getByText(expected)).toBeInTheDocument();
});

it('opens the photo when the picture is activated', async () => {
  mockedUseRandomPhoto.mockReturnValue(state());

  renderCard();
  await userEvent.click(screen.getByRole('button', { name: /beach\.jpg/ }));

  expect(screen.getByText('photo page')).toBeInTheDocument();
});

it('picks again on request', async () => {
  const showAnother = vi.fn();
  mockedUseRandomPhoto.mockReturnValue(state({ showAnother }));

  renderCard();
  await userEvent.click(screen.getByRole('button', { name: /show another/i }));

  expect(showAnother).toHaveBeenCalledTimes(1);
});

it('will not let a second pick be asked for while one is in flight', () => {
  mockedUseRandomPhoto.mockReturnValue(state({ isFetching: true }));

  renderCard();

  expect(screen.getByRole('button', { name: /show another/i })).toBeDisabled();
});

it('holds the space with a skeleton while loading, since it always ends up with something', () => {
  mockedUseRandomPhoto.mockReturnValue(state({ photo: null, loading: true }));

  const { container } = renderCard();

  expect(screen.getByRole('heading', { name: 'Remember this?' })).toBeInTheDocument();
  expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
});

it('renders nothing when the library is empty', () => {
  mockedUseRandomPhoto.mockReturnValue(state({ photo: null }));

  const { container } = renderCard();

  expect(container).toBeEmptyDOMElement();
});

it('stays silent when the query fails, rather than breaking the dashboard', () => {
  mockedUseRandomPhoto.mockReturnValue(state({ photo: null, error: 'network down' }));

  const { container } = renderCard();

  expect(container).toBeEmptyDOMElement();
});
