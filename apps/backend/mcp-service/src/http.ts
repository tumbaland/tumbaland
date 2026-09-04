import { requireEnv } from '@tumbaland/backend-core';

/**
 * The HTTP layer every domain client shares.
 *
 * Lifted out of the relationship client when finance arrived: the transport,
 * the envelope, the error shape and — most of all — the decision to forward the
 * caller's own credential rather than exchange it for a service token are true
 * of every service, and two copies of that reasoning would be two places for it
 * to drift.
 */

/** An API error the model can act on, rather than a stack trace. */
export class TumbalandError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'TumbalandError';
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}


/** One service's base URL, preferring the internal address inside the network. */
export const serviceUrl = (name: string): string =>
  (process.env[`${name}_INTERNAL_URL`] || requireEnv(`${name}_API_URL`)).replace(/\/$/, '');

/**
 * One call against a Tumbaland service, carrying the caller's credential.
 *
 * The credential is passed straight through rather than exchanged for a service
 * token: that keeps the request scoped to exactly what the user granted, so a
 * read-only key cannot be widened by passing through this hop.
 */
export async function callService<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${baseUrl}/api${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let parsed: Envelope<T> | undefined;
  try {
    parsed = text ? (JSON.parse(text) as Envelope<T>) : undefined;
  } catch {
    // A non-JSON body means something in front of the service answered — a
    // proxy, a gateway. The status is the only trustworthy part.
  }

  if (!response.ok) {
    throw new TumbalandError(
      parsed?.message || `Request failed with status ${response.status}`,
      response.status
    );
  }

  return (parsed?.data ?? parsed) as T;
}
