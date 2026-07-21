import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoCard from './PhotoCard';
import { makePhoto } from '../test/fixtures';

it('renders the thumbnail image with alt text', () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg', title: 'Sunset' });
  render(<PhotoCard photo={photo} onView={vi.fn()} />);

  const img = screen.getByRole('img') as HTMLImageElement;
  expect(img.src).toContain('/thumb.jpg');
  expect(img.alt).toBe('Sunset');
});

it('falls back to originalName when there is no title', () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg', title: undefined, originalName: 'IMG_001.jpg' });
  render(<PhotoCard photo={photo} onView={vi.fn()} />);
  expect(screen.getByText('IMG_001.jpg')).toBeInTheDocument();
});

it('shows a placeholder icon when there is no thumbnail or full image', () => {
  const photo = makePhoto({ thumbnailUrl: undefined, signedUrl: undefined });
  render(<PhotoCard photo={photo} onView={vi.fn()} />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('shows the file size and resolution caption', () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg', size: 123456, width: 1920, height: 1080 });
  render(<PhotoCard photo={photo} onView={vi.fn()} />);
  expect(screen.getByText('120.56 KB • 1920×1080')).toBeInTheDocument();
});

it('shows up to 2 tags plus a "+N" overflow chip', () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg', tags: ['a', 'b', 'c', 'd'] });
  render(<PhotoCard photo={photo} onView={vi.fn()} />);
  expect(screen.getByText('a')).toBeInTheDocument();
  expect(screen.getByText('b')).toBeInTheDocument();
  expect(screen.queryByText('c')).not.toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
});

it('shows the Cover badge when isCoverPhoto is set', () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg' });
  render(<PhotoCard photo={photo} onView={vi.fn()} isCoverPhoto />);
  expect(screen.getByText('Cover')).toBeInTheDocument();
});

it('calls onView when the card is clicked outside select mode', async () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg', title: 'Sunset' });
  const onView = vi.fn();
  render(<PhotoCard photo={photo} onView={onView} />);

  await userEvent.click(screen.getByText('Sunset'));
  expect(onView).toHaveBeenCalledWith(photo);
});

it('opens the actions menu and fires edit/delete/set-cover/view-details', async () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg' });
  const onView = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onSetCover = vi.fn();
  const onViewDetails = vi.fn();
  render(
    <PhotoCard
      photo={photo}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      onSetCover={onSetCover}
      onViewDetails={onViewDetails}
    />
  );

  await userEvent.click(screen.getByRole('button'));
  // Opening the menu shouldn't also trigger the card's own onView.
  expect(onView).not.toHaveBeenCalled();

  expect(screen.getByText('View Details')).toBeInTheDocument();
  expect(screen.getByText('Set as Cover Photo')).toBeInTheDocument();
  expect(screen.getByText('Edit Photo')).toBeInTheDocument();
  expect(screen.getByText('Delete Photo')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Edit Photo'));
  expect(onEdit).toHaveBeenCalledWith(photo);
});

it('hides "Set as Cover Photo" when the photo is already the cover', async () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg' });
  render(<PhotoCard photo={photo} onView={vi.fn()} onSetCover={vi.fn()} isCoverPhoto />);

  await userEvent.click(screen.getByRole('button'));
  expect(screen.queryByText('Set as Cover Photo')).not.toBeInTheDocument();
});

it('in select mode, clicking the card toggles selection instead of opening the viewer', async () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg', title: 'Sunset' });
  const onView = vi.fn();
  const onToggleSelect = vi.fn();
  render(<PhotoCard photo={photo} onView={onView} selectMode onToggleSelect={onToggleSelect} />);

  await userEvent.click(screen.getByText('Sunset'));

  expect(onToggleSelect).toHaveBeenCalledWith(photo);
  expect(onView).not.toHaveBeenCalled();
});

it('hides the actions menu button in select mode', () => {
  const photo = makePhoto({ thumbnailUrl: '/thumb.jpg' });
  render(<PhotoCard photo={photo} onView={vi.fn()} onEdit={vi.fn()} selectMode />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
