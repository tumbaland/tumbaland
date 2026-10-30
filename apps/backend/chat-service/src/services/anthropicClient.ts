import Anthropic from '@anthropic-ai/sdk';

/**
 * The one place a Claude client is built, so a test replaces this module and
 * nothing in the service ever reaches the network.
 *
 * One retry, not the SDK's two: a reply someone is waiting on in a chat is
 * worth one more try, and not worth a minute of them. The timeout covers a
 * request in which Claude makes several tool calls into Tumbaland.
 */
export function createAnthropic(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 170_000 });
}
