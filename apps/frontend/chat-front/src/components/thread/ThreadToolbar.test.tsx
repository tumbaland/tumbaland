import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const call = vi.hoisted(() => ({ requestCall: vi.fn() }));
vi.mock('../../services/callBus', () => call);
vi.mock('../../services/chatApi', () => ({ chatApi: { listAlbums: vi.fn(async () => []) }, newClientId: () => 'client-1' }));
vi.mock('../../services/live', async (original) => ({
  ...(await original<typeof import('../../services/live')>()),
  isGeolocationSupported: () => true
}));

import { ThreadToolbar } from './ThreadToolbar';

const member = (userId: string, name: string) => ({ userId, name, email: `${userId}@x`, joinedAt: '' });

const thread = (overrides = {}) => ({
  members: [member('u-tom', 'Tom'), member('u-irja', 'Irja')],
  title: '',
  presence: {},
  typingNames: [],
  reads: { 'u-irja': { userId: 'u-irja', lastReadMessageId: 'm1', lastReadAt: '2026-10-22T09:00:00.000Z' } },
  messages: [],
  appearance: { theme: 'classic', backgroundFileId: null, backgroundUrl: null },
  photoAlbum: { mode: 'album' as const, albumId: 'a1', albumName: 'Rome' },
  setAppearance: vi.fn(async () => {}),
  setPhotoAlbum: vi.fn(async () => {}),
  startCollage: vi.fn(async () => ({ collage: { id: 'k1', title: 'Trip' } }) as never),
  ...overrides
});

const toolbar = (props: Partial<Parameters<typeof ThreadToolbar>[0]> = {}) =>
  render(
    <ThreadToolbar
      conversationId="c1"
      currentUserId="u-tom"
      thread={thread()}
      onSearch={vi.fn()}
      onLocation={vi.fn()}
      sharing={false}
      recordingVoice={false}
      choosingAlbum={false}
      onCloseAlbum={vi.fn()}
      onOpenCollage={vi.fn()}
      {...props}
    />
  );

beforeEach(() => call.requestCall.mockReset());

describe('ThreadToolbar', () => {
  it('calls the one other person, and opens location sharing', async () => {
    const onLocation = vi.fn();
    toolbar({ onLocation });

    await userEvent.click(screen.getByRole('button', { name: 'Call Irja' }));
    expect(call.requestCall).toHaveBeenCalledWith({
      conversationId: 'c1',
      peer: { userId: 'u-irja', name: 'Irja', picture: null }
    });

    await userEvent.click(screen.getByRole('button', { name: 'Share location' }));
    expect(onLocation).toHaveBeenCalled();
  });

  it('says the photos go to their album, and opens search and the theme from the menu', async () => {
    const onSearch = vi.fn();
    toolbar({ onSearch });

    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    expect(screen.getByText('Rome')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /Search messages/ }));
    expect(onSearch).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Theme/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it.each([
    [{ mode: 'off' as const, albumId: null, albumName: null }, 'Not saving to Album'],
    [{ mode: 'unset' as const, albumId: null, albumName: null }, 'Not chosen yet']
  ])('words an album setting of %o', async (photoAlbum, words) => {
    toolbar({ thread: thread({ photoAlbum, appearance: { theme: 'ocean', backgroundFileId: 'f', backgroundUrl: 'u' } }) });
    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    expect(screen.getByText(words)).toBeInTheDocument();
    expect(screen.getByText(/with a photo/)).toBeInTheDocument();
  });

  it('offers no call in a group', () => {
    toolbar({ thread: thread({ members: [member('u-tom', 'Tom'), member('u-irja', 'Irja'), member('u-mari', 'Mari')] }) });
    expect(screen.queryByRole('button', { name: /^Call/ })).not.toBeInTheDocument();
  });

  it('starts a collage from the album dialog and opens it', async () => {
    const onOpenCollage = vi.fn();
    const given = thread();
    toolbar({ thread: given, onOpenCollage });

    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Album and collage/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
