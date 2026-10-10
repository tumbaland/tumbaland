import { ApiError, logger } from '@tumbaland/frontend-core';
import type {
  CallPerson,
  CallSignalData,
  CallSignalPayload,
  CallView,
  ChatEvent,
  IceConfig
} from '../types';

/**
 * One device's side of a voice call: the microphone, the RTCPeerConnection,
 * and the back-and-forth with chat-service that rings, answers and connects.
 *
 * Kept out of React so the whole sequence can be tested with a fake peer, and
 * so a re-render can never tear down a call.
 *
 * **Fixed roles, not "perfect negotiation".** The device that placed the call
 * always sends the offer, the one that answered always answers, and only the
 * caller restarts ICE after a network change. With exactly two devices whose
 * roles the server already settled, glare (both offering at once) cannot
 * happen, so the machinery that resolves it is not needed.
 *
 * Signals are sent one at a time and applied one at a time. Two POSTs in
 * flight can arrive in either order, and a candidate applied while
 * `setRemoteDescription` is still running is dropped by the browser; both
 * queues make the order the one it was sent in.
 */

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

export interface CallState {
  phase: CallPhase;
  call: CallView | null;
  /** The other person, for the screen. Known before the server answers, from the thread. */
  peer: CallPerson | null;
  muted: boolean;
  /** The microphone the call is using, as the browser names it. Null before one is open. */
  micDeviceId: string | null;
  /** Connected before, lost it, trying again. */
  reconnecting: boolean;
  /** When the audio first connected; the timer counts from here. */
  connectedAt: number | null;
  /** What the "ended" screen says. */
  message: string | null;
  remoteStream: MediaStream | null;
}

export const IDLE: CallState = {
  phase: 'idle',
  call: null,
  peer: null,
  muted: false,
  micDeviceId: null,
  reconnecting: false,
  connectedAt: null,
  message: null,
  remoteStream: null
};

export interface CallApi {
  iceServers(): Promise<IceConfig>;
  currentCall(): Promise<CallView | null>;
  startCall(conversationId: string, deviceId: string): Promise<CallView>;
  acceptCall(callId: string, deviceId: string): Promise<CallView>;
  declineCall(callId: string): Promise<void>;
  endCall(callId: string): Promise<void>;
  sendSignal(callId: string, deviceId: string, data: CallSignalData): Promise<void>;
}

export interface CallEngineOptions {
  api: CallApi;
  /** This tab. Made up per page load. */
  deviceId: string;
  userId: string;
  onChange: (state: CallState) => void;
  createPeer?: (config: RTCConfiguration) => RTCPeerConnection;
  getMicrophone?: (deviceId: string | null) => Promise<MediaStream>;
  /** How long the "Call ended" screen stays. */
  lingerMs?: number;
  /** How long a call may take to connect before it is given up on. */
  connectTimeoutMs?: number;
  /** How long a dropped connection may try to recover. */
  recoverTimeoutMs?: number;
  /** The microphone this device was told to use, asked for each time one is opened. */
  preferredMicrophone?: () => string | null;
}

const FALLBACK_ICE: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

export const MIC_BLOCKED = 'Microphone is blocked. Allow it for Tumbaland in your settings, then try again.';

const defaultMicrophone = (deviceId: string | null) =>
  navigator.mediaDevices.getUserMedia({
    audio: {
      // `ideal`, not `exact`: a headset unplugged since it was chosen falls
      // back to the default instead of failing the call.
      ...(deviceId ? { deviceId: { ideal: deviceId } } : null),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  });

/** The device an open stream is actually on, which is not always the one asked for. */
const deviceIdOf = (stream: MediaStream): string | null => stream.getAudioTracks()[0]?.getSettings().deviceId ?? null;

/** The server's reason, where it gave one ("Irja is on another call"), else the fallback. */
function reasonOf(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export class CallEngine {
  private state: CallState = IDLE;
  private peer: RTCPeerConnection | null = null;
  private mic: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private sending: Promise<void> = Promise.resolve();
  private receiving: Promise<void> = Promise.resolve();
  private lingerTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** Bumped per `start`, so a slow answer to an abandoned attempt cannot claim a newer one. */
  private attempt = 0;

  private readonly createPeer: (config: RTCConfiguration) => RTCPeerConnection;
  private readonly getMicrophone: (deviceId: string | null) => Promise<MediaStream>;

  constructor(private readonly options: CallEngineOptions) {
    this.createPeer = options.createPeer ?? ((config) => new RTCPeerConnection(config));
    this.getMicrophone = options.getMicrophone ?? defaultMicrophone;
  }

  get snapshot(): CallState {
    return this.state;
  }

  private set(patch: Partial<CallState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.options.onChange(this.state);
  }

  private get busy(): boolean {
    return this.state.phase !== 'idle' && this.state.phase !== 'ended';
  }

  /** Whether this device placed the current call. */
  private get isCaller(): boolean {
    const call = this.state.call;
    return !!call && call.caller.userId === this.options.userId && call.callerDeviceId === this.options.deviceId;
  }

  private stillOn(callId: string): boolean {
    return !this.disposed && this.state.call?.id === callId;
  }

  // ─── What the person does ────────────────────────────────────────────────

  /** Calls the other person in this conversation. Must run from a tap: it asks for the microphone. */
  async start(conversationId: string, peer?: CallPerson): Promise<void> {
    if (this.busy) return;
    this.clearLinger();
    const attempt = ++this.attempt;
    const current = () => attempt === this.attempt && this.busy;
    this.set({ ...IDLE, phase: 'outgoing', peer: peer ?? null });

    let mic: MediaStream;
    try {
      mic = await this.getMicrophone(this.options.preferredMicrophone?.() ?? null);
    } catch {
      if (current()) this.finish(MIC_BLOCKED);
      return;
    }
    // Hung up while the permission prompt was open.
    if (!current()) {
      for (const track of mic.getTracks()) track.stop();
      return;
    }
    this.holdMicrophone(mic);

    try {
      const call = await this.options.api.startCall(conversationId, this.options.deviceId);
      if (!current()) {
        void this.options.api.endCall(call.id).catch(() => undefined);
        return;
      }
      // The ringing event can beat this response here; either way the call is ours.
      if (!this.state.call) this.set({ call, peer: call.callees[0] ?? this.state.peer });
    } catch (error) {
      if (current()) this.finish(reasonOf(error, 'Could not start the call.'));
    }
  }

  /** Answers the call ringing on this device. Must run from a tap, for the microphone. */
  async accept(): Promise<void> {
    const call = this.state.call;
    if (this.state.phase !== 'incoming' || !call) return;
    this.set({ phase: 'connecting' });

    let mic: MediaStream;
    try {
      mic = await this.getMicrophone(this.options.preferredMicrophone?.() ?? null);
    } catch {
      if (!this.stillOn(call.id)) return;
      void this.options.api.declineCall(call.id).catch(() => undefined);
      this.finish(MIC_BLOCKED);
      return;
    }
    // Ended while the permission prompt was open. Only this microphone is
    // stopped: whatever the engine holds now may belong to a newer call.
    if (!this.stillOn(call.id)) {
      for (const track of mic.getTracks()) track.stop();
      return;
    }
    this.holdMicrophone(mic);

    // The connection exists before the server hears "accepted", so the offer
    // the caller sends the moment it does always has somewhere to land.
    if (!(await this.openPeer(call.id))) return;

    try {
      const accepted = await this.options.api.acceptCall(call.id, this.options.deviceId);
      if (this.stillOn(call.id)) this.set({ call: accepted });
      this.armConnectTimeout();
    } catch (error) {
      this.finish(reasonOf(error, 'Could not answer the call.'));
    }
  }

  decline(): void {
    const call = this.state.call;
    if (this.state.phase !== 'incoming' || !call) return;
    void this.options.api.declineCall(call.id).catch(() => undefined);
    this.finish(null);
  }

  /** Ends the call from this side, whatever stage it is at. */
  hangUp(message: string | null = null): void {
    if (!this.busy) return;
    const call = this.state.call;
    const wasTalking = this.state.phase === 'connecting' || this.state.phase === 'active';
    if (call) void this.options.api.endCall(call.id).catch(() => undefined);
    this.finish(message ?? (wasTalking ? 'Call ended' : null));
  }

  /** Keeps `mic` as the microphone of this call, and tells the screen which device it is. */
  private holdMicrophone(mic: MediaStream): void {
    this.mic = mic;
    this.set({ micDeviceId: deviceIdOf(mic) });
  }

  /**
   * Moves the call to another microphone without a new offer: the sender
   * swaps its track, which the far end hears as nothing more than a pause.
   *
   * Before the call has a microphone there is nothing to move; the choice is
   * remembered by the caller and is what the next one is opened on. A device
   * that will not open leaves the call on the one it has.
   */
  async switchMicrophone(deviceId: string | null): Promise<void> {
    if (!this.busy || !this.mic) return;
    const callId = this.state.call?.id;

    let next: MediaStream;
    try {
      next = await this.getMicrophone(deviceId);
    } catch (error) {
      logger.warn('Could not switch microphone', { error: (error as Error).message });
      return;
    }

    const track = next.getAudioTracks()[0];
    const stale = !this.busy || !this.mic || (callId !== undefined && this.state.call?.id !== callId);
    if (stale || !track) {
      for (const t of next.getTracks()) t.stop();
      return;
    }

    // A muted call stays muted on the new microphone.
    track.enabled = !this.state.muted;
    const sender = this.peer?.getSenders().find((s) => s.track?.kind === 'audio');
    if (sender) {
      try {
        await sender.replaceTrack(track);
      } catch (error) {
        logger.warn('Could not hand the call to the new microphone', { error: (error as Error).message });
        for (const t of next.getTracks()) t.stop();
        return;
      }
    }

    const previous = this.mic;
    this.holdMicrophone(next);
    for (const t of previous.getTracks()) t.stop();
  }

  toggleMute(): void {
    if (!this.mic) return;
    const muted = !this.state.muted;
    for (const track of this.mic.getAudioTracks()) track.enabled = !muted;
    this.set({ muted });
  }

  /** Clears the "ended" screen early. */
  dismiss(): void {
    if (this.state.phase !== 'ended') return;
    this.clearLinger();
    this.set(IDLE);
  }

  /**
   * Asks the server whether something is ringing for this person. What makes
   * a call answerable from a notification: the app may have been closed when
   * the ringing event went out, and the stream does not replay calls.
   */
  async resume(): Promise<void> {
    if (this.busy) return;
    try {
      const call = await this.options.api.currentCall();
      if (!call || this.busy) return;
      if (call.status === 'ringing') this.onRinging(call);
    } catch (error) {
      logger.warn('Could not check for a ringing call', { error: (error as Error).message });
    }
  }

  // ─── What the server says ────────────────────────────────────────────────

  handleEvent(event: ChatEvent): void {
    if (this.disposed) return;
    switch (event.type) {
      case 'call.ringing':
        return this.onRinging(event.payload as CallView);
      case 'call.accepted':
        return this.onAccepted(event.payload as CallView);
      case 'call.ended':
        return this.onEnded(event.payload as CallView);
      case 'call.signal':
        return this.onSignal(event.payload as CallSignalPayload);
      default:
    }
  }

  private onRinging(call: CallView): void {
    const { userId, deviceId } = this.options;

    // The echo of our own call, possibly before `startCall` has answered.
    if (call.callerDeviceId === deviceId) {
      if (this.state.phase === 'outgoing' && !this.state.call) this.set({ call, peer: call.callees[0] ?? this.state.peer });
      return;
    }
    if (this.busy) return;
    if (!call.callees.some((callee) => callee.userId === userId)) return;

    this.clearLinger();
    this.set({ ...IDLE, phase: 'incoming', call, peer: call.caller });
  }

  private onAccepted(call: CallView): void {
    const { deviceId } = this.options;
    if (this.state.phase === 'outgoing' && !this.state.call && call.callerDeviceId === deviceId) {
      this.set({ call });
    }
    if (this.state.call?.id !== call.id) return;

    if (call.callerDeviceId === deviceId) {
      this.set({ call, phase: 'connecting' });
      void this.connectAsCaller(call.id);
    } else if (call.answeredDeviceId === deviceId) {
      this.set({ call });
    } else {
      // Picked up on another of this person's devices.
      this.finish(null);
    }
  }

  private onEnded(call: CallView): void {
    if (this.state.call?.id !== call.id) return;
    const caller = this.isCaller;
    const name = this.state.peer?.name || 'They';

    const message = ((): string | null => {
      switch (call.endReason) {
        case 'declined':
          return caller ? `${name} can't talk right now` : null;
        case 'missed':
          return caller ? 'No answer' : 'Missed call';
        case 'cancelled':
          return caller ? null : 'Missed call';
        case 'dropped':
          return 'Call dropped';
        default:
          return 'Call ended';
      }
    })();
    this.finish(message);
  }

  private onSignal(payload: CallSignalPayload): void {
    if (payload.toDeviceId !== this.options.deviceId) return;
    if (payload.callId !== this.state.call?.id) return;
    this.receiving = this.receiving
      .then(() => this.applySignal(payload.data))
      .catch((error: Error) => logger.warn('Could not apply a call signal', { error: error.message }));
  }

  // ─── The connection ──────────────────────────────────────────────────────

  /**
   * Creates the connection for `callId`, or nothing if that call ended while
   * the ICE servers were being fetched: a connection made after the teardown
   * would never be closed.
   */
  private async openPeer(callId: string): Promise<RTCPeerConnection | null> {
    const ice = await this.options.api.iceServers().catch(() => null);
    if (!this.stillOn(callId)) return null;
    const peer = this.createPeer({ iceServers: (ice?.iceServers as RTCIceServer[] | undefined) ?? FALLBACK_ICE });
    this.peer = peer;

    for (const track of this.mic?.getTracks() ?? []) peer.addTrack(track, this.mic!);

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate =
        typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : (event.candidate as RTCIceCandidateInit);
      this.send({ candidate });
    };
    peer.ontrack = (event) => {
      this.set({ remoteStream: event.streams[0] ?? new MediaStream([event.track]) });
    };
    peer.onconnectionstatechange = () => this.onConnectionState(peer);
    return peer;
  }

  private async connectAsCaller(callId: string): Promise<void> {
    try {
      const peer = await this.openPeer(callId);
      if (!peer) return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.send({ description: { type: 'offer', sdp: offer.sdp ?? '' } });
      this.armConnectTimeout();
    } catch (error) {
      logger.warn('Could not start the call connection', { error: (error as Error).message });
      this.hangUp('Could not connect the call.');
    }
  }

  private async applySignal(data: CallSignalData): Promise<void> {
    const peer = this.peer;
    if (!peer) {
      if (data.candidate) this.pendingCandidates.push(data.candidate);
      return;
    }

    if (data.description) {
      await peer.setRemoteDescription(data.description);
      if (data.description.type === 'offer') {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        this.send({ description: { type: 'answer', sdp: answer.sdp ?? '' } });
      }
      const queued = this.pendingCandidates;
      this.pendingCandidates = [];
      for (const candidate of queued) await peer.addIceCandidate(candidate).catch(() => undefined);
    }

    if (data.candidate) {
      if (!peer.remoteDescription) this.pendingCandidates.push(data.candidate);
      // A candidate the browser cannot use is not worth ending a call over.
      else await peer.addIceCandidate(data.candidate).catch(() => undefined);
    }
  }

  private send(data: CallSignalData): void {
    const callId = this.state.call?.id;
    if (!callId) return;
    this.sending = this.sending
      .then(() => this.options.api.sendSignal(callId, this.options.deviceId, data))
      .catch((error: Error) => logger.warn('Could not send a call signal', { error: error.message }));
  }

  private onConnectionState(peer: RTCPeerConnection): void {
    if (peer !== this.peer) return;

    switch (peer.connectionState) {
      case 'connected':
        this.clearTimer('connectTimer');
        this.clearTimer('recoverTimer');
        this.set({ phase: 'active', reconnecting: false, connectedAt: this.state.connectedAt ?? Date.now() });
        break;
      case 'disconnected':
      case 'failed':
        // "disconnected" often recovers by itself within seconds; "failed"
        // never does without a restart. Either way the caller restarts, and
        // the call is given up on only if nothing comes back.
        if (this.state.phase === 'active') this.set({ reconnecting: true });
        if (peer.connectionState === 'failed' && this.isCaller) void this.restartIce(peer);
        if (!this.recoverTimer && this.state.phase === 'active') {
          this.recoverTimer = setTimeout(() => {
            this.recoverTimer = null;
            this.hangUp('Call dropped');
          }, this.options.recoverTimeoutMs ?? 30_000);
        }
        break;
      default:
    }
  }

  private async restartIce(peer: RTCPeerConnection): Promise<void> {
    if (peer.signalingState !== 'stable') return;
    try {
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      this.send({ description: { type: 'offer', sdp: offer.sdp ?? '' } });
    } catch (error) {
      logger.warn('ICE restart failed', { error: (error as Error).message });
    }
  }

  private armConnectTimeout(): void {
    this.clearTimer('connectTimer');
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (this.state.phase === 'connecting') this.hangUp('Could not connect the call.');
    }, this.options.connectTimeoutMs ?? 30_000);
  }

  // ─── Ending ──────────────────────────────────────────────────────────────

  /** Tears the call down and shows `message` for a moment, or goes straight back to idle. */
  private finish(message: string | null): void {
    this.teardown();
    this.clearLinger();
    if (!message) {
      this.set(IDLE);
      return;
    }
    this.set({ ...IDLE, phase: 'ended', peer: this.state.peer, message });
    const linger = message === MIC_BLOCKED ? 6_000 : (this.options.lingerMs ?? 2_500);
    this.lingerTimer = setTimeout(() => {
      this.lingerTimer = null;
      if (this.state.phase === 'ended') this.set(IDLE);
    }, linger);
  }

  private teardown(): void {
    this.clearTimer('connectTimer');
    this.clearTimer('recoverTimer');
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
      this.peer = null;
    }
    for (const track of this.mic?.getTracks() ?? []) track.stop();
    this.mic = null;
    this.pendingCandidates = [];
  }

  private clearTimer(name: 'connectTimer' | 'recoverTimer'): void {
    const timer = this[name];
    if (timer) clearTimeout(timer);
    this[name] = null;
  }

  private clearLinger(): void {
    if (this.lingerTimer) clearTimeout(this.lingerTimer);
    this.lingerTimer = null;
  }

  /**
   * The page is going away, possibly into the back-forward cache, from which it
   * can come back. Hangs up a call this device is on, so the other side is not
   * left talking to nobody, but leaves a call that is only ringing here alone:
   * another device may still answer it. The engine stays usable.
   */
  leave(): void {
    if (this.state.phase === 'incoming') this.finish(null);
    else this.hangUp();
  }

  /** For good: the component holding the engine is unmounting. */
  dispose(): void {
    if (this.busy && this.state.call) void this.options.api.endCall(this.state.call.id).catch(() => undefined);
    this.teardown();
    this.clearLinger();
    this.disposed = true;
  }
}
