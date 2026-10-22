import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceNote } from './VoiceNote';
import type { Attachment } from '../../types';

const voice = (overrides: Partial<Attachment> = {}): Attachment => ({
  fileId: 'chat/g1/c1/u/original.m4a',
  mimetype: 'audio/mp4',
  sizeBytes: 1000,
  durationMs: 12_000,
  url: 'https://files.test/voice.m4a',
  ...overrides
});

// jsdom has no media playback. A play that resolves fires `play`, as a browser would.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: false, configurable: true });
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: true, configurable: true });
    this.dispatchEvent(new Event('pause'));
  });
});

describe('VoiceNote', () => {
  it('shows the recorded length before it is played', () => {
    render(<VoiceNote attachment={voice()} mine={false} />);
    expect(screen.getByText('0:12')).toBeInTheDocument();
  });

  it('plays and pauses from the one button', async () => {
    render(<VoiceNote attachment={voice()} mine={false} />);

    await userEvent.click(screen.getByLabelText('Play voice message'));
    expect(screen.getByLabelText('Pause voice message')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Pause voice message'));
    expect(screen.getByLabelText('Play voice message')).toBeInTheDocument();
  });

  it('stops the one playing when another starts', async () => {
    render(
      <>
        <VoiceNote attachment={voice()} mine={false} />
        <VoiceNote attachment={voice({ fileId: 'other', url: 'https://files.test/other.m4a' })} mine />
      </>
    );
    const [first, second] = screen.getAllByLabelText('Play voice message');

    await userEvent.click(first!);
    await userEvent.click(second!);

    expect(screen.getAllByLabelText('Play voice message')).toHaveLength(1);
    expect(screen.getAllByLabelText('Pause voice message')).toHaveLength(1);
  });

  it('says so when the browser cannot play it', () => {
    const { container } = render(<VoiceNote attachment={voice()} mine={false} />);
    fireEvent.error(container.querySelector('audio')!);

    expect(screen.getByText('Cannot play this here')).toBeInTheDocument();
    expect(screen.getByLabelText('Play voice message')).toBeDisabled();
  });

  it('cannot be played without a link', () => {
    render(<VoiceNote attachment={voice({ url: null })} mine={false} />);
    expect(screen.getByLabelText('Play voice message')).toBeDisabled();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('keeps playing when the message is updated with a fresh link', () => {
    const { container, rerender } = render(<VoiceNote attachment={voice()} mine={false} />);

    rerender(<VoiceNote attachment={voice({ url: 'https://files.test/voice.m4a?fresh' })} mine={false} />);

    expect(container.querySelector('audio')).toHaveAttribute('src', 'https://files.test/voice.m4a');
  });

  it('moves to the fresh link once the old one stops working', () => {
    const { container, rerender } = render(<VoiceNote attachment={voice()} mine={false} />);
    rerender(<VoiceNote attachment={voice({ url: 'https://files.test/voice.m4a?fresh' })} mine={false} />);

    fireEvent.error(container.querySelector('audio')!);

    expect(container.querySelector('audio')).toHaveAttribute('src', 'https://files.test/voice.m4a?fresh');
    expect(screen.queryByText('Cannot play this here')).not.toBeInTheDocument();
  });

  it('steps through playback speeds once it has started', async () => {
    const { container } = render(<VoiceNote attachment={voice()} mine={false} />);
    expect(screen.queryByLabelText(/Playback speed/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Play voice message'));
    await userEvent.click(screen.getByLabelText('Playback speed 1×'));

    expect(screen.getByLabelText('Playback speed 1.5×')).toBeInTheDocument();
    expect(container.querySelector('audio')!.playbackRate).toBe(1.5);
  });

  it('shows the length, not a complaint, while it is still sending', () => {
    render(<VoiceNote attachment={voice({ url: undefined })} mine />);

    expect(screen.getByText('0:12')).toBeInTheDocument();
    expect(screen.getByLabelText('Play voice message')).toBeDisabled();
  });

  it('follows the playback, and goes back to the start at the end', () => {
    const { container } = render(<VoiceNote attachment={voice()} mine={false} />);
    const audio = container.querySelector('audio')!;

    Object.defineProperty(audio, 'currentTime', { value: 5, configurable: true, writable: true });
    fireEvent.timeUpdate(audio);
    expect(screen.getByText('0:05')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '0:05 of 0:12');

    fireEvent.ended(audio);
    expect(screen.getByText('0:12')).toBeInTheDocument();
  });

  it('jumps to where the position bar is moved', () => {
    const { container } = render(<VoiceNote attachment={voice()} mine={false} />);
    const audio = container.querySelector('audio')!;
    Object.defineProperty(audio, 'currentTime', { value: 0, configurable: true, writable: true });

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });

    expect(audio.currentTime).toBe(12);
  });

  it('takes the length from the file when the message has none', () => {
    const { container } = render(<VoiceNote attachment={voice({ durationMs: null })} mine={false} />);
    const audio = container.querySelector('audio')!;

    Object.defineProperty(audio, 'duration', { value: 9, configurable: true });
    fireEvent.loadedMetadata(audio);

    expect(screen.getByText('0:09')).toBeInTheDocument();
  });
});
