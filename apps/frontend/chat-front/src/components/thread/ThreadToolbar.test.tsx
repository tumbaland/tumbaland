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

import { ThreadToolbar, assistantsSummary } from './ThreadToolbar';
import type { AssistantsView } from '../../types';

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
  assistants: null as AssistantsView | null,
  refreshAssistants: vi.fn(),
  assistantActions: {
    change: vi.fn(),
    createBot: vi.fn(),
    updateBot: vi.fn(),
    deleteBot: vi.fn(),
    setCap: vi.fn()
  } as never,
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

const bot = (name: string, paused = false) => ({
  id: name,
  name,
  personality: '',
  aboutOwner: '',
  color: '#7c3aed',
  model: 'claude-sonnet-5-5' as const,
  modelLabel: 'Balanced',
  paused,
  joinsIn: false,
  ownerId: 'u-tom',
  ownerName: 'Tom',
  mine: true,
  canManage: true
});

const view = (overrides: Partial<AssistantsView> = {}): AssistantsView => ({
  enabled: true,
  lockedOff: false,
  whoCanAdd: 'everyone',
  aboutUs: '',
  memory: '',
  memoryOn: true,
  isManager: false,
  canAdd: true,
  bots: [],
  presets: [],
  colors: ['#7c3aed'],
  models: { options: [], default: 'claude-sonnet-5-5' },
  allowance: { limit: 5000, used: 0, percent: 0, capPercent: null, exhausted: false, resetsOn: '2026-11-01' },
  ...overrides
});

describe('Assistants in the menu', () => {
  it('opens the dialog, and asks for the latest as it opens', async () => {
    const given = thread({ assistants: view() });
    toolbar({ thread: given });

    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Assistants/ }));

    expect(await screen.findByRole('dialog', { name: 'Assistants' })).toBeInTheDocument();
    expect(given.refreshAssistants).toHaveBeenCalled();
  });

  it('says where things stand under its name', async () => {
    toolbar({ thread: thread({ assistants: view({ bots: [bot('Tumbi'), bot('Bubu')] }) }) });
    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    expect(screen.getByRole('menuitem', { name: /Assistants/ })).toHaveTextContent('Tumbi and Bubu');
  });

  it('opens the settings of an assistant tapped in the thread, and leads on to the rest', async () => {
    const onCloseBot = vi.fn();
    const given = thread({ assistants: view({ bots: [bot('Tumbi')] }) });
    toolbar({ thread: given, openBotId: 'Tumbi', onCloseBot });

    expect(screen.getByRole('dialog', { name: 'Edit Tumbi' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Settings for all assistants in this chat' }));
    expect(onCloseBot).toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Assistants' })).toBeInTheDocument();
  });

  it('opens nothing for an assistant that is no longer there', () => {
    toolbar({ thread: thread({ assistants: view({ bots: [] }) }), openBotId: 'Tumbi' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is in the menu before it has loaded, with nothing under it', async () => {
    toolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    expect(screen.getByRole('menuitem', { name: 'Assistants' })).toBeInTheDocument();
  });
});

describe('assistantsSummary', () => {
  it('has nothing to say before it loads', () => {
    expect(assistantsSummary(null)).toBeUndefined();
  });

  it('says off, or locked by an admin', () => {
    expect(assistantsSummary(view({ enabled: false }))).toBe('Off');
    expect(assistantsSummary(view({ lockedOff: true, enabled: false }))).toBe('Turned off by an admin');
  });

  it('names the assistants that are working, and counts past two', () => {
    expect(assistantsSummary(view())).toBe('On, none added yet');
    expect(assistantsSummary(view({ bots: [bot('Tumbi', true)] }))).toBe('On, all paused');
    expect(assistantsSummary(view({ bots: [bot('Tumbi')] }))).toBe('Tumbi');
    expect(assistantsSummary(view({ bots: [bot('Tumbi'), bot('Bubu', true), bot('Mochi')] }))).toBe('Tumbi and Mochi');
    expect(assistantsSummary(view({ bots: [bot('A'), bot('B'), bot('C'), bot('D')] }))).toBe('A, B and 2 more');
  });
});
