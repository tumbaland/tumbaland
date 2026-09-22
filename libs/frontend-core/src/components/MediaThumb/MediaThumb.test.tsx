import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MediaThumb } from './MediaThumb';

describe('MediaThumb', () => {
  it('draws a photo as an image', () => {
    const { container } = render(<MediaThumb src="https://files.test/p.jpg" mimetype="image/jpeg" alt="Beach" />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://files.test/p.jpg');
    expect(img).toHaveAttribute('alt', 'Beach');
    expect(container.querySelector('video')).toBeNull();
  });

  it('treats an item with no file type as a photo', () => {
    const { container } = render(<MediaThumb src="https://files.test/p.jpg" />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('draws a video as its first frame, since an image cannot show a video', () => {
    const { container } = render(<MediaThumb src="https://files.test/v.mp4?token=x" mimetype="video/mp4" />);

    const video = container.querySelector('video')!;
    // The fragment asks for the frame 0.1s in; iOS draws black without it.
    expect(video).toHaveAttribute('src', 'https://files.test/v.mp4?token=x#t=0.1');
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(container.querySelector('img')).toBeNull();
  });

  it('reports a video frame arriving the way an image reports loading', () => {
    const onLoad = vi.fn();
    const { container } = render(<MediaThumb src="https://files.test/v.mp4" mimetype="video/quicktime" onLoad={onLoad} />);

    fireEvent.loadedData(container.querySelector('video')!);

    expect(onLoad).toHaveBeenCalled();
  });
});
