import type { IceServer } from '../types';

/**
 * Which ways this device can reach another one for a call.
 *
 * Found by gathering ICE candidates, which is the first thing a real call does,
 * without calling anyone. Each candidate type is a route:
 *
 * - `host`: straight across the local network. Only works on the same Wi-Fi.
 * - `srflx`: through the router, using the address it shows the internet. Works
 *   between most home networks, often not from mobile data.
 * - `relay`: through the TURN relay. Slower, but works from almost anywhere, and
 *   is what a call from 4G ends up using.
 *
 * A relay candidate here means the credentials are valid and the relay is
 * reachable from this network, which is the part a call cannot fix by itself.
 */
export interface ConnectionRoutes {
  local: boolean;
  internet: boolean;
  relay: boolean;
}

/**
 * The longest a check may take. Gathering often never reports "complete": on a
 * machine with Docker bridges or an unused IPv6 route Chromium sits in
 * "gathering" indefinitely, although every candidate that matters arrived in
 * the first 50 ms.
 */
export const GATHER_TIMEOUT_MS = 10_000;

/**
 * How long to wait after the last candidate for another. Long enough for a
 * relay that falls back from UDP to TLS on port 443, which takes a few round
 * trips more than the router's answer.
 */
export const QUIET_MS = 3_000;

type PeerFactory = (config: RTCConfiguration) => RTCPeerConnection;

const defaultFactory: PeerFactory = (config) => new RTCPeerConnection(config);

export function canCheck(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

export async function checkRoutes(
  iceServers: IceServer[],
  createPeer: PeerFactory = defaultFactory,
  timeoutMs = GATHER_TIMEOUT_MS,
  quietMs = QUIET_MS
): Promise<ConnectionRoutes> {
  const routes: ConnectionRoutes = { local: false, internet: false, relay: false };
  const peer = createPeer({ iceServers });

  try {
    await new Promise<void>((resolve) => {
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const timer = setTimeout(() => finish(), timeoutMs);
      const finish = () => {
        clearTimeout(timer);
        clearTimeout(quiet);
        resolve();
      };

      peer.onicecandidate = (event) => {
        // A null candidate is the end of gathering.
        if (!event.candidate) return finish();
        const type = event.candidate.type;
        if (type === 'host') routes.local = true;
        else if (type === 'srflx' || type === 'prflx') routes.internet = true;
        else if (type === 'relay') routes.relay = true;

        // The relay is the last route to show up and the one in question, so
        // once it is there nothing is left to learn.
        if (routes.relay) return finish();
        clearTimeout(quiet);
        quiet = setTimeout(finish, quietMs);
      };
      peer.onicegatheringstatechange = () => {
        if (peer.iceGatheringState === 'complete') finish();
      };

      // Nothing is gathered until there is something to send. A data channel
      // needs no microphone permission, so the check never asks for one.
      peer.createDataChannel('check');
      peer
        .createOffer()
        .then((offer) => peer.setLocalDescription(offer))
        .catch(finish);
    });
  } finally {
    peer.close();
  }

  return routes;
}
