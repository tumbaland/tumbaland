import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, vi } from 'vite-plus/test';
import CollagePhotoTray, { AlbumPhoto } from './CollagePhotoTray';

const photos: AlbumPhoto[] = [
  { _id: 'p1', filename: 'a.jpg', title: 'Beach', thumbnailSignedUrl: 'https://cdn.example/a-thumb.jpg' },
  { _id: 'p2', filename: 'b.jpg', signedUrl: 'https://cdn.example/b-full.jpg' },
  { _id: 'p3', filename: 'c.jpg' }
];

it('shows the photo count and renders a tile per photo', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByText(/photos \(3\)/i)).toBeInTheDocument();
  expect(screen.getAllByRole('img')).toHaveLength(2);
});

it('prefers the thumbnail signed URL over the full signed URL', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByRole('img', { name: 'Beach' })).toHaveAttribute('src', 'https://cdn.example/a-thumb.jpg');
});

it('falls back to the full signed URL when there is no thumbnail', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByRole('img', { name: 'b.jpg' })).toHaveAttribute('src', 'https://cdn.example/b-full.jpg');
});

it('shows a "No preview" placeholder when the photo has no URL at all', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByText('No preview')).toBeInTheDocument();
});

it('calls onAddPhoto when a tile is clicked', async () => {
  const onAddPhoto = vi.fn();
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={onAddPhoto} />);

  await userEvent.click(screen.getByRole('img', { name: 'Beach' }));

  expect(onAddPhoto).toHaveBeenCalledWith(photos[0]);
});

it('shows a check icon on photos already used in the collage', () => {
  const { container } = render(
    <CollagePhotoTray photos={photos} usedPhotoIds={new Set(['p1'])} onAddPhoto={vi.fn()} />
  );

  expect(container.querySelector('[data-testid="CheckCircleIcon"]')).toBeInTheDocument();
});

it('sets the drag payload and effect on dragstart, for dropping onto the canvas', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  const tile = screen.getByRole('img', { name: 'Beach' }).closest('[draggable="true"]')!;
  const dataTransfer = { setData: vi.fn(), effectAllowed: '' };

  fireEvent.dragStart(tile, { dataTransfer });

  expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-collage-photo', 'p1');
  expect(dataTransfer.effectAllowed).toBe('copy');
});

it('shows the empty-state message when there are no photos', () => {
  render(<CollagePhotoTray photos={[]} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByText(/no photos in the source albums yet/i)).toBeInTheDocument();
});

describe('tag filtering', () => {
  const tagged: AlbumPhoto[] = [
    {
      _id: 'p1',
      filename: 'a.jpg',
      title: 'Beach day',
      thumbnailSignedUrl: 'https://cdn.example/a.jpg',
      tags: ['beach', 'summer']
    },
    {
      _id: 'p2',
      filename: 'b.jpg',
      title: 'Sunset',
      thumbnailSignedUrl: 'https://cdn.example/b.jpg',
      tags: ['sunset', 'summer']
    },
    { _id: 'p3', filename: 'c.jpg', title: 'Indoors', thumbnailSignedUrl: 'https://cdn.example/c.jpg', tags: [] }
  ];

  it('shows no filter row when none of the photos are tagged', () => {
    render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

    expect(screen.queryByText(/filter by tag/i)).not.toBeInTheDocument();
  });

  it('lists each tag with its count, most used first', () => {
    render(<CollagePhotoTray photos={tagged} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

    expect(screen.getByText('summer 2')).toBeInTheDocument();
    expect(screen.getByText('beach 1')).toBeInTheDocument();
  });

  it('narrows the tray to photos carrying the selected tag', async () => {
    render(<CollagePhotoTray photos={tagged} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

    await userEvent.click(screen.getByText('beach 1'));

    expect(screen.getByText(/photos \(1 of 3\)/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Beach day' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Indoors' })).not.toBeInTheDocument();
  });

  it('requires every selected tag by default and any after toggling', async () => {
    render(<CollagePhotoTray photos={tagged} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

    await userEvent.click(screen.getByText('beach 1'));
    await userEvent.click(screen.getByText('sunset 1'));
    // No photo carries both tags.
    expect(screen.getByText(/no photos match the selected tags/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /match all/i }));

    expect(screen.getByText(/photos \(2 of 3\)/i)).toBeInTheDocument();
  });

  it('clears the tag selection', async () => {
    render(<CollagePhotoTray photos={tagged} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

    await userEvent.click(screen.getByText('beach 1'));
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));

    expect(screen.getByText(/photos \(3\)/i)).toBeInTheDocument();
  });

  it("surfaces a photo's tags in its tooltip", async () => {
    render(<CollagePhotoTray photos={tagged} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

    await userEvent.hover(screen.getByRole('img', { name: 'Beach day' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Beach day — beach, summer');
  });
});

describe('as a strip under the canvas', () => {
  it('lays the photos out in one row that scrolls sideways, and says to tap', async () => {
    const onAddPhoto = vi.fn();
    render(
      <CollagePhotoTray
        layout="bottom"
        photos={[{ _id: 'p1', filename: 'a.jpg', thumbnailSignedUrl: 'https://cdn.example/a.jpg' }]}
        usedPhotoIds={new Set()}
        onAddPhoto={onAddPhoto}
      />
    );

    expect(screen.getByText(/tap to add/)).toBeInTheDocument();
    await userEvent.click(screen.getByAltText('a.jpg'));
    expect(onAddPhoto).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }));
  });
});

describe('videos', () => {
  it('shows a video by its still, marked as a video', () => {
    render(
      <CollagePhotoTray
        photos={[
          {
            _id: 'v1',
            filename: 'clip.mp4',
            mimetype: 'video/mp4',
            signedUrl: 'https://cdn.example/clip.mp4',
            thumbnailSignedUrl: 'https://cdn.example/clip.mp4',
            posterSignedUrl: 'https://cdn.example/clip.jpg'
          }
        ]}
        usedPhotoIds={new Set()}
        onAddPhoto={vi.fn()}
      />
    );

    expect(screen.getByRole('img', { name: 'clip.mp4' })).toHaveAttribute('src', 'https://cdn.example/clip.jpg');
    expect(screen.getByLabelText('Video')).toBeInTheDocument();
  });

  it('falls back to the video’s own first frame when it has no still', () => {
    const { container } = render(
      <CollagePhotoTray
        photos={[{ _id: 'v1', filename: 'clip.mp4', mimetype: 'video/mp4', signedUrl: 'https://cdn.example/clip.mp4' }]}
        usedPhotoIds={new Set()}
        onAddPhoto={vi.fn()}
      />
    );

    expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn.example/clip.mp4#t=0.1');
  });
});
