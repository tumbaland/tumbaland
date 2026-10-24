import { afterEach, describe, expect, it, vi, beforeEach } from 'vite-plus/test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// The composer's emoji button opens the full picker, whose real package
// registers a custom element and opens an IndexedDB.
vi.mock('./FullEmojiPicker', () => ({
  loadEmojiPicker: () => Promise.resolve(),
  FullEmojiPicker: ({ anchorEl, onPick }: { anchorEl: HTMLElement | null; onPick: (emoji: string) => void }) =>
    anchorEl ? (
      <button type="button" aria-label="❤️" onClick={() => onPick('❤️')}>
        pick
      </button>
    ) : null
}));

import { Composer } from './Composer';
import { resetRecentEmojiCache } from './recentEmoji';
import { useVoiceMessage, type SendVoice } from '../../hooks/useVoiceMessage';
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

  it('shows the photo and emoji buttons straight away, with no arrow to open first', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

    expect(screen.getByLabelText('Add photo or video')).toBeInTheDocument();
    expect(screen.getByLabelText('Add emoji')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show photo and emoji')).not.toBeInTheDocument();
  });

  it('keeps the emoji button inside the message box', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);

    const box = screen.getByLabelText('Message').closest('.MuiInputBase-root');
    expect(box).toContainElement(screen.getByLabelText('Add emoji'));
  });

  it('offers one picker button when uploads are on', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} onAddFiles={() => {}} onRemoveUpload={() => {}} />);

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
    render(
      <Composer onSend={onSend} onTyping={() => {}} editing={editing} onSaveEdit={onSaveEdit} onCancelEdit={() => {}} />
    );

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
    render(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        editing={editing}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
      />
    );

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
    render(
      <Composer onSend={() => {}} onTyping={() => {}} editing={editing} onSaveEdit={() => {}} onCancelEdit={() => {}} />
    );

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

  const twoPhotos = [
    doneUpload(),
    { ...doneUpload(), id: 'u2', name: 'sunset.jpg', attachment: { fileId: 'f2', mimetype: 'image/jpeg', sizeBytes: 1 } }
  ];

  it('leaves out only the photos unticked on the tray', async () => {
    const onSend = vi.fn();
    renderWith('album', { onSend, uploads: twoPhotos });

    await userEvent.click(screen.getByRole('button', { name: 'Add sunset.jpg to Rome' }));

    expect(screen.getByRole('button', { name: 'Adding 1 of 2 to Rome. Change album' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add sunset.jpg to Rome' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenLastCalledWith('', { skipAlbum: false, skipAlbumFileIds: ['f2'] });
  });

  it('counts unticking every photo as "Not this one"', async () => {
    const onSend = vi.fn();
    renderWith('album', { onSend, uploads: twoPhotos });

    await userEvent.click(screen.getByRole('button', { name: 'Add a.jpg to Rome' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add sunset.jpg to Rome' }));

    expect(screen.getByRole('button', { name: 'Not this one' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenLastCalledWith('', { skipAlbum: true });
  });

  it('puts every photo back with "Not this one" once they are all out', async () => {
    renderWith('album', { uploads: twoPhotos });

    await userEvent.click(screen.getByRole('button', { name: 'Not this one' }));
    expect(screen.getByRole('button', { name: 'Add sunset.jpg to Rome' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Not this one' }));
    expect(screen.getByRole('button', { name: 'Add sunset.jpg to Rome' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers no per-photo switch when photos are not being saved', () => {
    renderWith('off', { uploads: twoPhotos });
    expect(screen.queryByRole('button', { name: /to Rome/ })).not.toBeInTheDocument();
  });

  it('shows nothing about albums without photos on the tray', () => {
    render(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        photoAlbum={album('unset')}
        onChooseAlbum={() => {}}
        onAlbumOff={() => {}}
      />
    );
    expect(screen.queryByText('Where should chat photos go?')).not.toBeInTheDocument();
  });
});

describe('recent emoji', () => {
  beforeEach(() => {
    window.localStorage.removeItem('tumbaland-chat-recent-emoji');
    resetRecentEmojiCache();
  });

  it('stays out of the way on a phone while the thread is being read', () => {
    setPointer(true);
    render(<Composer onSend={() => {}} onTyping={() => {}} />);
    expect(screen.queryByRole('group', { name: 'Recent emoji' })).not.toBeInTheDocument();
  });

  it('shows a row of them on a phone once the message box is in use', async () => {
    setPointer(true);
    render(<Composer onSend={() => {}} onTyping={() => {}} />);

    await userEvent.click(screen.getByLabelText('Message'));

    expect(screen.getByRole('group', { name: 'Recent emoji' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add ❤️' })).toBeInTheDocument();
  });

  it('keeps the row in place on a desktop, so focusing the box does not move the thread', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);
    expect(screen.getByRole('group', { name: 'Recent emoji' })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Message'));
    await userEvent.tab();

    expect(screen.getByRole('group', { name: 'Recent emoji' })).toBeInTheDocument();
  });

  it('adds one where the cursor is, not at the end', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);
    const input = screen.getByLabelText('Message') as HTMLTextAreaElement;

    await userEvent.type(input, 'see you tonight');
    input.setSelectionRange(8, 8);
    await userEvent.click(screen.getByRole('button', { name: 'Add 🔥' }));

    expect(input).toHaveValue('see you 🔥tonight');
  });

  it('learns the emoji in a sent message, keyboard ones included', async () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} />);
    const input = screen.getByLabelText('Message');

    await userEvent.type(input, 'yay 🦄');
    await userEvent.click(screen.getByLabelText('Send'));
    await userEvent.click(input);

    const row = screen.getByRole('group', { name: 'Recent emoji' });
    expect(row.firstElementChild).toHaveAccessibleName('Add 🦄');
  });
});

describe('send with an effect', () => {
  it('offers hearts, confetti and kisses on a right-click of Send', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), 'miss you');
    fireEvent.contextMenu(screen.getByLabelText('Send'));
    await userEvent.click(screen.getByRole('menuitem', { name: /Send with hearts/ }));

    expect(onSend).toHaveBeenCalledWith('miss you', { effect: 'hearts' });
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('offers them when Send is held, without sending on letting go', async () => {
    vi.useFakeTimers();
    try {
      const onSend = vi.fn();
      render(<Composer onSend={onSend} onTyping={() => {}} />);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'yay' } });
      const send = screen.getByLabelText('Send');

      fireEvent.pointerDown(send, { button: 0 });
      void act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(send);
      fireEvent.click(send);

      expect(onSend).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('menuitem', { name: /Send with confetti/ }));
      expect(onSend).toHaveBeenCalledWith('yay', { effect: 'confetti' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('still sends plainly on a tap', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} />);

    await userEvent.type(screen.getByLabelText('Message'), 'hei');
    await userEvent.click(screen.getByLabelText('Send'));

    expect(onSend).toHaveBeenCalledWith('hei');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers no effects while editing a message', () => {
    render(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        editing={{ id: 'm1', body: 'hello', hasMedia: false }}
        onSaveEdit={() => {}}
        onCancelEdit={() => {}}
      />
    );

    fireEvent.contextMenu(screen.getByLabelText('Save edit'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('a share from another app', () => {
  it('puts the shared link in the box for the person to send', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={() => {}} prefill={{ text: 'https://youtu.be/abc', key: 1 }} />);

    expect(screen.getByLabelText('Message')).toHaveValue('https://youtu.be/abc');
    expect(onSend).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenCalledWith('https://youtu.be/abc');
  });

  it('fills the box again when the same link is shared a second time', async () => {
    const props = { onSend: () => {}, onTyping: () => {} };
    const { rerender } = render(<Composer {...props} prefill={{ text: 'https://youtu.be/abc', key: 1 }} />);
    const input = screen.getByLabelText('Message');
    await userEvent.clear(input);

    rerender(<Composer {...props} prefill={{ text: 'https://youtu.be/abc', key: 2 }} />);

    expect(input).toHaveValue('https://youtu.be/abc');
  });

  it('leaves an edit in progress alone', () => {
    const { rerender } = render(
      <Composer onSend={() => {}} onTyping={() => {}} editing={{ id: 'm1', body: 'old text', hasMedia: false }} />
    );
    rerender(
      <Composer
        onSend={() => {}}
        onTyping={() => {}}
        editing={{ id: 'm1', body: 'old text', hasMedia: false }}
        prefill={{ text: 'https://youtu.be/abc', key: 1 }}
      />
    );

    expect(screen.getByLabelText('Message')).toHaveValue('old text');
  });
});

describe('voice messages', () => {
  /** Stands in for the browser's recorder: records "voice" and stops on request. */
  class FakeRecorder {
    static last: FakeRecorder | null = null;
    static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';
    state: 'inactive' | 'recording' = 'inactive';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor() {
      FakeRecorder.last = this;
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
      queueMicrotask(() => this.onstop?.());
    }
  }

  let now = 0;
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const getUserMedia = vi.fn();

  beforeEach(() => {
    now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    track.stop.mockClear();
    getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [track] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Wired as ThreadPage wires it: the mic on the header, the recording in the composer. */
  function Thread({ conversationId = 'c1', send }: { conversationId?: string; send: SendVoice }) {
    const voice = useVoiceMessage(conversationId, send);
    return (
      <>
        {voice.supported && (
          <button type="button" aria-label="Record voice message" disabled={voice.active} onClick={() => void voice.start()} />
        )}
        <Composer onSend={() => {}} onTyping={() => {}} voice={voice} />
      </>
    );
  }

  const record = async () => {
    await userEvent.click(screen.getByLabelText('Record voice message'));
    expect(await screen.findByText('Recording')).toBeInTheDocument();
  };

  it('keeps Send where it is, with the message box, until a recording starts', async () => {
    render(<Thread send={vi.fn()} />);

    expect(screen.getByLabelText('Send')).toBeInTheDocument();
    await record();

    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Send voice message')).toBeInTheDocument();
    expect(screen.getByLabelText('Record voice message')).toBeDisabled();
  });

  it('gives back what was being typed once the recording is done', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    render(<Thread send={send} />);
    await userEvent.type(screen.getByLabelText('Message'), 'half a thought');

    await record();
    now = 2_000;
    await userEvent.click(screen.getByLabelText('Send voice message'));

    expect(await screen.findByLabelText('Message')).toHaveValue('half a thought');
  });

  it('sends the recording with its length, and lets go of the microphone', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    render(<Thread send={send} />);

    await record();
    now = 4_000;
    await userEvent.click(screen.getByLabelText('Send voice message'));

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: 4_000, format: expect.objectContaining({ mimetype: 'audio/webm' }) }),
      expect.any(Function)
    );
    expect(track.stop).toHaveBeenCalled();
    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
  });

  it('throws a discarded recording away', async () => {
    const send = vi.fn();
    render(<Thread send={send} />);

    await record();
    await userEvent.click(screen.getByLabelText('Discard voice message'));

    expect(send).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('keeps a recording that did not send, to try again', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<Thread send={send} />);

    await record();
    now = 3_000;
    await userEvent.click(screen.getByLabelText('Send voice message'));
    expect(await screen.findByText('Not sent. Press send to try again')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Send voice message'));

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0]).toBe(send.mock.calls[0]![0]);
    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
  });

  it('shows how far the upload has got', async () => {
    let report: (percent: number) => void = () => {};
    const send = vi.fn((_recording: unknown, onProgress: (percent: number) => void) => {
      report = onProgress;
      return new Promise<void>(() => {});
    });
    render(<Thread send={send} />);

    await record();
    now = 2_000;
    await userEvent.click(screen.getByLabelText('Send voice message'));
    act(() => report(40));

    expect(screen.getByText('Sending 40%')).toBeInTheDocument();
    expect(screen.getByLabelText('Discard voice message')).toBeDisabled();
  });

  it('keeps a recording the microphone was taken from, for the person to send or not', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    render(<Thread send={send} />);

    await record();
    now = 6_000;
    // The browser ends it: a phone call, a headset gone.
    act(() => FakeRecorder.last!.stop());

    expect(await screen.findByText('Recording stopped. Send it?')).toBeInTheDocument();
    expect(screen.getByText('0:06')).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText('Send voice message'));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 6_000 }), expect.any(Function));
  });

  it('drops a recording when another conversation is opened', async () => {
    const send = vi.fn();
    const { rerender } = render(<Thread conversationId="a" send={send} />);
    await record();

    rerender(<Thread conversationId="b" send={send} />);

    expect(track.stop).toHaveBeenCalled();
    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByLabelText('Record voice message')).toBeEnabled();
  });

  it('says nothing about a microphone it was told to stop waiting for', async () => {
    let deny: (error: Error) => void = () => {};
    getUserMedia.mockReturnValue(new Promise((_, reject) => (deny = reject)));
    render(<Thread send={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('Record voice message'));
    await userEvent.click(screen.getByLabelText('Discard voice message'));
    await act(async () => deny(Object.assign(new Error('denied'), { name: 'NotAllowedError' })));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the microphone is blocked', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<Thread send={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('Record voice message'));

    expect(await screen.findByRole('alert')).toHaveTextContent('The microphone is blocked');
  });

  it('is not offered where the browser cannot record', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    render(<Thread send={vi.fn()} />);

    expect(screen.queryByLabelText('Record voice message')).not.toBeInTheDocument();
  });
});

describe('replying', () => {
  const replying = { id: 'm1', name: 'Irja', text: 'dinner at 7?' };

  it('shows what is being answered, and puts the cursor in the box', () => {
    render(<Composer onSend={() => {}} onTyping={() => {}} replying={replying} onCancelReply={() => {}} />);

    expect(screen.getByText('Replying to Irja')).toBeInTheDocument();
    expect(screen.getByText('dinner at 7?')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveFocus();
  });

  it('is cancelled from its cross or with Escape', async () => {
    const onCancelReply = vi.fn();
    render(<Composer onSend={() => {}} onTyping={() => {}} replying={replying} onCancelReply={onCancelReply} />);

    await userEvent.click(screen.getByLabelText('Cancel reply'));
    await userEvent.type(screen.getByLabelText('Message'), '{Escape}');

    expect(onCancelReply).toHaveBeenCalledTimes(2);
  });
});
