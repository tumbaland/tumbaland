import { describe, expect, it, vi } from 'vitest';
import { checkRoutes } from './connectionCheck';

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
