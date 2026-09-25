import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockUseTenantFilter = vi.fn();
vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => mockUseTenantFilter() };
});

const mockFetchAlbums = vi.fn();
vi.mock('../../hooks/useAlbums', () => ({
  useAllAlbums: vi.fn()
}));

import { useAllAlbums } from '../../hooks/useAlbums';
import { CollageEditModal } from './CollageEditModal';
import { Collage } from '../../types/collage';

const mockedUseAlbums = useAllAlbums as unknown as ReturnType<typeof vi.fn>;

const initialData: Collage = {
  _id: 'collage-1',
  title: 'Original title',
  config: {
    version: '2',
    date: '2024-01-01',
    viewport: { width: 1600, height: 900 },
    theme: 'default',
    photos: [],
    title: { text: 'Original title', subtitle: 'Original subtitle' }
  },
  albumIds: ['album-1'],
  ownerId: 'user-1',
  createdAt: '',
  updatedAt: ''
};

const albums = [
  {
    _id: 'album-1',
    name: 'Trip',
    isPublic: false,
    tags: [],
    photoCount: 0,
    userId: 'u1',
    createdAt: '',
    updatedAt: ''
  },
  {
    _id: 'album-2',
    name: 'Party',
    isPublic: false,
    tags: [],
    photoCount: 0,
    userId: 'u1',
    createdAt: '',
    updatedAt: ''
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTenantFilter.mockReturnValue(undefined);
  mockedUseAlbums.mockReturnValue({ albums, loading: false, fetchAlbums: mockFetchAlbums });
});

it('prefills title, subtitle, and selected albums from initialData', () => {
  render(<CollageEditModal open onClose={vi.fn()} onSave={vi.fn()} initialData={initialData} />);

  expect(screen.getByDisplayValue('Original title')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Original subtitle')).toBeInTheDocument();
});

it('saves the title, subtitle and albums with the tenant groupId, and never the layout', async () => {
  mockUseTenantFilter.mockReturnValue('group-1');
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<CollageEditModal open onClose={onClose} onSave={onSave} initialData={initialData} />);

  const titleInput = screen.getByDisplayValue('Original title');
  await userEvent.clear(titleInput);
  await userEvent.type(titleInput, 'New title');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onSave).toHaveBeenCalled());
  // No config: someone may be editing the layout right now, and this
  // dialog's copy of it could be minutes old.
  expect(onSave).toHaveBeenCalledWith({
    title: 'New title',
    subtitle: 'Original subtitle',
    albumIds: ['album-1'],
    groupId: 'group-1'
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('shows an error message when onSave rejects', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('network down'));
  render(<CollageEditModal open onClose={vi.fn()} onSave={onSave} initialData={initialData} />);

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('network down')).toBeInTheDocument();
});

it('disables Save while the title is empty or no albums are selected', async () => {
  render(<CollageEditModal open onClose={vi.fn()} onSave={vi.fn()} initialData={initialData} />);

  const titleInput = screen.getByDisplayValue('Original title');
  await userEvent.clear(titleInput);

  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

it('refreshes albums via fetchAlbums when the refresh icon is clicked', async () => {
  render(<CollageEditModal open onClose={vi.fn()} onSave={vi.fn()} initialData={initialData} />);

  // MUI's Dialog renders via a portal into document.body, outside the
  // render()-returned container, so query the whole document instead.
  const refreshButton = document.querySelector('[data-testid="RefreshIcon"]')!.closest('button')!;
  await userEvent.click(refreshButton);

  expect(mockFetchAlbums).toHaveBeenCalledTimes(1);
});

it('calls onClose without saving when Cancel is clicked', async () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<CollageEditModal open onClose={onClose} onSave={onSave} initialData={initialData} />);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onSave).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});
