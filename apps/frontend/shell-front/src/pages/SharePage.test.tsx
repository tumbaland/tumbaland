import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vite-plus/test';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../hooks/useAuthState', () => ({
  useAuthState: () => ({ loading: false, authenticated: true, user: { id: 'me', email: 'me@example.com', name: 'Me' } })
}));

vi.mock('@tumbaland/frontend-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tumbaland/frontend-core')>()),
  readShare: vi.fn(),
  clearShare: vi.fn()
}));

vi.mock('../services/shareApi', async () => {
  const actual = await vi.importActual<typeof import('../services/shareApi')>('../services/shareApi');
  return { ...actual, listConversations: vi.fn(), listAlbums: vi.fn() };
});

import SharePage from './SharePage';
import { clearShare, readShare, type SharedItem } from '@tumbaland/frontend-core';
import { listAlbums, listConversations } from '../services/shareApi';

const share = (overrides: Partial<SharedItem> = {}): SharedItem => ({
  title: '',
  text: '',
  url: '',
  files: [],
  receivedAt: 0,
  ...overrides
});

const photo = () => new File(['x'], 'beach.jpg', { type: 'image/jpeg' });

function renderPage() {
  return render(
    <MemoryRouter>
      <SharePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(listConversations).mockResolvedValue([
    {
      id: 'c1',
      title: '',
      members: [
        { userId: 'me', name: 'Me', email: '' },
        { userId: 'p', name: 'Mari', email: '' }
      ]
    }
  ]);
  vi.mocked(listAlbums).mockResolvedValue([{ _id: 'a1', name: 'Summer', photoCount: 3 }]);
});

it('shows a shared link and opens the chosen chat with it', async () => {
  vi.mocked(readShare).mockResolvedValue(share({ text: 'https://youtu.be/abc' }));
  renderPage();

  expect(await screen.findByText('https://youtu.be/abc')).toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: /Mari/ }));

  expect(navigate).toHaveBeenCalledWith('/chat/c1?shared=1', { replace: true });
});

it('offers albums only when photos came in', async () => {
  vi.mocked(readShare).mockResolvedValue(share({ text: 'https://youtu.be/abc' }));
  renderPage();
  await screen.findByRole('button', { name: /Mari/ });

  expect(screen.queryByText('Add to an album')).not.toBeInTheDocument();
  expect(listAlbums).not.toHaveBeenCalled();
});

it('sends shared photos to the chosen album', async () => {
  vi.mocked(readShare).mockResolvedValue(share({ files: [photo()] }));
  renderPage();

  await userEvent.click(await screen.findByRole('button', { name: /Summer/ }));

  expect(navigate).toHaveBeenCalledWith('/album/albums/a1?shared=1', { replace: true });
});

it('says which files were left out', async () => {
  vi.mocked(readShare).mockResolvedValue(
    share({ files: [photo(), new File(['x'], 'notes.pdf', { type: 'application/pdf' })] })
  );
  renderPage();

  expect(await screen.findByText(/One file was left out/)).toBeInTheDocument();
});

it('says so when nothing is waiting', async () => {
  vi.mocked(readShare).mockResolvedValue(null);
  renderPage();

  expect(await screen.findByText('Nothing came through')).toBeInTheDocument();
  expect(listConversations).not.toHaveBeenCalled();
});

it('drops the share on Cancel', async () => {
  vi.mocked(readShare).mockResolvedValue(share({ text: 'hello' }));
  renderPage();

  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

  expect(clearShare).toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith('/', { replace: true });
});
