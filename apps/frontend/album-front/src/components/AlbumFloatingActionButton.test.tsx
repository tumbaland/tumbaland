import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AlbumFloatingActionButton from './AlbumFloatingActionButton';

it('calls onUploadPhotos when clicked', async () => {
  const onUploadPhotos = vi.fn();
  render(<AlbumFloatingActionButton onUploadPhotos={onUploadPhotos} />);

  await userEvent.click(screen.getByRole('button', { name: /upload media/i }));

  expect(onUploadPhotos).toHaveBeenCalledTimes(1);
});
