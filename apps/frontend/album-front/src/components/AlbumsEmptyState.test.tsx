import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AlbumsEmptyState from './AlbumsEmptyState';

it('shows the no-albums-yet message and a create button when there is no search term', async () => {
  const onCreateAlbum = vi.fn();
  render(<AlbumsEmptyState searchTerm="" onCreateAlbum={onCreateAlbum} />);

  expect(screen.getByText('No albums yet')).toBeInTheDocument();
  expect(screen.getByText('Create your first album to get started')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /create album/i }));
  expect(onCreateAlbum).toHaveBeenCalledTimes(1);
});

it('shows a no-results message and hides the create button when there is a search term', () => {
  render(<AlbumsEmptyState searchTerm="vacation" onCreateAlbum={vi.fn()} />);

  expect(screen.getByText('No albums found')).toBeInTheDocument();
  expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /create album/i })).not.toBeInTheDocument();
});
