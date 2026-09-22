import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaGrid, columnsFor, formatDuration, isVideo, previewSrc } from './MediaGrid';
import type { Attachment } from '../../types';

const photo = (overrides: Partial<Attachment> = {}): Attachment => ({
  fileId: 'f1',
  mimetype: 'image/jpeg',
  sizeBytes: 1000,
  url: 'https://files/f1',
  ...overrides
});

const video = (overrides: Partial<Attachment> = {}): Attachment =>
  photo({ fileId: 'v1', mimetype: 'video/mp4', url: 'https://files/v1', ...overrides });

describe('isVideo', () => {
  it('does not crash the thread if an older response is missing its media type', () => {
    expect(isVideo({ fileId: 'f1', sizeBytes: 1000 } as Attachment)).toBe(false);
  });

  it.each([['video/mp4'], ['video/quicktime'], ['video/webm']])('recognises %s', (mimetype) => {
    expect(isVideo(photo({ mimetype }))).toBe(true);
  });

  it('does not treat an image as a video', () => {
    expect(isVideo(photo())).toBe(false);
  });
});

describe('previewSrc', () => {
  it('prefers the thumbnail for an image, so a full phone photo is not downloaded to fill a bubble', () => {
    expect(previewSrc(photo({ thumbnailUrl: 'https://files/thumb' }))).toBe('https://files/thumb');
  });

  it('falls back to the original when no thumbnail was made', () => {
    expect(previewSrc(photo())).toBe('https://files/f1');
  });

  it('uses the poster for a video, never the video itself', () => {
    // Pointing an <img> at a 200 MB clip would download all of it.
    expect(previewSrc(video({ posterUrl: 'https://files/poster' }))).toBe('https://files/poster');
  });

  it('has nothing to show for a video with no poster', () => {
    expect(previewSrc(video())).toBeNull();
  });

  it('has nothing to show when the URL could not be minted', () => {
    expect(previewSrc(photo({ url: null }))).toBeNull();
  });
});

describe('columnsFor', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [9, 3]
  ])('lays %i attachments in %i columns', (count, columns) => {
    expect(columnsFor(count)).toBe(columns);
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(95_000)).toBe('1:35');
  });

  it('pads the seconds', () => {
    expect(formatDuration(65_000)).toBe('1:05');
  });

  it('shows a short clip as zero minutes', () => {
    expect(formatDuration(4_000)).toBe('0:04');
  });

  it.each([[0], [null], [undefined]])('shows nothing for %s', (value) => {
    expect(formatDuration(value)).toBeNull();
  });
});

describe('MediaGrid', () => {
  it('tries a refreshed signed URL after the previous URL failed', () => {
    const { container, rerender } = render(<MediaGrid attachments={[photo()]} onOpen={() => {}} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();

    rerender(<MediaGrid attachments={[photo({ url: 'https://files/f1?renewed' })]} onOpen={() => {}} />);

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://files/f1?renewed');
  });

  it('renders a tile per attachment', () => {
    render(<MediaGrid attachments={[photo(), photo({ fileId: 'f2' })]} onOpen={() => {}} />);

    expect(screen.getAllByRole('button', { name: 'Open photo' })).toHaveLength(2);
  });

  it('reports which tile was opened', async () => {
    const onOpen = vi.fn();
    render(<MediaGrid attachments={[photo(), photo({ fileId: 'f2' })]} onOpen={onOpen} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Open photo' })[1]!);

    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it('labels a video tile as a video', () => {
    render(<MediaGrid attachments={[video({ posterUrl: 'https://files/p' })]} onOpen={() => {}} />);

    expect(screen.getByRole('button', { name: 'Open video' })).toBeInTheDocument();
  });

  it('shows a clip’s duration', () => {
    render(
      <MediaGrid attachments={[video({ posterUrl: 'https://files/p', durationMs: 42_000 })]} onOpen={() => {}} />
    );

    expect(screen.getByText('0:42')).toBeInTheDocument();
  });

  it('shows a broken-file tile rather than the browser’s glyph when no URL was minted', () => {
    // Signed URLs expire and file-service can be unreachable.
    const { container } = render(<MediaGrid attachments={[photo({ url: null })]} onOpen={() => {}} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open photo' })).toBeInTheDocument();
  });

  it('still lets a broken tile be opened, so the lightbox can explain', async () => {
    const onOpen = vi.fn();
    render(<MediaGrid attachments={[photo({ url: null })]} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open photo' }));

    expect(onOpen).toHaveBeenCalledWith(0);
  });
});

describe('a video with no poster', () => {
  it('shows the video’s own first frame instead of a broken image', () => {
    const { container } = render(
      <MediaGrid
        attachments={[{ fileId: 'v1', mimetype: 'video/mp4', sizeBytes: 1, url: 'https://files.test/v1?token=x', posterUrl: null }]}
        onOpen={() => {}}
      />
    );

    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', 'https://files.test/v1?token=x#t=0.1');
    expect(screen.getByRole('button', { name: 'Open video' })).toBeInTheDocument();
  });

  it('falls back to the first frame when the poster itself will not load', () => {
    const { container } = render(
      <MediaGrid
        attachments={[
          { fileId: 'v1', mimetype: 'video/mp4', sizeBytes: 1, url: 'https://files.test/v1', posterUrl: 'https://files.test/p1' }
        ]}
        onOpen={() => {}}
      />
    );

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('video')).toHaveAttribute('src', 'https://files.test/v1#t=0.1');
  });
});
