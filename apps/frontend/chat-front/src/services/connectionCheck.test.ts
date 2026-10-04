import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { canCheck, checkRoutes } from './connectionCheck';

/** A stand-in peer that announces the given candidate types, then the end of gathering. */
function fakePeer(types: string[], { finishes = true } = {}) {
  const peer = {
    onicecandidate: null as ((event: { candidate: { type: string } | null }) => void) | null,
    onicegatheringstatechange: null as (() => void) | null,
    iceGatheringState: 'new',
    config: null as RTCConfiguration | null,
    close: vi.fn(),
    createDataChannel: vi.fn(),
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: '' })),
    setLocalDescription: vi.fn(async () => {
      for (const type of types) peer.onicecandidate?.({ candidate: { type } });
      if (finishes) peer.onicecandidate?.({ candidate: null });
    })
  };
  const factory = (config: RTCConfiguration) => {
    peer.config = config;
    return peer as unknown as RTCPeerConnection;
  };
  return { peer, factory };
}

const servers = [{ urls: 'turn:turn.example:3478', username: 'u', credential: 'c' }];

describe('checkRoutes', () => {
  it('reports every route the candidates show', async () => {
    const { peer, factory } = fakePeer(['host', 'srflx', 'relay']);

    expect(await checkRoutes(servers, factory)).toEqual({ local: true, internet: true, relay: true });
    expect(peer.config).toEqual({ iceServers: servers });
    expect(peer.close).toHaveBeenCalled();
  });

  it('says the relay is not reachable when no relay candidate turns up', async () => {
    const { factory } = fakePeer(['host', 'srflx']);
    expect(await checkRoutes(servers, factory)).toEqual({ local: true, internet: true, relay: false });
  });

  it('counts a peer-reflexive candidate as reaching the internet', async () => {
    const { factory } = fakePeer(['prflx']);
    expect((await checkRoutes(servers, factory)).internet).toBe(true);
  });

  it('stops once candidates go quiet, keeping what it found, when gathering never finishes', async () => {
    const { peer, factory } = fakePeer(['host', 'srflx'], { finishes: false });

    const started = Date.now();
    expect(await checkRoutes(servers, factory, 5_000, 20)).toEqual({ local: true, internet: true, relay: false });
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(peer.close).toHaveBeenCalled();
  });

  it('stops at the relay without waiting for the rest', async () => {
    const { factory } = fakePeer(['relay'], { finishes: false });
    const started = Date.now();
    expect((await checkRoutes(servers, factory, 5_000, 5_000)).relay).toBe(true);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('gives up at the time limit when nothing arrives at all', async () => {
    const { factory } = fakePeer([], { finishes: false });
    expect(await checkRoutes(servers, factory, 20)).toEqual({ local: false, internet: false, relay: false });
  });

  it('asks for no microphone: a data channel is enough to start gathering', async () => {
    const { peer, factory } = fakePeer([]);
    await checkRoutes(servers, factory);
    expect(peer.createDataChannel).toHaveBeenCalledWith('check');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canCheck', () => {
  it('is only possible where the browser has peer connections', () => {
    vi.stubGlobal('RTCPeerConnection', undefined);
    expect(canCheck()).toBe(false);

    vi.stubGlobal('RTCPeerConnection', class {});
    expect(canCheck()).toBe(true);
  });
});

describe('checkRoutes on its own', () => {
  it('opens a real peer connection with the given servers when none is passed in', async () => {
    const created: Array<{ config: RTCConfiguration }> = [];
    class FakePeer {
      onicecandidate: ((event: { candidate: { type: string } | null }) => void) | null = null;
      onicegatheringstatechange: (() => void) | null = null;
      iceGatheringState = 'new';
      close = vi.fn();
      createDataChannel = vi.fn();
      createOffer = vi.fn(async () => ({ type: 'offer', sdp: '' }));
      constructor(public config: RTCConfiguration) {
        created.push(this);
      }
      setLocalDescription = vi.fn(async () => {
        this.onicecandidate?.({ candidate: { type: 'relay' } });
      });
    }
    vi.stubGlobal('RTCPeerConnection', FakePeer);

    const routes = await checkRoutes(servers);

    expect(created[0]?.config).toEqual({ iceServers: servers });
    expect(routes.relay).toBe(true);
  });

  it('stops when the browser says gathering is complete', async () => {
    const { peer, factory } = fakePeer(['host'], { finishes: false });
    peer.setLocalDescription.mockImplementation(async () => {
      peer.onicecandidate?.({ candidate: { type: 'host' } });
      peer.iceGatheringState = 'complete';
      peer.onicegatheringstatechange?.();
    });

    expect(await checkRoutes(servers, factory)).toEqual({ local: true, internet: false, relay: false });
  });

  it('keeps waiting while gathering is only part way', async () => {
    const { peer, factory } = fakePeer(['host'], { finishes: false });
    peer.setLocalDescription.mockImplementation(async () => {
      peer.iceGatheringState = 'gathering';
      peer.onicegatheringstatechange?.();
      peer.onicecandidate?.({ candidate: { type: 'host' } });
      peer.onicecandidate?.({ candidate: null });
    });

    expect(await checkRoutes(servers, factory)).toEqual({ local: true, internet: false, relay: false });
  });

  it('reports no routes, rather than failing, when the offer cannot be made', async () => {
    const { peer, factory } = fakePeer([]);
    peer.createOffer.mockRejectedValue(new Error('no offer'));

    expect(await checkRoutes(servers, factory)).toEqual({ local: false, internet: false, relay: false });
    expect(peer.close).toHaveBeenCalled();
  });
});
