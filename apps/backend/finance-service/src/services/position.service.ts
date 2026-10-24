import { ITrade } from '../models/Trade';

/** The running state of a position after replaying its trades. */
export interface Position {
  quantity: number;
  /** Average cost per remaining share, fees included. */
  avgBuyPrice: number;
  /** What the remaining shares cost in total. */
  costBasis: number;
  /** Profit or loss actually crystallised by sells, net of fees. */
  realizedGain: number;
  /** Dividend income received, which is not part of cost basis. */
  dividends: number;
  /** Every fee paid, whether attached to a trade or standalone. */
  fees: number;
  /** Cash put in minus cash taken out — what the position has actually cost. */
  netInvested: number;
  tradeCount: number;
}

export const EMPTY_POSITION: Position = {
  quantity: 0,
  avgBuyPrice: 0,
  costBasis: 0,
  realizedGain: 0,
  dividends: 0,
  fees: 0,
  netInvested: 0,
  tradeCount: 0
};

/** Anything with the shape the replay needs, so callers can pass plain objects. */
export type TradeLike = Pick<ITrade, 'type' | 'date' | 'quantity' | 'price' | 'amount' | 'fees'>;

/**
 * Replay a ticker's trades into a position, using **average cost**.
 *
 * Average cost rather than FIFO lots: it matches the `avgBuyPrice` the rest of
 * the service already reports, and it makes a sell's realized gain independent
 * of which lot the user believes they sold. FIFO would be needed for
 * jurisdiction-accurate tax lots — a separate report, not a different position.
 *
 * Trades are sorted here rather than trusted in order, because an edit can move
 * a trade's date and a caller may hand us whatever the query returned.
 */
export function derivePosition(trades: TradeLike[]): Position {
  const ordered = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let quantity = 0;
  let costBasis = 0;
  let realizedGain = 0;
  let dividends = 0;
  let fees = 0;
  let netInvested = 0;

  for (const trade of ordered) {
    const tradeFees = trade.fees || 0;

    if (trade.type === 'buy') {
      const cost = trade.quantity * trade.price + tradeFees;
      quantity += trade.quantity;
      costBasis += cost;
      netInvested += cost;
      fees += tradeFees;
      continue;
    }

    if (trade.type === 'sell') {
      // Selling more than is held would drive the basis negative. Clamp to the
      // position on hand: the surplus has no cost to relieve, so it is pure
      // gain, and the position lands at zero rather than at a negative holding.
      const sold = Math.min(trade.quantity, quantity);
      const avgCost = quantity > 0 ? costBasis / quantity : 0;
      const costOfSold = avgCost * sold;
      const proceeds = trade.quantity * trade.price - tradeFees;

      realizedGain += proceeds - costOfSold;
      quantity -= sold;
      costBasis -= costOfSold;
      netInvested -= proceeds;
      fees += tradeFees;

      // Float drift can leave a whisker of basis on a fully closed position.
      if (quantity <= 0) {
        quantity = 0;
        costBasis = 0;
      }
      continue;
    }

    if (trade.type === 'dividend') {
      // Income, not a return of capital: it does not reduce the cost basis.
      dividends += trade.amount;
      netInvested -= trade.amount;
      continue;
    }

    // fee: a standalone charge (custody, FX, account) with no share movement
    fees += trade.amount;
    realizedGain -= trade.amount;
    netInvested += trade.amount;
  }

  return {
    quantity,
    avgBuyPrice: quantity > 0 ? costBasis / quantity : 0,
    costBasis,
    realizedGain,
    dividends,
    fees,
    netInvested,
    tradeCount: ordered.length
  };
}
