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

/** Photo and emoji sit behind the arrow until it is tapped. */
const openTools = () => fireEvent.click(screen.getByLabelText('Show photo and emoji'));

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

    openTools();
    expect(screen.queryByLabelText('Add photo or video')).not.toBeInTheDocument();
  });

  it('keeps photo and emoji behind the arrow until it is tapped', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

    expect(screen.queryByLabelText('Add photo or video')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add emoji')).not.toBeInTheDocument();

    openTools();
    expect(screen.getByLabelText('Hide photo and emoji')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Add emoji')).toBeInTheDocument();
  });

  it('folds the tools away again after sending', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);
    openTools();

    await userEvent.type(screen.getByLabelText('Message'), 'hei');
    await userEvent.click(screen.getByLabelText('Send'));

    expect(screen.queryByLabelText('Add emoji')).not.toBeInTheDocument();
  });

  it('offers one picker button when uploads are on', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);
    openTools();

    expect(screen.getByLabelText('Add photo or video')).toBeInTheDocument();
    expect(screen.queryByLabelText('Take a photo')).not.toBeInTheDocument();
  });

  it('accepts only images and video', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

    expect(screen.getByTestId('file-input')).toHaveAttribute('accept', 'image/*,video/*');
  });

  it('opens the library rather than going straight to the camera', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

    // `capture` would hide the photo library entirely; without it the system
    // picker offers the camera and the library side by side.
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

    expect(onSend).toHaveBeenCalledWith('', { skipAlbum: false });
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

  it('inserts an emoji picked from the full picker', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);
    const input = screen.getByLabelText('Message');

    await userEvent.type(input, 'hei ');
    openTools();
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

describe('editing', () => {
  const editing = { id: 'm1', body: 'teh plan', hasMedia: false };

  it('fills the box with the message and saves the change', async () => {
    const onSaveEdit = vi.fn();
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} editing={editing} onSaveEdit={onSaveEdit} onCancelEdit={() => {}} />);

    const box = screen.getByLabelText('Message');
    expect(box).toHaveValue('teh plan');
    expect(screen.getByText('Editing message')).toBeInTheDocument();

    await userEvent.clear(box);
    await userEvent.type(box, 'the plan');
    await userEvent.click(screen.getByLabelText('Save edit'));

    expect(onSaveEdit).toHaveBeenCalledWith('the plan');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('treats saving an unchanged message as a cancel, so it is not marked edited', async () => {
    const onSaveEdit = vi.fn();
    const onCancelEdit = vi.fn();
    render(<Composer onSend={() => {}} onTyping={() => {}} editing={editing} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit} />);

    await userEvent.click(screen.getByLabelText('Save edit'));

    expect(onSaveEdit).not.toHaveBeenCalled();
    expect(onCancelEdit).toHaveBeenCalled();
  });

  it('cancels on Escape', async () => {
    const onCancelEdit = vi.fn();
    render(<Composer onSend={() => {}} onTyping={() => {}} editing={editing} onCancelEdit={onCancelEdit} />);

    await userEvent.type(screen.getByLabelText('Message'), '{Escape}');

    expect(onCancelEdit).toHaveBeenCalled();
  });

  it('will not empty a text message', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} editing={editing} onSaveEdit={() => {}} onCancelEdit={() => {}} />);

    await userEvent.clear(screen.getByLabelText('Message'));

    expect(screen.getByLabelText('Save edit')).toBeDisabled();
  });

  it('gives back what was being typed once the edit is over', async () => {
    const props = { onSend: () => {}, onTyping: () => {}, onSaveEdit: () => {}, onCancelEdit: () => {} };
    const { rerender } = render(<Composer {...props} />);
    await userEvent.type(screen.getByLabelText('Message'), 'half a thought');

    rerender(<Composer {...props} editing={editing} />);
    expect(screen.getByLabelText('Message')).toHaveValue('teh plan');

    rerender(<Composer {...props} editing={null} />);
    expect(screen.getByLabelText('Message')).toHaveValue('half a thought');
  });
});

describe('saving to Album', () => {
  const album = (mode: 'unset' | 'album' | 'off') => ({
    mode,
    albumId: mode === 'album' ? 'a-rome' : null,
    albumName: mode === 'album' ? 'Rome' : null
  });
  const doneUpload = (): PendingUpload => ({
    id: 'u1',
    name: 'a.jpg',
    mimetype: 'image/jpeg',
    previewUrl: 'blob:x',
    progress: 100,
    status: 'done',
    attachment: { fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1 }
  });
  const renderWith = (mode: 'unset' | 'album' | 'off', props: Record<string, unknown> = {}) =>
    render(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        uploads={[doneUpload()]}
        onAddFiles={() => {}}
        onRemoveUpload={() => {}}
        photoAlbum={album(mode)}
        onChooseAlbum={() => {}}
        onAlbumOff={() => {}}
        {...props}
      />
    );

  it('asks where photos go the first time, and can turn saving off', async () => {
    const onChooseAlbum = vi.fn();
    const onAlbumOff = vi.fn();
    renderWith('unset', { onChooseAlbum, onAlbumOff });

    expect(screen.getByText('Where should chat photos go?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose album' }));
    await userEvent.click(screen.getByRole('button', { name: "Don't save" }));

    expect(onChooseAlbum).toHaveBeenCalled();
    expect(onAlbumOff).toHaveBeenCalled();
  });

  it('says where the photos are going, and changing it opens the picker', async () => {
    const onChooseAlbum = vi.fn();
    renderWith('album', { onChooseAlbum });

    await userEvent.click(screen.getByRole('button', { name: 'Adding to Rome. Change album' }));

    expect(onChooseAlbum).toHaveBeenCalled();
  });

  it('leaves one send out with "Not this one", then forgets it', async () => {
    const onSend = vi.fn();
    renderWith('album', { onSend });

    await userEvent.click(screen.getByRole('button', { name: 'Not this one' }));
    await userEvent.click(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenLastCalledWith('', { skipAlbum: true });

    expect(screen.getByRole('button', { name: 'Not this one' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows nothing about albums without photos on the tray', () => {
    render(
      <Composer onSend={() => {}} onTyping={() => {}} photoAlbum={album('unset')} onChooseAlbum={() => {}} onAlbumOff={() => {}} />
    );
    expect(screen.queryByText('Where should chat photos go?')).not.toBeInTheDocument();
  });
});
