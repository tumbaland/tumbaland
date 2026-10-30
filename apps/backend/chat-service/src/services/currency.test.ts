import { currencyTools, resetCurrency } from './currency';

const convert = (input: Record<string, unknown>, id = 'c1') => currencyTools(id)[0]!.run(input);
const fetchMock = jest.fn();
const answer = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce({ ok: status === 200, status, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as never;
  resetCurrency();
});

it('converts at the ECB rate and says the date, and that a card will differ', async () => {
  answer({ amount: 84.5, base: 'USD', date: '2026-10-29', rates: { EUR: 77.123 } });
  const text = await convert({ amount: 84.5, from: 'usd', to: 'eur' });
  expect(fetchMock.mock.calls[0]![0]).toBe('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR&amount=84.5');
  expect(text).toBe('84.5 USD = 77.12 EUR (ECB reference rate, 2026-10-29; a card or bank rate will differ a little).');
});

it('asks for the rate on a past day when given one', async () => {
  answer({ date: '2026-08-14', rates: { SEK: 10.5 } });
  await convert({ amount: 1, from: 'EUR', to: 'SEK', date: '2026-08-14' });
  expect(fetchMock.mock.calls[0]![0]).toContain('/v1/2026-08-14?');
});

it('answers the same currency without asking', async () => {
  expect(await convert({ amount: 5, from: 'EUR', to: 'eur' })).toBe('5 EUR is 5 EUR.');
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  [{ amount: 'lots', from: 'EUR', to: 'USD' }, /as a number/],
  [{ amount: -1, from: 'EUR', to: 'USD' }, /as a number/],
  [{ amount: 5, from: 'euro', to: 'USD' }, /three-letter codes/],
  [{ amount: 5, from: 'EUR', to: 'USD', date: 'yesterday' }, /YYYY-MM-DD/],
  [{ amount: 5, from: 'EUR', to: 'USD', date: '2026-02-31' }, /real day/]
])('refuses %o without asking', async (input, message) => {
  expect(await convert(input)).toMatch(message);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('says when the ECB has no rate, and when the service does not answer', async () => {
  answer({}, 404);
  expect(await convert({ amount: 5, from: 'EUR', to: 'XXX' })).toMatch(/No rate for EUR to XXX/);
  answer({}, 503);
  expect(await convert({ amount: 5, from: 'EUR', to: 'USD' })).toMatch(/web search/);
});

it('stops one chat at 30 an hour', async () => {
  for (let i = 0; i < 30; i++) {
    answer({ date: 'd', rates: { USD: 1 } });
    await convert({ amount: i + 1, from: 'EUR', to: 'USD' });
  }
  expect(await convert({ amount: 99, from: 'EUR', to: 'USD' })).toMatch(/30 times this hour/);
});
