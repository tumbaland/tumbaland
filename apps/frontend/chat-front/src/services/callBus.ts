import type { CallPerson } from '../types';

/**
 * How a thread's call button reaches the call engine.
 *
 * The engine lives in `CallHost`, which the shell mounts once for the whole
 * app so a call survives moving between pages. The thread is loaded as a
 * different federated module, so the two do not share a React tree to put a
 * context in. A window event crosses that boundary and needs nothing shared.
 */

const CALL_REQUEST = 'tumbaland:call';

export interface CallRequest {
  conversationId: string;
  /** Who is being called, so the screen can show them before the server answers. */
  peer?: CallPerson;
}

export function requestCall(request: CallRequest): void {
  window.dispatchEvent(new CustomEvent<CallRequest>(CALL_REQUEST, { detail: request }));
}

export function onCallRequest(handler: (request: CallRequest) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<CallRequest>).detail);
  window.addEventListener(CALL_REQUEST, listener);
  return () => window.removeEventListener(CALL_REQUEST, listener);
}
