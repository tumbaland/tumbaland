import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadTray } from './UploadTray';
import type { PendingUpload } from '../../types';

const upload = (overrides: Partial<PendingUpload> = {}): PendingUpload => ({
  id: 'u1',
  name: 'holiday.jpg',
  mimetype: 'image/jpeg',
  previewUrl: 'blob:preview',
  progress: 0,
  status: 'uploading',
  ...overrides
});

describe('UploadTray', () => {
  it('shows a tile per file', () => {
    render(<UploadTray uploads={[upload(), upload({ id: 'u2' })]} onRemove={() => {}} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('previews an image from the local object URL, so it appears before any round trip', () => {
    const { container } = render(<UploadTray uploads={[upload()]} onRemove={() => {}} />);

    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:preview');
  });

  it('previews a video as a video element, not a broken image', () => {
    const { container } = render(
      <UploadTray uploads={[upload({ mimetype: 'video/mp4', name: 'clip.mp4' })]} onRemove={() => {}} />
    );

    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows determinate progress while bytes are moving', () => {
    render(<UploadTray uploads={[upload({ status: 'uploading', progress: 40 })]} onRemove={() => {}} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('shows indeterminate progress while preparing, when there is no byte count yet', () => {
    render(<UploadTray uploads={[upload({ status: 'preparing' })]} onRemove={() => {}} />);

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('shows no progress bar once an upload is done', () => {
    render(<UploadTray uploads={[upload({ status: 'done', progress: 100 })]} onRemove={() => {}} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('marks a failed upload and says it will not be sent', () => {
    render(<UploadTray uploads={[upload({ status: 'failed', error: 'Too large' })]} onRemove={() => {}} />);

    expect(screen.getByText(/Failed uploads are not sent/)).toBeInTheDocument();
  });

  it('says nothing about failures when everything is fine', () => {
    render(<UploadTray uploads={[upload({ status: 'done' })]} onRemove={() => {}} />);

    expect(screen.queryByText(/Failed uploads/)).not.toBeInTheDocument();
  });

  it('removes a file by name', async () => {
    const onRemove = vi.fn();
    render(<UploadTray uploads={[upload()]} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove holiday.jpg' }));

    expect(onRemove).toHaveBeenCalledWith('u1');
  });
});
