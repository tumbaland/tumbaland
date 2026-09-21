import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// The composer's emoji button opens the full picker, whose real package
// registers a custom element and opens an IndexedDB.
vi.mock('./FullEmojiPicker', () => ({
  loadEmojiPicker: () => Promise.resolve(),
  FullEmojiPicker: ({
    anchorEl,
    onPick
  }: {
    anchorEl: HTMLElement | null;
    onPick: (emoji: string) => void;
  }) =>
    anchorEl ? (
      <button type="button" aria-label="❤️" onClick={() => onPick('❤️')}>
        pick
      </button>
    ) : null
}));

import { Composer } from './Composer';
import type { PendingUpload } from '../../types';

/** Drives the `(hover: none)` query the composer uses to tell phone from desktop. */
function setPointer(isPhone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('hover: none') ? isPhone : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => setPointer(false));

describe('sending', () => {
  it('sends on the button', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), 'hei');
    await userEvent.click(screen.getByLabelText('Send'));

    expect(onSend).toHaveBeenCalledWith('hei');
  });

  it('clears the box after sending', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);
    const input = screen.getByLabelText('Message');

    await userEvent.type(input, 'hei');
    await userEvent.click(screen.getByLabelText('Send'));

    expect(input).toHaveValue('');
  });

  it('will not send an empty or whitespace-only message', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), '   ');
    expect(screen.getByLabelText('Send')).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('trims the message', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), '  hei  ');
    await userEvent.click(screen.getByLabelText('Send'));

    expect(onSend).toHaveBeenCalledWith('hei');
  });
});

describe('the Enter key', () => {
  it('sends on a desktop keyboard', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), 'hei{Enter}');

    expect(onSend).toHaveBeenCalledWith('hei');
  });

  it('inserts a newline with Shift held', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), 'hei{Shift>}{Enter}{/Shift}there');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send on a phone, where Enter is the newline key', async () => {
    // Getting this the wrong way round means every message on a phone sends
    // half-written.
    setPointer(true);
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), 'hei{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('typing notices', () => {
  it('reports typing as the user types', async () => {
    const onTyping = vi.fn();
    render(<Composer onSend={() => {}} onTyping={onTyping} />);

    await userEvent.type(screen.getByLabelText('Message'), 'hei');

    expect(onTyping).toHaveBeenCalled();
  });
});

describe('disabled', () => {
  it('cannot send while disabled', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} disabled />);

    expect(screen.getByLabelText('Send')).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });
});

const upload = (overrides: Partial<PendingUpload> = {}): PendingUpload => ({
  id: 'u1',
  name: 'holiday.jpg',
  mimetype: 'image/jpeg',
  previewUrl: 'blob:preview',
  progress: 100,
  status: 'done',
  attachment: { fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 100 },
  ...overrides
});

describe('attachments', () => {
  it('offers no attach button when the composer has uploads turned off', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);

    expect(screen.queryByLabelText('Add photo or video')).not.toBeInTheDocument();
  });

  it('offers a picker and a camera button when uploads are on', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

    expect(screen.getByLabelText('Add photo or video')).toBeInTheDocument();
    expect(screen.getByLabelText('Take a photo')).toBeInTheDocument();
  });

  it('accepts only images and video', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

    expect(screen.getByTestId('file-input')).toHaveAttribute('accept', 'image/*,video/*');
  });

  it('sends the camera straight to the camera, and the picker to the library', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

    // One input with `capture` would hide the photo library entirely.
    expect(screen.getByTestId('camera-input')).toHaveAttribute('capture', 'environment');
    expect(screen.getByTestId('file-input')).not.toHaveAttribute('capture');
  });

  it('hands picked files to the caller', async () => {
    const onAddFiles = vi.fn();
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={onAddFiles} onRemoveUpload={() => {}} />);

    await userEvent.upload(screen.getByTestId('file-input'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    expect(onAddFiles).toHaveBeenCalled();
  });

  it('sends a message with attachments and no text', async () => {
    const onSend = vi.fn();
    render(
      <Composer
        onSend={onSend}
        onTyping={() => {}}
        uploads={[upload()]}
        onAddFiles={() => {}}
        onRemoveUpload={() => {}}
      />
    );

    await userEvent.click(screen.getByLabelText('Send'));

    expect(onSend).toHaveBeenCalledWith('');
  });

  it('will not send while an upload is still in flight', () => {
    // The bytes might not be there when the other person opens it.
    render(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        uploads={[upload({ status: 'uploading' })]}
        onAddFiles={() => {}}
        onRemoveUpload={() => {}}
        uploading
      />
    );

    expect(screen.getByLabelText('Send')).toBeDisabled();
  });

  it('will not send when every attachment failed and there is no text', () => {
    render(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        uploads={[upload({ status: 'failed', attachment: undefined })]}
        onAddFiles={() => {}}
        onRemoveUpload={() => {}}
      />
    );

    expect(screen.getByLabelText('Send')).toBeDisabled();
  });

  it('shows the tray while files are attached', () => {
    render(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        uploads={[upload()]}
        onAddFiles={() => {}}
        onRemoveUpload={() => {}}
      />
    );

    expect(screen.getByRole('list', { name: 'Attachments to send' })).toBeInTheDocument();
  });

  it('accepts a dropped file', () => {
    const onAddFiles = vi.fn();
    const { container } = render(
      <Composer onSend={() => {}} onTyping={() => {}} onAddFiles={onAddFiles} onRemoveUpload={() => {}} />
    );

    const file = new File(['x'], 'dropped.png', { type: 'image/png' });
    fireEvent.drop(container.querySelector('form')!, { dataTransfer: { files: [file] } });

    expect(onAddFiles).toHaveBeenCalled();
  });

  it('ignores a drop carrying no files', () => {
    const onAddFiles = vi.fn();
    const { container } = render(
      <Composer onSend={() => {}} onTyping={() => {}} onAddFiles={onAddFiles} onRemoveUpload={() => {}} />
    );

    fireEvent.drop(container.querySelector('form')!, { dataTransfer: { files: [] } });

    expect(onAddFiles).not.toHaveBeenCalled();
  });

  it('ignores a paste with no files, so ordinary text still pastes', () => {
    const onAddFiles = vi.fn();
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={onAddFiles} onRemoveUpload={() => {}} />);

    fireEvent.paste(screen.getByLabelText('Message'), { clipboardData: { files: [] } });

    expect(onAddFiles).not.toHaveBeenCalled();
  });

  it('takes a photo straight from the camera', async () => {
    const onAddFiles = vi.fn();
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={onAddFiles} onRemoveUpload={() => {}} />);

    await userEvent.upload(screen.getByTestId('camera-input'), new File(['x'], 'shot.jpg', { type: 'image/jpeg' }));

    expect(onAddFiles).toHaveBeenCalled();
  });

  it('inserts an emoji picked from the full picker', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);
    const input = screen.getByLabelText('Message');

    await userEvent.type(input, 'hei ');
    await userEvent.click(screen.getByLabelText('Add emoji'));
    await userEvent.click(screen.getByRole('button', { name: '❤️' }));

    expect(input).toHaveValue('hei ❤️');
  });

  it('accepts a pasted image, which is how this is used on a desktop', async () => {
    const onAddFiles = vi.fn();
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={onAddFiles} onRemoveUpload={() => {}} />);

    const file = new File(['x'], 'pasted.png', { type: 'image/png' });
    fireEvent.paste(screen.getByLabelText('Message'), { clipboardData: { files: [file] } });

    expect(onAddFiles).toHaveBeenCalledWith([file]);
  });
});
