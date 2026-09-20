import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoDetailHeader from './PhotoDetailHeader';
import { makeAlbum, makePhoto } from '../../test/fixtures';

const photo = makePhoto({ title: 'Sunset', originalName: 'IMG_001.jpg' });
const album = makeAlbum({ _id: 'album-42', name: 'Vacation' });

function baseProps(overrides: Partial<React.ComponentProps<typeof PhotoDetailHeader>> = {}) {
  return {
    photo,
    album,
    onNavigate: vi.fn(),
    onDownload: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides
  };
}

it('shows the photo title and album name in the breadcrumb and header', () => {
  render(<PhotoDetailHeader {...baseProps()} />);
  expect(screen.getByText('Vacation')).toBeInTheDocument();
  expect(screen.getAllByText('Sunset').length).toBeGreaterThan(0);
});

it('falls back to originalName when there is no title', () => {
  render(<PhotoDetailHeader {...baseProps({ photo: makePhoto({ title: undefined, originalName: 'IMG_002.jpg' }) })} />);
  expect(screen.getAllByText('IMG_002.jpg').length).toBeGreaterThan(0);
});

it('navigates to the albums list and the album page from the breadcrumb', async () => {
  const onNavigate = vi.fn();
  render(<PhotoDetailHeader {...baseProps({ onNavigate })} />);

  await userEvent.click(screen.getByText('Albums'));
  expect(onNavigate).toHaveBeenCalledWith('/album/albums');

  await userEvent.click(screen.getByText('Vacation'));
  expect(onNavigate).toHaveBeenCalledWith('/album/albums/album-42');
});

it('calls onDownload, onEdit, and onDelete from their buttons', async () => {
  const onDownload = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(<PhotoDetailHeader {...baseProps({ onDownload, onEdit, onDelete })} />);

  await userEvent.click(screen.getByRole('button', { name: 'Download' }));
  expect(onDownload).toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(onEdit).toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onDelete).toHaveBeenCalled();
});

it('does not show prev/next controls when neither handler is provided', () => {
  render(<PhotoDetailHeader {...baseProps()} />);
  expect(screen.queryByLabelText('Previous photo')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Next photo')).not.toBeInTheDocument();
});

it('shows prev/next controls, respecting hasPrevious/hasNext, and the position label', async () => {
  const onPrevious = vi.fn();
  const onNext = vi.fn();
  render(
    <PhotoDetailHeader
      {...baseProps({ onPrevious, onNext, hasPrevious: false, hasNext: true, photoPosition: { index: 1, total: 5 } })}
    />
  );

  expect(screen.getByLabelText('Previous photo')).toBeDisabled();
  expect(screen.getByLabelText('Next photo')).not.toBeDisabled();
  expect(screen.getByText('1 of 5')).toBeInTheDocument();

  await userEvent.click(screen.getByLabelText('Next photo'));
  expect(onNext).toHaveBeenCalled();
});
