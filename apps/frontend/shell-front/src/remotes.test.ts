import { vi } from 'vite-plus/test';

const loadRemote = vi.fn();
const registerRemotes = vi.fn();
vi.mock('@module-federation/runtime', () => ({
  loadRemote: (...args: unknown[]) => loadRemote(...args),
  registerRemotes: (...args: unknown[]) => registerRemotes(...args)
}));

const getGlobalConfig = vi.fn();
vi.mock('./config/ConfigProvider', () => ({ getGlobalConfig: () => getGlobalConfig() }));

import { EMBEDDABLE_APPS } from './config/apps';

const album = EMBEDDABLE_APPS.find((app) => app.remote === 'album')!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  getGlobalConfig.mockReturnValue({
    ALBUM_FRONT_URL: 'https://album.example/',
    RELATIONSHIP_FRONT_URL: 'https://journal.example'
  });
});

/** Resolves the lazy component the way React.lazy does, to run its loader. */
async function resolveLazy(component: unknown): Promise<unknown> {
  return (component as { _payload: { _result: () => Promise<unknown> } })._payload._result();
}

it('registers each configured app against its own origin, once', async () => {
  const { remoteComponent } = await import('./remotes');
  loadRemote.mockResolvedValue({ default: () => null });

  await resolveLazy(remoteComponent(album));
  await resolveLazy(remoteComponent(album));

  expect(registerRemotes).toHaveBeenCalledTimes(1);
  const entries = registerRemotes.mock.calls[0][0] as { name: string; entry: string }[];
  // The trailing slash on the configured URL must not double up.
  expect(entries).toContainEqual({ name: 'album', entry: 'https://album.example/remoteEntry.js', type: 'module' });
  expect(entries).toContainEqual({
    name: 'relationship',
    entry: 'https://journal.example/remoteEntry.js',
    type: 'module'
  });
});

it('leaves out an app this deployment has no URL for', async () => {
  const { remoteComponent } = await import('./remotes');
  loadRemote.mockResolvedValue({ default: () => null });

  await resolveLazy(remoteComponent(album));

  const names = (registerRemotes.mock.calls[0][0] as { name: string }[]).map((entry) => entry.name);
  expect(names).toEqual(['relationship', 'album']);
});

it('asks the runtime for the module the remote exposes', async () => {
  const { remoteComponent } = await import('./remotes');
  loadRemote.mockResolvedValue({ default: () => null });

  await resolveLazy(remoteComponent(album));

  expect(loadRemote).toHaveBeenCalledWith('album/App');
});

it('hands back the same component for an app already loaded, so a second visit does not reload it', async () => {
  const { remoteComponent } = await import('./remotes');

  expect(remoteComponent(album)).toBe(remoteComponent(album));
});

it('fails with the module’s name and address rather than the runtime’s diagnostics', async () => {
  const { remoteComponent } = await import('./remotes');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  loadRemote.mockRejectedValue(new Error('ScriptExternalLoadError: ... see https://module-federation.io'));

  await expect(resolveLazy(remoteComponent(album))).rejects.toThrow('Could not reach Album at https://album.example/.');
});

it('fails clearly when the deployment has no URL for the app', async () => {
  const { remoteComponent } = await import('./remotes');
  getGlobalConfig.mockReturnValue({});

  await expect(resolveLazy(remoteComponent(album))).rejects.toThrow(
    'ALBUM_FRONT_URL is not configured for this deployment.'
  );
});

it('fails when the remote answers without the module', async () => {
  const { remoteComponent } = await import('./remotes');
  loadRemote.mockResolvedValue(null);

  await expect(resolveLazy(remoteComponent(album))).rejects.toThrow('Album did not provide its pages.');
});

it('forgets a failed app so the next render can try again', async () => {
  const { remoteComponent, forgetRemote } = await import('./remotes');

  const first = remoteComponent(album);
  forgetRemote(album);

  // React caches a lazy component's rejection for good, so a retry needs a new one.
  expect(remoteComponent(album)).not.toBe(first);
});

it('loads another exposed module on request, cached apart from the app itself', async () => {
  getGlobalConfig.mockReturnValue({ CHAT_FRONT_URL: 'https://chat.example' });
  const { remoteComponent } = await import('./remotes');
  const chat = EMBEDDABLE_APPS.find((app) => app.remote === 'chat')!;
  loadRemote.mockResolvedValue({ default: () => null });

  const panel = remoteComponent(chat, './Panel');
  await resolveLazy(panel);

  expect(loadRemote).toHaveBeenCalledWith('chat/Panel');
  expect(remoteComponent(chat, './Panel')).toBe(panel);
  expect(remoteComponent(chat)).not.toBe(panel);
});
