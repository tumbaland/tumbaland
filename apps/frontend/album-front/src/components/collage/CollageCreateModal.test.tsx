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
  useAlbums: vi.fn()
}));

import { useAlbums } from '../../hooks/useAlbums';
import { CollageCreateModal } from './CollageCreateModal';

const mockedUseAlbums = useAlbums as unknown as ReturnType<typeof vi.fn>;

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

it('prefills the title with a suggested "Month Year" value', () => {
  render(<CollageCreateModal open onClose={vi.fn()} onCreate={vi.fn()} />);

  const expected = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  expect(screen.getByDisplayValue(expected)).toBeInTheDocument();
});

it('shows a validation error when no source album is selected', async () => {
  const onCreate = vi.fn();
  render(<CollageCreateModal open onClose={vi.fn()} onCreate={onCreate} />);

  await userEvent.click(screen.getByRole('button', { name: /create collage/i }));

  expect(screen.getByText('Pick at least one source album')).toBeInTheDocument();
  expect(onCreate).not.toHaveBeenCalled();
});

it('shows a validation error when the title is blank', async () => {
  const onCreate = vi.fn();
  render(<CollageCreateModal open onClose={vi.fn()} onCreate={onCreate} />);

  const titleInput = screen.getByLabelText(/collage title/i);
  await userEvent.clear(titleInput);
  await userEvent.click(screen.getByRole('button', { name: /create collage/i }));

  expect(screen.getByText('Title is required')).toBeInTheDocument();
  expect(onCreate).not.toHaveBeenCalled();
});

it('creates a collage with the selected albums and tenant groupId, then resets and closes', async () => {
  mockUseTenantFilter.mockReturnValue('group-1');
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<CollageCreateModal open onClose={onClose} onCreate={onCreate} />);

  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: 'Trip' }));
  // Close the listbox so it doesn't intercept the subtitle field's typed text.
  await userEvent.keyboard('{Escape}');
  await userEvent.type(screen.getByLabelText(/subtitle/i), 'Best weekend');
  await userEvent.click(screen.getByRole('button', { name: /create collage/i }));

  await waitFor(() => expect(onCreate).toHaveBeenCalled());
  expect(onCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      albumIds: ['album-1'],
      groupId: 'group-1',
      config: expect.objectContaining({ title: expect.objectContaining({ subtitle: 'Best weekend' }) })
    })
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('shows an error message when onCreate rejects', async () => {
  const onCreate = vi.fn().mockRejectedValue(new Error('server down'));
  render(<CollageCreateModal open onClose={vi.fn()} onCreate={onCreate} />);

  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: 'Trip' }));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: /create collage/i }));

  expect(await screen.findByText('server down')).toBeInTheDocument();
});

it('refreshes albums via fetchAlbums when the refresh icon is clicked', async () => {
  render(<CollageCreateModal open onClose={vi.fn()} onCreate={vi.fn()} />);

  const refreshButton = document.querySelector('[data-testid="RefreshIcon"]')!.closest('button')!;
  await userEvent.click(refreshButton);

  expect(mockFetchAlbums).toHaveBeenCalledTimes(1);
});

it('calls onClose without creating when Cancel is clicked', async () => {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(<CollageCreateModal open onClose={onClose} onCreate={onCreate} />);

  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(onCreate).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});
