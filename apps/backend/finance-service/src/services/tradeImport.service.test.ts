jest.mock('../models/Trade', () => ({
  __esModule: true,
  default: { find: jest.fn(), distinct: jest.fn(), bulkWrite: jest.fn() }
}));
jest.mock('../models/Holding', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('../models/TrackedTicker', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('./trade.service', () => ({ syncHoldingFromTrades: jest.fn() }));

import Trade from '../models/Trade';
import Holding from '../models/Holding';
import TrackedTicker from '../models/TrackedTicker';
import { syncHoldingFromTrades } from './trade.service';
import type { StatementRow } from './bankStatement.service';
import { importTrades, parseSettlement, parseDividendIsin, TradeRow } from './tradeImport.service';

const lean = <T,>(value: T) => ({ lean: jest.fn().mockResolvedValue(value) });
const mockedTrackedFind = TrackedTicker.find as unknown as jest.Mock;
const mockedHoldingFind = Holding.find as unknown as jest.Mock;
const mockedDistinct = Trade.distinct as unknown as jest.Mock;
const mockedTradeFind = Trade.find as unknown as jest.Mock;
const mockedBulkWrite = Trade.bulkWrite as unknown as jest.Mock;
const mockedSync = syncHoldingFromTrades as jest.Mock;

const OPTIONS = { userId: 'u1' };

const row = (over: Partial<StatementRow> = {}): StatementRow => ({
  account: 'EE59',
  date: new Date('2026-09-14T00:00:00Z'),
  dateText: '14.09.2026',
  counterpartyAccount: '',
  counterparty: 'SEB',
  direction: 'expense',
  amount: 3970,
  externalId: 'R1',
  description: 'DLA1164839/EXUS GY/100/39.7/Ost/ Saksamaa börsid',
  currency: 'EUR',
  ...over
});

const settlement = (over: Partial<StatementRow> = {}): TradeRow => ({ kind: 'security', row: row(over) });
const dividend = (over: Partial<StatementRow> = {}): TradeRow => ({
  kind: 'dividend',
  row: row({
    direction: 'income',
    amount: 18.4,
    externalId: 'D1',
    date: new Date('2026-07-01T00:00:00Z'),
    description: 'Vanguard,IE00B3XXRP09,dividendimakse,.28,01.07.26,IE',
    ...over
  })
});

/** What the database holds: tracked tickers, hand-entered holdings and the existing log. */
const database = (
  opts: { tracked?: Array<{ ticker: string; isin?: string }>; holdings?: string[]; trades?: object[] } = {}
) => {
  const trades = opts.trades ?? [];
  mockedTrackedFind.mockReturnValue(lean(opts.tracked ?? [{ ticker: 'EXUS.DEX' }, { ticker: 'VUSA.DEX', isin: 'IE00B3XXRP09' }]));
  mockedHoldingFind.mockReturnValue(lean((opts.holdings ?? ['EXUS.DEX', 'VUSA.DEX']).map((ticker) => ({ ticker }))));
  mockedDistinct.mockResolvedValue([...new Set(trades.map((t) => (t as { ticker: string }).ticker))]);
  mockedTradeFind.mockReturnValue(lean(trades));
};

const written = () => mockedBulkWrite.mock.calls[0]?.[0] ?? [];

beforeEach(() => {
  jest.clearAllMocks();
  mockedBulkWrite.mockResolvedValue({});
  database();
});

describe('reading a settlement', () => {
  it('reads symbol, quantity, price and side, with an exchange code or without', () => {
    expect(parseSettlement('DLA1164839/EXUS GY/100/39.7/Ost/ Saksamaa börsid')).toEqual({
      symbol: 'EXUS', type: 'buy', quantity: 100, price: 39.7
    });
    expect(parseSettlement('DL99975570/VWCE/25/128.96/Buy/ Saksamaa')).toMatchObject({ symbol: 'VWCE', type: 'buy' });
    expect(parseSettlement('DL99696396/ZPRR/200/61.9/Sale/ Saksamaa')).toMatchObject({ type: 'sell', quantity: 200 });
  });

  it('reads the Estonian word for a sale', () => {
    expect(parseSettlement('DLA1/VUSA GY/5/70/Müük/ x')).toMatchObject({ type: 'sell' });
  });

  it('refuses a side it does not know rather than guessing a direction', () => {
    expect(parseSettlement('DLA1/VUSA GY/5/70/Swap/ x')).toBeNull();
    expect(parseSettlement('Palgamakse oktoober')).toBeNull();
  });

  it('finds the ISIN a dividend names its fund by', () => {
    expect(parseDividendIsin('Vanguard,IE00B3XXRP09,dividendimakse,.28,15.12.23,IE')).toBe('IE00B3XXRP09');
    expect(parseDividendIsin('dividendimakse, no code')).toBeNull();
  });
});

describe('recording trades', () => {
  it('records a buy under the ticker the symbol belongs to', async () => {
    const result = await importTrades([settlement()], OPTIONS);

    expect(result).toMatchObject({ imported: 1, alreadyRecorded: 0, unmatched: [] });
    expect(written()).toHaveLength(1);
    expect(written()[0].updateOne.filter).toEqual({ userId: 'u1', externalId: 'R1' });
    expect(written()[0].updateOne.update.$setOnInsert).toMatchObject({
      ticker: 'EXUS.DEX', type: 'buy', quantity: 100, price: 39.7, amount: 0, userId: 'u1'
    });
  });

  it('records a dividend as a cash amount under the ticker holding that ISIN', async () => {
    const result = await importTrades([dividend()], OPTIONS);

    expect(result.imported).toBe(1);
    expect(written()[0].updateOne.update.$setOnInsert).toMatchObject({
      ticker: 'VUSA.DEX', type: 'dividend', amount: 18.4, quantity: 0, price: 0
    });
  });

  it('puts a group import in the group', async () => {
    await importTrades([settlement()], { userId: 'u1', groupId: 'g1' });
    expect(written()[0].updateOne.update.$setOnInsert.groupId).toBe('g1');
  });
});

describe('what it cannot place', () => {
  it('lists a dividend whose ISIN no ticker carries, instead of guessing', async () => {
    database({ tracked: [{ ticker: 'VUSA.DEX' }] });

    const result = await importTrades([dividend()], OPTIONS);

    expect(result.imported).toBe(0);
    expect(result.unmatched).toEqual([{ what: 'Dividend for IE00B3XXRP09: no ticker has that ISIN', count: 1 }]);
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('lists a symbol that matches no ticker, or more than one', async () => {
    database({ tracked: [{ ticker: 'VWCE.DEX' }, { ticker: 'VWCE.DE' }], holdings: [] });

    const result = await importTrades(
      [
        settlement({ externalId: 'A', description: 'DL1/ZPRR/200/61.9/Sale/ x' }),
        settlement({ externalId: 'B', description: 'DL2/VWCE/25/128.96/Buy/ x' })
      ],
      OPTIONS
    );

    expect(result.imported).toBe(0);
    expect(result.unmatched.map((u) => u.what)).toEqual([
      'ZPRR: no single tracked ticker or holding matches',
      'VWCE: no single tracked ticker or holding matches'
    ]);
  });

  it('lists a non-EUR row and one with no reference', async () => {
    const result = await importTrades(
      [settlement({ currency: 'USD' }), settlement({ externalId: '' })],
      OPTIONS
    );

    expect(result.unmatched.map((u) => u.what)).toEqual([
      'Not in EUR (USD)',
      'No archive reference — cannot be de-duplicated'
    ]);
  });
});

describe('importing the same statement again', () => {
  it('does not record a trade it already holds by reference', async () => {
    database({ trades: [{ _id: 't1', ticker: 'EXUS.DEX', type: 'buy', date: new Date('2026-09-14'), quantity: 100, price: 39.7, externalId: 'R1' }] });

    const result = await importTrades([settlement()], OPTIONS);

    expect(result).toMatchObject({ imported: 0, alreadyRecorded: 1 });
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('recognises a hand-entered trade by what it says, and stamps it with the reference', async () => {
    database({ trades: [{ _id: 't1', ticker: 'EXUS.DEX', type: 'buy', date: new Date('2026-09-14T09:00:00Z'), quantity: 100, price: 39.7 }] });

    const result = await importTrades([settlement()], OPTIONS);

    expect(result).toMatchObject({ imported: 0, alreadyRecorded: 1 });
    expect(written()).toEqual([{ updateOne: { filter: { _id: 't1' }, update: { $set: { externalId: 'R1' } } } }]);
  });

  it('does not let one hand-entered trade stand in for two identical purchases', async () => {
    database({ trades: [{ _id: 't1', ticker: 'EXUS.DEX', type: 'buy', date: new Date('2026-09-14'), quantity: 100, price: 39.7 }] });

    const result = await importTrades([settlement(), settlement({ externalId: 'R2' })], OPTIONS);

    expect(result).toMatchObject({ imported: 1, alreadyRecorded: 1 });
  });

  it('treats a payout entered by hand a day off as the same payout', async () => {
    database({ trades: [{ _id: 't1', ticker: 'VUSA.DEX', type: 'dividend', date: new Date('2026-07-02'), amount: 18 }] });

    const result = await importTrades([dividend()], OPTIONS);

    expect(result).toMatchObject({ imported: 0, alreadyRecorded: 1 });
  });

  it('does not match a trade that already belongs to another statement row', async () => {
    database({ trades: [{ _id: 't1', ticker: 'EXUS.DEX', type: 'buy', date: new Date('2026-09-14'), quantity: 100, price: 39.7, externalId: 'OTHER' }] });

    const result = await importTrades([settlement()], OPTIONS);

    expect(result.imported).toBe(1);
  });
});

describe('the holding', () => {
  it('follows the log when the ticker already had a trade history', async () => {
    database({ trades: [{ _id: 't1', ticker: 'EXUS.DEX', type: 'buy', date: new Date('2026-08-05'), quantity: 100, price: 40 }] });

    const result = await importTrades([settlement()], OPTIONS);

    expect(mockedSync).toHaveBeenCalledWith('EXUS.DEX', 'u1', [], undefined);
    expect(result.holdingsLeftAlone).toEqual([]);
  });

  it('is left alone when it was entered by hand with no trades behind it', async () => {
    // Replaying only the imported trades would overwrite 600 units with a
    // fraction of them.
    database({ tracked: [{ ticker: 'VWCE.DEX' }], holdings: ['VWCE.DEX'] });

    const result = await importTrades([settlement({ description: 'DL1/VWCE/25/128.96/Buy/ x' })], OPTIONS);

    expect(result.imported).toBe(1);
    expect(mockedSync).not.toHaveBeenCalled();
    expect(result.holdingsLeftAlone).toEqual(['VWCE.DEX']);
  });

  it('is created when the ticker has no holding at all', async () => {
    database({ holdings: [] });

    await importTrades([settlement()], OPTIONS);

    expect(mockedSync).toHaveBeenCalledWith('EXUS.DEX', 'u1', [], undefined);
  });
});
