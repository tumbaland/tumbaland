import { logger } from '@tumbaland/backend-core';

/**
 * The ICE servers a browser needs to set up a call.
 *
 * Two phones on different networks usually cannot reach each other directly,
 * and a call between them only works through a TURN relay. The relay is
 * Cloudflare's, not ours: the Pi has no forwarded ports and every request
 * reaches it through the Cloudflare Tunnel, which carries HTTP(S) and not the
 * UDP a relay needs.
 *
 * Credentials are minted per request and expire, so the API token that mints
 * them never reaches a browser, and a credential copied out of one is useless
 * after `CREDENTIAL_TTL_SECONDS`.
 *
 * A missing key, or Cloudflare failing, is a degraded call rather than a broken
 * one: the answer falls back to STUN, which still connects two phones on the
 * same kind of network. `relay: false` says so, and the connection check page
 * shows it.
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  /** Whether a TURN relay is included. False means some networks will not connect. */
  relay: boolean;
  /** When the relay credentials stop working, for refreshing a long call. Null without a relay. */
  expiresAt: string | null;
}

/**
 * Longer than any call, so a call does not lose its relay midway. A call that
 * does outlive it refreshes with `setConfiguration`.
 */
export const CREDENTIAL_TTL_SECONDS = 6 * 60 * 60;

const REQUEST_TIMEOUT_MS = 5_000;

const STUN_ONLY: IceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

/**
 * Cloudflare also offers port 53, which browsers block. Handing it over costs a
 * candidate that times out and slows gathering, so it is dropped here.
 */
function withoutPort53(server: IceServer): IceServer | null {
  const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(
    (url) => !/:53(\?|$)/.test(url)
  );
  return urls.length > 0 ? { ...server, urls } : null;
}

let warnedUnconfigured = false;

/** Test seam: lets the "not configured" warning be logged again. */
export function resetIceWarnings(): void {
  warnedUnconfigured = false;
}

export async function iceConfig(): Promise<IceConfig> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !token) {
    if (!warnedUnconfigured) {
      logger.warn('TURN is not configured; calls between different networks may not connect', {
        hasKeyId: Boolean(keyId),
        hasToken: Boolean(token)
      });
      warnedUnconfigured = true;
    }
    return { iceServers: STUN_ONLY, relay: false, expiresAt: null };
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      }
    );
    if (!response.ok) throw new Error(`Cloudflare TURN answered ${response.status}`);

    const json = (await response.json()) as { iceServers?: IceServer[] };
    const iceServers = (json.iceServers ?? []).map(withoutPort53).filter((server): server is IceServer => !!server);
    const relay = iceServers.some((server) => server.username && server.credential);
    if (!relay) throw new Error('Cloudflare TURN answered without credentials');

    return {
      iceServers,
      relay,
      expiresAt: new Date(Date.now() + CREDENTIAL_TTL_SECONDS * 1000).toISOString()
    };
  } catch (error) {
    logger.warn('Could not get TURN credentials; falling back to STUN', { error: (error as Error).message });
    return { iceServers: STUN_ONLY, relay: false, expiresAt: null };
  }
}
