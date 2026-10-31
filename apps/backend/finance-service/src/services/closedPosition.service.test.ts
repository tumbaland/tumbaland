jest.mock('../models/Trade', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('../models/Holding', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('../models/TrackedTicker', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('./fxRate.service', () => ({ BASE_CURRENCY: 'EUR', getRates: jest.fn() }));

import Trade from '../models/Trade';
import Holding from '../models/Holding';
import TrackedTicker from '../models/TrackedTicker';
import { getRates } from './fxRate.service';
import { getClosedPositions } from './closedPosition.service';

const lean = <T,>(value: T) => ({ lean: jest.fn().mockResolvedValue(value) });
const tradesAre = (trades: object[]) =>
  (Trade.find as unknown as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnValue(lean(trades)) });
const holdingsAre = (tickers: string[]) =>
  (Holding.find as unknown as jest.Mock).mockReturnValue(lean(tickers.map((ticker) => ({ ticker }))));
const trackedAre = (tracked: object[]) => (TrackedTicker.find as unknown as jest.Mock).mockReturnValue(lean(tracked));

const trade = (over: object) => ({ quantity: 0, price: 0, amount: 0, fees: 0, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  (getRates as jest.Mock).mockResolvedValue(new Map([['USD', 0.9]]));
  holdingsAre([]);
  trackedAre([{ ticker: 'ZPRR.DEX', displayName: 'SPDR Russell 2000', currency: 'EUR' }]);
});

describe('closed positions', () => {
  it('reports what a sold-out position made, in gain and in dividends', async () => {
    tradesAre([
      trade({ ticker: 'ZPRR.DEX', type: 'buy', date: new Date('2023-07-14'), quantity: 200, price: 49.89 }),
      trade({ ticker: 'ZPRR.DEX', type: 'dividend', date: new Date('2024-03-01'), amount: 30 }),
      trade({ ticker: 'ZPRR.DEX', type: 'sell', date: new Date('2025-01-02'), quantity: 200, price: 61.9 })
    ]);

    const [position] = await getClosedPositions('u1');

    expect(position).toMatchObject({
      ticker: 'ZPRR.DEX',
      displayName: 'SPDR Russell 2000',
      firstTradeDate: '2023-07-14',
      closedDate: '2025-01-02',
      tradeCount: 3,
      missingFxRate: false
    });
    expect(position.bought).toBeCloseTo(9978, 2);
    expect(position.proceeds).toBeCloseTo(12380, 2);
    expect(position.realizedGain).toBeCloseTo(2402, 2);
    expect(position.dividends).toBe(30);
    expect(position.totalReturn).toBeCloseTo(2432, 2);
  });

  it('leaves out a position that is still held', async () => {
    tradesAre([
      trade({ ticker: 'VUSA.DEX', type: 'buy', date: new Date('2023-02-09'), quantity: 35, price: 72.8 }),
      trade({ ticker: 'VUSA.DEX', type: 'sell', date: new Date('2023-03-09'), quantity: 35, price: 75 })
    ]);
    holdingsAre(['VUSA.DEX']);

    expect(await getClosedPositions('u1')).toEqual([]);
  });

  it('leaves out one only partly sold, and one that only ever paid a dividend', async () => {
    tradesAre([
      trade({ ticker: 'A.DEX', type: 'buy', date: new Date('2023-01-01'), quantity: 10, price: 5 }),
      trade({ ticker: 'A.DEX', type: 'sell', date: new Date('2023-02-01'), quantity: 4, price: 6 }),
      trade({ ticker: 'B.DEX', type: 'dividend', date: new Date('2023-02-01'), amount: 3 })
    ]);

    expect(await getClosedPositions('u1')).toEqual([]);
  });

  it('lists the most recently sold first', async () => {
    tradesAre([
      trade({ ticker: 'OLD.DEX', type: 'buy', date: new Date('2020-01-01'), quantity: 1, price: 10 }),
      trade({ ticker: 'OLD.DEX', type: 'sell', date: new Date('2021-01-01'), quantity: 1, price: 12 }),
      trade({ ticker: 'NEW.DEX', type: 'buy', date: new Date('2023-01-01'), quantity: 1, price: 10 }),
      trade({ ticker: 'NEW.DEX', type: 'sell', date: new Date('2024-01-01'), quantity: 1, price: 11 })
    ]);

    expect((await getClosedPositions('u1')).map((p) => p.ticker)).toEqual(['NEW.DEX', 'OLD.DEX']);
  });

  it('converts a foreign-currency position into the base currency', async () => {
    trackedAre([{ ticker: 'US.DEX', displayName: 'US fund', currency: 'USD' }]);
    tradesAre([
      trade({ ticker: 'US.DEX', type: 'buy', date: new Date('2023-01-01'), quantity: 10, price: 10 }),
      trade({ ticker: 'US.DEX', type: 'sell', date: new Date('2023-06-01'), quantity: 10, price: 20 })
    ]);

    const [position] = await getClosedPositions('u1');

    expect(position.realizedGain).toBeCloseTo(90, 6); // 100 USD * 0.9
  });

  it('leaves the money out, not wrong, when there is no exchange rate', async () => {
    (getRates as jest.Mock).mockResolvedValue(new Map());
    trackedAre([{ ticker: 'US.DEX', displayName: 'US fund', currency: 'USD' }]);
    tradesAre([
      trade({ ticker: 'US.DEX', type: 'buy', date: new Date('2023-01-01'), quantity: 10, price: 10 }),
      trade({ ticker: 'US.DEX', type: 'sell', date: new Date('2023-06-01'), quantity: 10, price: 20 })
    ]);

    const [position] = await getClosedPositions('u1');

    expect(position.missingFxRate).toBe(true);
    expect(position.realizedGain).toBeUndefined();
  });

  it('does no further lookups when nothing is closed', async () => {
    tradesAre([]);

    expect(await getClosedPositions('u1')).toEqual([]);
    expect(TrackedTicker.find).not.toHaveBeenCalled();
  });
});
