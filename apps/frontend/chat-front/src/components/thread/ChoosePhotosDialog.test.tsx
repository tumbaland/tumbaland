import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoosePhotosDialog } from './ChoosePhotosDialog';
import type { Attachment } from '../../types';

const photos: Attachment[] = [
  { fileId: 'a', mimetype: 'image/jpeg', sizeBytes: 1, thumbnailUrl: 'https://t/a', albumId: 'r', albumName: 'Rome' },
  { fileId: 'b', mimetype: 'image/jpeg', sizeBytes: 1, thumbnailUrl: 'https://t/b', albumId: null, albumName: null },
  { fileId: 'c', mimetype: 'image/jpeg', sizeBytes: 1, thumbnailUrl: 'https://t/c', albumId: 'r', albumName: 'Rome' }
];

const open = (props: Partial<Parameters<typeof ChoosePhotosDialog>[0]> = {}) =>
  render(
    <ChoosePhotosDialog
      open
      title="Which photos?"
      photos={photos}
      initial={['a', 'b', 'c']}
      confirmLabel={(count) => `Next (${count})`}
      onConfirm={() => {}}
      onClose={() => {}}
      {...props}
    />
  );

describe('ChoosePhotosDialog', () => {
  it('shows where each photo is now', () => {
    open();
    expect(screen.getByRole('button', { name: 'Photo 1, in Rome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Photo 2, not in an album' })).toBeInTheDocument();
  });

  it('hands over the ticked ones, in the message\u2019s order', async () => {
    const onConfirm = vi.fn();
    open({ onConfirm });

    await userEvent.click(screen.getByRole('button', { name: 'Photo 2, not in an album' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next (2)' }));

    expect(onConfirm).toHaveBeenCalledWith(['a', 'c']);
  });

  it('will not go on with nothing ticked', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }));
    expect(screen.getByRole('button', { name: 'Next (0)' })).toBeDisabled();
  });

  it('stays open and says so when saving fails', async () => {
    open({ onConfirm: () => Promise.reject(new Error('offline')) });

    await userEvent.click(screen.getByRole('button', { name: 'Next (3)' }));

    expect(await screen.findByText('Could not save that. Try again.')).toBeInTheDocument();
  });
});
