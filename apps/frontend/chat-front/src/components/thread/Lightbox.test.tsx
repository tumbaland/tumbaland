import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lightbox } from './Lightbox';
import type { Attachment } from '../../types';

const photo = (overrides: Partial<Attachment> = {}): Attachment => ({
  fileId: 'f1',
  url: 'https://files.test/f1',
  mimetype: 'image/jpeg',
  sizeBytes: 1,
  ...overrides
});

describe('Lightbox album bar', () => {
  it("says which album the photo on screen is in, and changes that photo's album", async () => {
    const onEditAlbum = vi.fn();
    render(
      <Lightbox
        attachments={[photo(), photo({ fileId: 'f2', albumId: 'a-rome', albumName: 'Rome' })]}
        index={1}
        onClose={() => {}}
        onEditAlbum={onEditAlbum}
      />
    );

    expect(screen.getByText('In Rome')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Change this photo's album" }));

    expect(onEditAlbum).toHaveBeenCalledWith(1);
  });

  it('offers to add a photo that is in no album', () => {
    render(<Lightbox attachments={[photo()]} index={0} onClose={() => {}} onEditAlbum={() => {}} />);

    expect(screen.getByText('Not in an album')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Change this photo's album" })).toHaveTextContent('Add to album');
  });

  it('draws no album bar where albums cannot be changed', () => {
    render(<Lightbox attachments={[photo()]} index={0} onClose={() => {}} />);
    expect(screen.queryByText('Not in an album')).not.toBeInTheDocument();
  });
});

describe('Use as background', () => {
  it('makes the photo on screen the background', async () => {
    const onUseAsBackground = vi.fn();
    render(<Lightbox attachments={[photo()]} index={0} onClose={() => {}} onUseAsBackground={onUseAsBackground} />);

    await userEvent.click(screen.getByRole('button', { name: 'Use as background' }));

    expect(onUseAsBackground).toHaveBeenCalledWith(0);
  });

  it('is not offered for a video', () => {
    render(
      <Lightbox
        attachments={[photo({ mimetype: 'video/mp4' })]}
        index={0}
        onClose={() => {}}
        onUseAsBackground={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: 'Use as background' })).not.toBeInTheDocument();
  });
});
