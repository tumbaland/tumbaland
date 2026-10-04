import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import AlbumsHeader from './AlbumsHeader';

it('shows the current search term and calls onSearchChange as it changes', async () => {
  const onSearchChange = vi.fn();
  render(
    <AlbumsHeader
      searchTerm="trip"
      onSearchChange={onSearchChange}
      onCreateAlbum={vi.fn()}
      onRefresh={vi.fn()}
      loading={false}
    />
  );

  const input = screen.getByPlaceholderText('Search albums...');
  expect(input).toHaveValue('trip');

  await userEvent.type(input, '!');
  expect(onSearchChange).toHaveBeenCalled();
});

it('calls onCreateAlbum when the create button is clicked', async () => {
  const onCreateAlbum = vi.fn();
  render(
    <AlbumsHeader
      searchTerm=""
      onSearchChange={vi.fn()}
      onCreateAlbum={onCreateAlbum}
      onRefresh={vi.fn()}
      loading={false}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /create album/i }));

  expect(onCreateAlbum).toHaveBeenCalledTimes(1);
});

it('calls onRefresh when the refresh button is clicked, and disables it while loading', async () => {
  const onRefresh = vi.fn();
  const { rerender } = render(
    <AlbumsHeader
      searchTerm=""
      onSearchChange={vi.fn()}
      onCreateAlbum={vi.fn()}
      onRefresh={onRefresh}
      loading={false}
    />
  );

  const refreshButton = screen.getByRole('button', { name: /refresh albums/i });
  expect(refreshButton).toBeEnabled();
  await userEvent.click(refreshButton);
  expect(onRefresh).toHaveBeenCalledTimes(1);

  rerender(
    <AlbumsHeader searchTerm="" onSearchChange={vi.fn()} onCreateAlbum={vi.fn()} onRefresh={onRefresh} loading={true} />
  );
  expect(screen.getByRole('button', { name: /refresh albums/i })).toBeDisabled();
});
