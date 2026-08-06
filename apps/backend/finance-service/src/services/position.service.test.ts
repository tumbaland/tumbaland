import { derivePosition, quantityHeld, EMPTY_POSITION, TradeLike } from './position.service';

const buy = (date: string, quantity: number, price: number, fees = 0): TradeLike => ({
  type: 'buy',
  date: new Date(date),
  quantity,
  price,
  amount: 0,
  fees
});

const sell = (date: string, quantity: number, price: number, fees = 0): TradeLike => ({
  type: 'sell',
  date: new Date(date),
  quantity,
  price,
  amount: 0,
  fees
});

const dividend = (date: string, amount: number): TradeLike => ({
  type: 'dividend',
  date: new Date(date),
  quantity: 0,
  price: 0,
  amount,
  fees: 0
});

const fee = (date: string, amount: number): TradeLike => ({
  type: 'fee',
  date: new Date(date),
  quantity: 0,
  price: 0,
  amount,
  fees: 0
});

describe('derivePosition', () => {
  it('returns an empty position for no trades', () => {
    expect(derivePosition([])).toEqual(EMPTY_POSITION);
  });

  it('accumulates buys into a quantity and average cost', () => {
    const position = derivePosition([buy('2024-01-01', 10, 100), buy('2024-02-01', 10, 200)]);

    expect(position.quantity).toBe(20);
    expect(position.avgBuyPrice).toBe(150);
    expect(position.costBasis).toBe(3000);
    expect(position.netInvested).toBe(3000);
  });

  it('folds purchase fees into the cost basis', () => {
    const position = derivePosition([buy('2024-01-01', 10, 100, 20)]);

    expect(position.costBasis).toBe(1020);
    expect(position.avgBuyPrice).toBe(102);
    expect(position.fees).toBe(20);
  });

  it('realizes gain on a sell against the average cost at that time', () => {
    // 20 shares at an average of 150; sell 10 at 200 → 500 realized
    const position = derivePosition([
      buy('2024-01-01', 10, 100),
      buy('2024-02-01', 10, 200),
      sell('2024-03-01', 10, 200)
    ]);

    expect(position.realizedGain).toBe(500);
    expect(position.quantity).toBe(10);
    expect(position.costBasis).toBe(1500);
    // The average cost of what remains is unchanged by a sale
    expect(position.avgBuyPrice).toBe(150);
  });

  it('subtracts sale fees from the proceeds, not from the basis', () => {
    const position = derivePosition([buy('2024-01-01', 10, 100), sell('2024-02-01', 10, 120, 30)]);

    // (10 x 120 − 30) − 1000
    expect(position.realizedGain).toBe(170);
    expect(position.fees).toBe(30);
  });

  it('realizes a loss when sold below average cost', () => {
    const position = derivePosition([buy('2024-01-01', 10, 100), sell('2024-02-01', 5, 80)]);

    expect(position.realizedGain).toBe(-100);
    expect(position.quantity).toBe(5);
  });

  it('closes the position cleanly when everything is sold', () => {
    const position = derivePosition([buy('2024-01-01', 10, 100), sell('2024-02-01', 10, 130)]);

    expect(position.quantity).toBe(0);
    expect(position.costBasis).toBe(0);
    expect(position.avgBuyPrice).toBe(0);
    expect(position.realizedGain).toBe(300);
    // 1300 came back out against 1000 put in
    expect(position.netInvested).toBe(-300);
  });

  it('replays in date order regardless of the order supplied', () => {
    const inOrder = derivePosition([buy('2024-01-01', 10, 100), sell('2024-02-01', 5, 200)]);
    const shuffled = derivePosition([sell('2024-02-01', 5, 200), buy('2024-01-01', 10, 100)]);

    expect(shuffled).toEqual(inOrder);
  });

  it('clamps a sell of more than is held rather than going negative', () => {
    // Selling 15 of 10 held: only 10 shares' worth of cost can be relieved.
    const position = derivePosition([buy('2024-01-01', 10, 100), sell('2024-02-01', 15, 100)]);

    expect(position.quantity).toBe(0);
    expect(position.costBasis).toBe(0);
    // Proceeds of 1500 against a basis of 1000
    expect(position.realizedGain).toBe(500);
  });

  it('treats a sell with nothing held as pure proceeds', () => {
    const position = derivePosition([sell('2024-01-01', 5, 50)]);

    expect(position.quantity).toBe(0);
    expect(position.realizedGain).toBe(250);
  });

  it('counts dividends as income without touching the cost basis', () => {
    const position = derivePosition([buy('2024-01-01', 10, 100), dividend('2024-02-01', 45)]);

    expect(position.dividends).toBe(45);
    expect(position.costBasis).toBe(1000);
    expect(position.avgBuyPrice).toBe(100);
    expect(position.realizedGain).toBe(0);
    // Cash returned reduces what the position has cost overall
    expect(position.netInvested).toBe(955);
  });

  it('charges a standalone fee against realized gain', () => {
    const position = derivePosition([buy('2024-01-01', 10, 100), fee('2024-02-01', 12)]);

    expect(position.fees).toBe(12);
    expect(position.realizedGain).toBe(-12);
    expect(position.costBasis).toBe(1000);
    expect(position.netInvested).toBe(1012);
  });

  it('reports how many trades made up the position', () => {
    expect(derivePosition([buy('2024-01-01', 1, 1), dividend('2024-02-01', 1)]).tradeCount).toBe(2);
  });

  it('handles a full round trip with fees and dividends', () => {
    const position = derivePosition([
      buy('2024-01-01', 100, 10, 5), // basis 1005
      dividend('2024-03-01', 30),
      sell('2024-06-01', 50, 15, 5), // proceeds 745, cost relieved 502.5
      fee('2024-07-01', 10)
    ]);

    expect(position.quantity).toBe(50);
    expect(position.costBasis).toBeCloseTo(502.5, 6);
    expect(position.avgBuyPrice).toBeCloseTo(10.05, 6);
    expect(position.realizedGain).toBeCloseTo(745 - 502.5 - 10, 6);
    expect(position.dividends).toBe(30);
    expect(position.fees).toBe(20);
  });

  it('does not leave float dust on a fully closed position', () => {
    const position = derivePosition([
      buy('2024-01-01', 0.1, 3),
      buy('2024-02-01', 0.2, 7),
      sell('2024-03-01', 0.30000000000000004, 9)
    ]);

    expect(position.quantity).toBe(0);
    expect(position.costBasis).toBe(0);
  });
});

describe('quantityHeld', () => {
  it('reports the shares remaining after a replay', () => {
    expect(quantityHeld([buy('2024-01-01', 10, 100), sell('2024-02-01', 4, 100)])).toBe(6);
  });

  it('is zero with no trades', () => {
    expect(quantityHeld([])).toBe(0);
  });
});
