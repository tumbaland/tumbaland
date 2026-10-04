import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lightbox, canShareFile } from './Lightbox';
import type { Attachment } from '../../types';

const photo = (n: number, overrides: Partial<Attachment> = {}): Attachment => ({
  fileId: `f${n}`,
  url: `https://files.test/f${n}`,
  mimetype: 'image/jpeg',
  sizeBytes: 1,
  ...overrides
});

const three = [photo(1), photo(2), photo(3)];
const shown = () => (document.querySelector('img') as HTMLImageElement | null)?.getAttribute('src');

const setShareSupport = (canShare: boolean, share = vi.fn().mockResolvedValue(undefined)) => {
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => canShare) });
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  return share;
};

afterEach(() => {
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
  vi.unstubAllGlobals();
});

describe('moving between attachments', () => {
  it('steps with the arrows on screen, and stops at either end', async () => {
    render(<Lightbox attachments={three} index={1} onClose={() => {}} />);
    expect(shown()).toBe('https://files.test/f2');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(shown()).toBe('https://files.test/f3');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(shown()).toBe('https://files.test/f1');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('steps with the arrow keys', () => {
    render(<Lightbox attachments={three} index={1} onClose={() => {}} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shown()).toBe('https://files.test/f3');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shown()).toBe('https://files.test/f3');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(shown()).toBe('https://files.test/f1');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(shown()).toBe('https://files.test/f1');
  });

  it('draws no arrows for a single attachment', () => {
    render(<Lightbox attachments={[photo(1)]} index={0} onClose={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('opens on whichever attachment was tapped, each time it is reopened', () => {
    const { rerender } = render(<Lightbox attachments={three} index={2} onClose={() => {}} />);
    expect(shown()).toBe('https://files.test/f3');

    rerender(<Lightbox attachments={three} index={null} onClose={() => {}} />);
    expect(document.querySelector('img')).toBeNull();

    rerender(<Lightbox attachments={three} index={0} onClose={() => {}} />);
    expect(shown()).toBe('https://files.test/f1');
  });

  it('ignores the arrow keys while closed', () => {
    const { rerender } = render(<Lightbox attachments={three} index={0} onClose={() => {}} />);
    rerender(<Lightbox attachments={three} index={null} onClose={() => {}} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    rerender(<Lightbox attachments={three} index={0} onClose={() => {}} />);

    expect(shown()).toBe('https://files.test/f1');
  });

  it('closes from its own button', async () => {
    const onClose = vi.fn();
    render(<Lightbox attachments={three} index={0} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('what is on screen', () => {
  it('plays a video with its poster', () => {
    render(
      <Lightbox
        attachments={[photo(1, { mimetype: 'video/mp4', posterUrl: 'https://files.test/poster' })]}
        index={0}
        onClose={() => {}}
      />
    );

    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('https://files.test/f1');
    expect(video.getAttribute('poster')).toBe('https://files.test/poster');
  });

  it('says so when the file has no address', () => {
    render(<Lightbox attachments={[photo(1, { url: undefined })]} index={0} onClose={() => {}} />);

    expect(screen.getByText('That file is not available right now.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('draws nothing for an index with no attachment behind it', () => {
    const { container } = render(<Lightbox attachments={[]} index={0} onClose={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('sharing', () => {
  const respondWithBlob = (type = 'image/png') =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => new Blob(['bytes'], { type }) }));

  it('knows whether the browser takes a file in its share sheet', () => {
    const file = new File([], 'a', { type: 'image/jpeg' });
    expect(canShareFile(file)).toBe(false);

    setShareSupport(true);
    expect(canShareFile(file)).toBe(true);

    setShareSupport(false);
    expect(canShareFile(file)).toBe(false);
  });

  it('offers no Share button where files cannot be shared', () => {
    setShareSupport(false);

    render(<Lightbox attachments={[photo(1)]} index={0} onClose={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
  });

  it('hands the file to the share sheet', async () => {
    const share = setShareSupport(true);
    respondWithBlob('image/png');
    render(<Lightbox attachments={[photo(1)]} index={0} onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [{ files }] = share.mock.calls[0] as [{ files: File[] }];
    expect(files[0]).toMatchObject({ name: 'tumbaland.png', type: 'image/png' });
  });

  it('does not mind a share sheet that is dismissed', async () => {
    const share = setShareSupport(true, vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));
    respondWithBlob();
    render(<Lightbox attachments={[photo(1)]} index={0} onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('shares nothing when the file cannot be fetched', async () => {
    const share = setShareSupport(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<Lightbox attachments={[photo(1)]} index={0} onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(share).not.toHaveBeenCalled();
  });
});
