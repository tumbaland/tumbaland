import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from '@tumbaland/frontend-core';
import { CallEngine, MIC_BLOCKED, type CallApi, type CallState } from './callEngine';
import type { CallSignalData, CallView, ChatEvent } from '../types';

/** Records what the engine does to its connection, and lets a test drive it. */
class FakePeer {
  static created: FakePeer[] = [];
  config: RTCConfiguration;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  connectionState: RTCPeerConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  added: RTCIceCandidateInit[] = [];
  tracks: MediaStreamTrack[] = [];
  senders: Array<{ track: MediaStreamTrack | null; replaceTrack: ReturnType<typeof vi.fn> }> = [];
  closed = false;
  offers: Array<RTCOfferOptions | undefined> = [];
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  constructor(config: RTCConfiguration) {
    this.config = config;
    FakePeer.created.push(this);
  }
  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
    const sender = {
      track: track as MediaStreamTrack | null,
      replaceTrack: vi.fn(async (next: MediaStreamTrack) => {
        sender.track = next;
      })
    };
    this.senders.push(sender);
  }
  getSenders() {
    return this.senders;
  }
  async createOffer(options?: RTCOfferOptions) {
    this.offers.push(options);
    return { type: 'offer' as const, sdp: `offer-${this.offers.length}` };
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'answer-1' };
  }
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
  }
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    this.added.push(candidate);
  }
  close() {
    this.closed = true;
  }
  connect(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

const track = (deviceId = 'built-in') =>
  ({ enabled: true, stop: vi.fn(), kind: 'audio', getSettings: () => ({ deviceId }) }) as unknown as MediaStreamTrack;
const microphone = (deviceId = 'built-in') => {
  const tracks = [track(deviceId)];
  return { getTracks: () => tracks, getAudioTracks: () => tracks } as unknown as MediaStream;
};

const TOM = { userId: 'u-tom', name: 'Tom', picture: null };
const IRJA = { userId: 'u-irja', name: 'Irja', picture: null };

const callView = (overrides: Partial<CallView> = {}): CallView => ({
  id: 'call-1',
  conversationId: 'c1',
  caller: TOM,
  callees: [IRJA],
  callerDeviceId: 'tom-phone',
  answeredBy: null,
  answeredDeviceId: null,
  status: 'ringing',
  endReason: null,
  startedAt: '2026-09-23T10:00:00Z',
  answeredAt: null,
  endedAt: null,
  ...overrides
});

const answeredView = callView({ status: 'active', answeredBy: 'u-irja', answeredDeviceId: 'irja-phone' });

const event = (type: ChatEvent['type'], payload: unknown): ChatEvent => ({
  type,
  conversationId: 'c1',
  at: 1,
  payload
});

function makeApi(): CallApi & { [K in keyof CallApi]: ReturnType<typeof vi.fn> } {
  return {
    iceServers: vi.fn(async () => ({
      iceServers: [{ urls: 'turn:relay', username: 'u', credential: 'c' }],
      relay: true,
      expiresAt: null
    })),
    currentCall: vi.fn(async () => null),
    startCall: vi.fn(async () => callView()),
    acceptCall: vi.fn(async () => answeredView),
    declineCall: vi.fn(async () => undefined),
    endCall: vi.fn(async () => undefined),
    sendSignal: vi.fn(async () => undefined)
  };
}

/** Lets queued promise chains (signal send and receive) run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let api: ReturnType<typeof makeApi>;
let states: CallState[];

function engineFor(
  userId: string,
  deviceId: string,
  getMicrophone: (deviceId: string | null) => Promise<MediaStream> = async () => microphone(),
  preferredMicrophone?: () => string | null
) {
  return new CallEngine({
    api,
    userId,
    deviceId,
    onChange: (state) => states.push(state),
    createPeer: (config) => new FakePeer(config) as unknown as RTCPeerConnection,
    getMicrophone,
    preferredMicrophone,
    lingerMs: 50
  });
}

const last = () => states[states.length - 1]!;
const sent = (): CallSignalData[] => api.sendSignal.mock.calls.map((call) => call[2] as CallSignalData);

beforeEach(() => {
  api = makeApi();
  states = [];
  FakePeer.created = [];
});

afterEach(() => vi.useRealTimers());

describe('placing a call', () => {
  it('rings with this device, then sends the offer once it is answered', async () => {
    const engine = engineFor('u-tom', 'tom-phone');

    await engine.start('c1', IRJA);
    expect(api.startCall).toHaveBeenCalledWith('c1', 'tom-phone');
    expect(last()).toMatchObject({ phase: 'outgoing', peer: IRJA, call: { id: 'call-1' } });

    engine.handleEvent(event('call.accepted', answeredView));
    await settle();

    const peer = FakePeer.created[0]!;
    expect(peer.config.iceServers).toEqual([{ urls: 'turn:relay', username: 'u', credential: 'c' }]);
    expect(peer.tracks).toHaveLength(1);
    expect(sent()).toEqual([{ description: { type: 'offer', sdp: 'offer-1' } }]);
    expect(last().phase).toBe('connecting');
  });

  it('holds candidates that arrive before the answer, then applies them in order', async () => {
    const engine = engineFor('u-tom', 'tom-phone');
    await engine.start('c1', IRJA);
    engine.handleEvent(event('call.accepted', answeredView));
    await settle();
    const signal = (data: CallSignalData) =>
      engine.handleEvent(
        event('call.signal', { callId: 'call-1', fromDeviceId: 'irja-phone', toDeviceId: 'tom-phone', data })
      );

    signal({ candidate: { candidate: 'a' } });
    signal({ description: { type: 'answer', sdp: 'answer-1' } });
    signal({ candidate: { candidate: 'b' } });
    await settle();

    const peer = FakePeer.created[0]!;
    expect(peer.remoteDescription).toEqual({ type: 'answer', sdp: 'answer-1' });
    expect(peer.added.map((c) => c.candidate)).toEqual(['a', 'b']);
  });

  it('shows the timer once audio connects', async () => {
    const engine = engineFor('u-tom', 'tom-phone');
    await engine.start('c1', IRJA);
    engine.handleEvent(event('call.accepted', answeredView));
    await settle();

    FakePeer.created[0]!.connect('connected');

    expect(last()).toMatchObject({ phase: 'active', reconnecting: false });
    expect(last().connectedAt).toEqual(expect.any(Number));
  });

  it('restarts ICE from the caller when the connection fails', async () => {
    const engine = engineFor('u-tom', 'tom-phone');
    await engine.start('c1', IRJA);
    engine.handleEvent(event('call.accepted', answeredView));
    await settle();
    const peer = FakePeer.created[0]!;
    peer.connect('connected');

    peer.connect('failed');
    await settle();

    expect(last().reconnecting).toBe(true);
    expect(peer.offers.at(-1)).toEqual({ iceRestart: true });
    expect(sent().at(-1)).toEqual({ description: { type: 'offer', sdp: 'offer-2' } });
    engine.dispose();
  });

  it('says so and never rings when the microphone is refused', async () => {
    const engine = engineFor('u-tom', 'tom-phone', async () => {
      throw new Error('NotAllowedError');
    });

    await engine.start('c1', IRJA);

    expect(api.startCall).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ phase: 'ended', message: MIC_BLOCKED });
  });

  it('passes on the server’s reason when the other person is busy', async () => {
    api.startCall.mockRejectedValue(new ApiError(409, 'Irja is on another call', {}));
    const engine = engineFor('u-tom', 'tom-phone');

    await engine.start('c1', IRJA);

    expect(last()).toMatchObject({ phase: 'ended', message: 'Irja is on another call' });
  });

  it('cancels a call hung up before the server answered', async () => {
    let answer: (call: CallView) => void = () => undefined;
    api.startCall.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const engine = engineFor('u-tom', 'tom-phone');

    const starting = engine.start('c1', IRJA);
    await settle();
    engine.hangUp();
    answer(callView());
    await starting;

    expect(api.endCall).toHaveBeenCalledWith('call-1');
    expect(last().phase).toBe('idle');
  });

  it('tells the caller when the call is declined, and stops the microphone', async () => {
    const mic = microphone();
    const engine = engineFor('u-tom', 'tom-phone', async () => mic);
    await engine.start('c1', IRJA);

    engine.handleEvent(event('call.ended', callView({ status: 'ended', endReason: 'declined' })));

    expect(last()).toMatchObject({ phase: 'ended', message: "Irja can't talk right now" });
    expect(mic.getTracks()[0]!.stop).toHaveBeenCalled();
  });

  it('goes quiet again after the ended screen has been shown', async () => {
    const engine = engineFor('u-tom', 'tom-phone');
    await engine.start('c1', IRJA);
    engine.handleEvent(event('call.ended', callView({ status: 'ended', endReason: 'missed' })));
    expect(last().message).toBe('No answer');

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(last().phase).toBe('idle');
  });
});

describe('being called', () => {
  it('rings for the person called, and not for the caller’s other devices', () => {
    const irja = engineFor('u-irja', 'irja-phone');
    const tomsLaptop = engineFor('u-tom', 'tom-laptop');

    irja.handleEvent(event('call.ringing', callView()));
    tomsLaptop.handleEvent(event('call.ringing', callView()));

    expect(irja.snapshot).toMatchObject({ phase: 'incoming', peer: TOM });
    expect(tomsLaptop.snapshot.phase).toBe('idle');
  });

  it('answers with the connection ready before the server hears it, then answers the offer', async () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));
    api.acceptCall.mockImplementation(async () => {
      // By the time the server records the answer, the connection must exist.
      expect(FakePeer.created).toHaveLength(1);
      return answeredView;
    });

    await irja.accept();
    irja.handleEvent(
      event('call.signal', {
        callId: 'call-1',
        fromDeviceId: 'tom-phone',
        toDeviceId: 'irja-phone',
        data: { description: { type: 'offer', sdp: 'offer-1' } }
      })
    );
    await settle();

    expect(api.acceptCall).toHaveBeenCalledWith('call-1', 'irja-phone');
    expect(FakePeer.created[0]!.remoteDescription).toEqual({ type: 'offer', sdp: 'offer-1' });
    expect(sent()).toEqual([{ description: { type: 'answer', sdp: 'answer-1' } }]);
  });

  it('ignores signals meant for another device', async () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));
    await irja.accept();

    irja.handleEvent(
      event('call.signal', {
        callId: 'call-1',
        fromDeviceId: 'tom-phone',
        toDeviceId: 'irja-laptop',
        data: { description: { type: 'offer', sdp: 'offer-1' } }
      })
    );
    await settle();

    expect(FakePeer.created[0]!.remoteDescription).toBeNull();
  });

  it('stops ringing when answered on another of the same person’s devices', () => {
    const laptop = engineFor('u-irja', 'irja-laptop');
    laptop.handleEvent(event('call.ringing', callView()));

    laptop.handleEvent(event('call.accepted', answeredView));

    expect(laptop.snapshot.phase).toBe('idle');
  });

  it('declines', () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));

    irja.decline();

    expect(api.declineCall).toHaveBeenCalledWith('call-1');
    expect(irja.snapshot.phase).toBe('idle');
  });

  it('shows a missed call when the caller gives up', () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));

    irja.handleEvent(event('call.ended', callView({ status: 'ended', endReason: 'cancelled' })));

    expect(irja.snapshot).toMatchObject({ phase: 'ended', message: 'Missed call' });
  });

  it('finds a ringing call on opening the app from the notification', async () => {
    api.currentCall.mockResolvedValue(callView());
    const irja = engineFor('u-irja', 'irja-phone');

    await irja.resume();

    expect(irja.snapshot).toMatchObject({ phase: 'incoming', call: { id: 'call-1' } });
  });

  it('does not ring for a second call while in one', async () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));
    await irja.accept();

    irja.handleEvent(
      event('call.ringing', callView({ id: 'call-2', caller: { userId: 'u-x', name: 'X', picture: null } }))
    );

    expect(irja.snapshot.call?.id).toBe('call-1');
  });
});

describe('during a call', () => {
  it('mutes and unmutes the microphone', async () => {
    const mic = microphone();
    const irja = engineFor('u-irja', 'irja-phone', async () => mic);
    irja.handleEvent(event('call.ringing', callView()));
    await irja.accept();

    irja.toggleMute();
    expect(mic.getAudioTracks()[0]!.enabled).toBe(false);
    expect(irja.snapshot.muted).toBe(true);

    irja.toggleMute();
    expect(mic.getAudioTracks()[0]!.enabled).toBe(true);
  });

  it('hangs up: tells the server, closes the connection, says the call ended', async () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));
    await irja.accept();

    irja.hangUp();

    expect(api.endCall).toHaveBeenCalledWith('call-1');
    expect(FakePeer.created[0]!.closed).toBe(true);
    expect(irja.snapshot).toMatchObject({ phase: 'ended', message: 'Call ended' });
  });

  it('gives up when a call never connects', async () => {
    const irja = new CallEngine({
      api,
      userId: 'u-irja',
      deviceId: 'irja-phone',
      onChange: () => undefined,
      createPeer: (config) => new FakePeer(config) as unknown as RTCPeerConnection,
      getMicrophone: async () => microphone(),
      connectTimeoutMs: 20
    });
    irja.handleEvent(event('call.ringing', callView()));
    await irja.accept();

    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(api.endCall).toHaveBeenCalled();
    expect(irja.snapshot.message).toBe('Could not connect the call.');
  });

  it('hangs up when the page goes away mid-call', async () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));
    await irja.accept();

    irja.dispose();

    expect(api.endCall).toHaveBeenCalledWith('call-1');
  });
});

describe('choosing the microphone', () => {
  const answered = async (getMicrophone: (id: string | null) => Promise<MediaStream>, preferred?: () => string | null) => {
    const irja = engineFor('u-irja', 'irja-phone', getMicrophone, preferred);
    irja.handleEvent(event('call.ringing', callView()));
    await irja.accept();
    return irja;
  };

  it('opens the one that was chosen, and says which device it got', async () => {
    const getMicrophone = vi.fn(async (id: string | null) => microphone(id ?? 'built-in'));

    const irja = await answered(getMicrophone, () => 'headset');

    expect(getMicrophone).toHaveBeenCalledWith('headset');
    expect(irja.snapshot.micDeviceId).toBe('headset');
  });

  it('asks for the system default when nothing was chosen', async () => {
    const getMicrophone = vi.fn(async () => microphone());

    await answered(getMicrophone);

    expect(getMicrophone).toHaveBeenCalledWith(null);
  });

  it('moves a call to another microphone without a new offer', async () => {
    const first = microphone('built-in');
    const second = microphone('headset');
    const getMicrophone = vi.fn(async (id: string | null) => (id === 'headset' ? second : first));
    const irja = await answered(getMicrophone);
    const offersBefore = FakePeer.created[0]!.offers.length;

    await irja.switchMicrophone('headset');

    const sender = FakePeer.created[0]!.senders[0]!;
    expect(sender.replaceTrack).toHaveBeenCalledWith(second.getAudioTracks()[0]);
    expect(first.getAudioTracks()[0]!.stop).toHaveBeenCalled();
    expect(second.getAudioTracks()[0]!.stop).not.toHaveBeenCalled();
    expect(irja.snapshot.micDeviceId).toBe('headset');
    expect(FakePeer.created[0]!.offers).toHaveLength(offersBefore);
  });

  it('keeps a muted call muted on the new microphone', async () => {
    const second = microphone('headset');
    const getMicrophone = vi.fn(async (id: string | null) => (id === 'headset' ? second : microphone()));
    const irja = await answered(getMicrophone);
    irja.toggleMute();

    await irja.switchMicrophone('headset');

    expect(second.getAudioTracks()[0]!.enabled).toBe(false);
    expect(irja.snapshot.muted).toBe(true);
  });

  it('stays on the current microphone when the new one will not open', async () => {
    const first = microphone('built-in');
    const getMicrophone = vi.fn(async (id: string | null) => {
      if (id === 'headset') throw new Error('NotReadableError');
      return first;
    });
    const irja = await answered(getMicrophone);

    await irja.switchMicrophone('headset');

    expect(first.getAudioTracks()[0]!.stop).not.toHaveBeenCalled();
    expect(irja.snapshot.micDeviceId).toBe('built-in');
  });

  it('lets go of the new microphone if the swap is refused', async () => {
    const first = microphone('built-in');
    const second = microphone('headset');
    const getMicrophone = vi.fn(async (id: string | null) => (id === 'headset' ? second : first));
    const irja = await answered(getMicrophone);
    FakePeer.created[0]!.senders[0]!.replaceTrack.mockRejectedValueOnce(new Error('InvalidStateError'));

    await irja.switchMicrophone('headset');

    expect(second.getAudioTracks()[0]!.stop).toHaveBeenCalled();
    expect(first.getAudioTracks()[0]!.stop).not.toHaveBeenCalled();
    expect(irja.snapshot.micDeviceId).toBe('built-in');
  });

  it('does nothing when there is no call', async () => {
    const getMicrophone = vi.fn(async () => microphone());
    const irja = engineFor('u-irja', 'irja-phone', getMicrophone);

    await irja.switchMicrophone('headset');

    expect(getMicrophone).not.toHaveBeenCalled();
  });
});

describe('review fixes', () => {
  it('does not leave a connection open when the call ends while ICE servers load', async () => {
    let release: () => void = () => undefined;
    api.iceServers.mockReturnValue(
      new Promise((resolve) => (release = () => resolve({ iceServers: [], relay: false, expiresAt: null })))
    );
    const tom = engineFor('u-tom', 'tom-phone');
    await tom.start('c1', IRJA);
    tom.handleEvent(event('call.accepted', answeredView));

    tom.handleEvent(event('call.ended', callView({ status: 'ended', endReason: 'hangup' })));
    release();
    await settle();

    expect(FakePeer.created).toHaveLength(0);
  });

  it('leaving the page hangs up a call but keeps the engine working for the next one', async () => {
    const tom = engineFor('u-tom', 'tom-phone');
    await tom.start('c1', IRJA);

    tom.leave();
    expect(api.endCall).toHaveBeenCalledWith('call-1');

    const irja = engineFor('u-irja', 'irja-phone');
    irja.leave();
    irja.handleEvent(event('call.ringing', callView({ id: 'call-2' })));
    expect(irja.snapshot.phase).toBe('incoming');
  });

  it('leaving the page while a call only rings here does not decline it for other devices', () => {
    const irja = engineFor('u-irja', 'irja-phone');
    irja.handleEvent(event('call.ringing', callView()));

    irja.leave();

    expect(api.declineCall).not.toHaveBeenCalled();
    expect(api.endCall).not.toHaveBeenCalled();
  });
});
