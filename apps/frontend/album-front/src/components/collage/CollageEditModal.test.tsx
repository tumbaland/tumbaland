import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockUseTenantFilter = vi.fn();
vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => mockUseTenantFilter() };
});

const mockFetchAlbums = vi.fn();
vi.mock('../../hooks/useAlbums', () => ({
  useAlbums: vi.fn()
}));

import { useAlbums } from '../../hooks/useAlbums';
import { CollageEditModal } from './CollageEditModal';
import { Collage } from '../../types/collage';

const mockedUseAlbums = useAlbums as unknown as ReturnType<typeof vi.fn>;

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

it('saves the updated title/subtitle/albums, preserving ownerId and merging the tenant groupId', async () => {
  mockUseTenantFilter.mockReturnValue('group-1');
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<CollageEditModal open onClose={onClose} onSave={onSave} initialData={initialData} />);

  const titleInput = screen.getByDisplayValue('Original title');
  await userEvent.clear(titleInput);
  await userEvent.type(titleInput, 'New title');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'New title',
      ownerId: 'user-1',
      albumIds: ['album-1'],
      groupId: 'group-1',
      config: expect.objectContaining({ title: { text: 'New title', subtitle: 'Original subtitle' } })
    })
  );
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
