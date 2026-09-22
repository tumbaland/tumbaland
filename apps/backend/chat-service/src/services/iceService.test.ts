import { CREDENTIAL_TTL_SECONDS, iceConfig, resetIceWarnings } from './iceService';

const fetchMock = jest.fn();
const realFetch = global.fetch;

const cloudflareAnswer = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:53?transport=udp',
        'turns:turn.cloudflare.com:443?transport=tcp'
      ],
      username: 'user',
      credential: 'secret'
    }
  ]
};

beforeEach(() => {
  resetIceWarnings();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.CLOUDFLARE_TURN_KEY_ID = 'key-1';
  process.env.CLOUDFLARE_TURN_API_TOKEN = 'token-1';
});

afterEach(() => {
  global.fetch = realFetch;
  fetchMock.mockReset();
});

const answer = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

it('mints credentials with the API token and hands back the relay', async () => {
  fetchMock.mockResolvedValue(answer(201, cloudflareAnswer));

  const config = await iceConfig();

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://rtc.live.cloudflare.com/v1/turn/keys/key-1/credentials/generate-ice-servers');
  expect(init.headers.Authorization).toBe('Bearer token-1');
  expect(JSON.parse(init.body)).toEqual({ ttl: CREDENTIAL_TTL_SECONDS });
  expect(config.relay).toBe(true);
  expect(config.iceServers[1]).toMatchObject({ username: 'user', credential: 'secret' });
  expect(new Date(config.expiresAt!).getTime()).toBeGreaterThan(Date.now());
});

it('drops the port 53 addresses browsers block', async () => {
  fetchMock.mockResolvedValue(answer(201, cloudflareAnswer));

  const urls = (await iceConfig()).iceServers.flatMap((server) => server.urls);

  expect(urls).toEqual([
    'stun:stun.cloudflare.com:3478',
    'turn:turn.cloudflare.com:3478?transport=udp',
    'turns:turn.cloudflare.com:443?transport=tcp'
  ]);
});

it.each(['CLOUDFLARE_TURN_KEY_ID', 'CLOUDFLARE_TURN_API_TOKEN'])(
  'falls back to STUN without asking Cloudflare when %s is missing',
  async (key) => {
    delete process.env[key];

    const config = await iceConfig();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(config).toEqual({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      relay: false,
      expiresAt: null
    });
  }
);

it('falls back to STUN when Cloudflare refuses', async () => {
  fetchMock.mockResolvedValue(answer(401, {}));
  expect(await iceConfig()).toMatchObject({ relay: false, expiresAt: null });
});

it('falls back to STUN when Cloudflare cannot be reached', async () => {
  fetchMock.mockRejectedValue(new Error('timeout'));
  expect(await iceConfig()).toMatchObject({ relay: false });
});

it('does not claim a relay when the answer has no credentials', async () => {
  fetchMock.mockResolvedValue(answer(201, { iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }] }));
  expect(await iceConfig()).toMatchObject({ relay: false });
});
