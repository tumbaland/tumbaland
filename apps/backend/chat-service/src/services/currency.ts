import { logger } from '@tumbaland/backend-core';
import type { ClientTool } from './assistantClaude';
import { hourlyLimit } from './hourlyLimit';

/**
 * Money in one currency as another, at the European Central Bank's rates, from
 * Frankfurter. Free, and no key. The ECB sets its rates once on a working day,
 * so this is a reference rate, not what a card or a bank will charge.
 */

const TIMEOUT_MS = 8_000;
const CODE = /^[A-Z]{3}$/;
/** Whether a YYYY-MM-DD names a real day: Date.parse takes 2026-02-31 and makes it 3 March. */
const isRealDay = (day: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

const limit = hourlyLimit(30, 'Currencies have been converted 30 times this hour in this chat. Answer from what was found.');
export const resetCurrency = (): void => limit.reset();

export function currencyTools(conversationId: string): ClientTool[] {
  return [
    {
      name: 'convert_currency',
      description:
        'Convert an amount from one currency to another at the European Central Bank\'s reference rate, for a trip or a price abroad. ' +
        'Currencies as three-letter codes (EUR, USD, SEK, GBP). It is not what a card or a bank will charge: say so for money that matters.',
      input_schema: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'How much, e.g. 84.5' },
          from: { type: 'string', description: 'The currency it is in, e.g. USD' },
          to: { type: 'string', description: 'The currency wanted, e.g. EUR' },
          date: { type: 'string', description: 'YYYY-MM-DD, for the rate on a past day. The latest when left out.' }
        },
        required: ['amount', 'from', 'to']
      },
      run: async (raw) => {
        const input = raw as { amount?: unknown; from?: unknown; to?: unknown; date?: unknown };
        const amount = Number(input.amount);
        const from = String(input.from ?? '').trim().toUpperCase();
        const to = String(input.to ?? '').trim().toUpperCase();
        if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) return 'Give an amount as a number.';
        if (!CODE.test(from) || !CODE.test(to)) return 'Give currencies as three-letter codes, such as EUR or USD.';
        if (input.date !== undefined && !isRealDay(String(input.date))) return 'The date must be a real day, written YYYY-MM-DD.';
        if (from === to) return `${amount} ${from} is ${amount} ${to}.`;

        try {
          limit.take(conversationId);
        } catch (error) {
          return (error as Error).message;
        }
        const url = `https://api.frankfurter.dev/v1/${input.date ? String(input.date) : 'latest'}?${new URLSearchParams({ base: from, symbols: to, amount: String(amount) })}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch((error: Error) => {
          logger.warn('Currency request failed', { error: error.message });
          return null;
        });
        if (response?.status === 404 || response?.status === 422) return `No rate for ${from} to ${to}${input.date ? ` on ${String(input.date)}` : ''}. The ECB covers about 30 major currencies.`;
        if (!response?.ok) return 'The currency service is not answering right now. Use the web search instead.';

        const body = (await response.json().catch(() => null)) as { date?: string; rates?: Record<string, number> } | null;
        const result = body?.rates?.[to];
        if (result === undefined) return `No rate for ${from} to ${to}. The ECB covers about 30 major currencies.`;
        return `${amount} ${from} = ${result.toFixed(2)} ${to} (ECB reference rate, ${body?.date ?? 'latest'}; a card or bank rate will differ a little).`;
      }
    }
  ];
}
