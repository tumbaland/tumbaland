jest.mock('../models/Transaction', () => ({
  __esModule: true,
  default: { find: jest.fn(), bulkWrite: jest.fn(), insertMany: jest.fn() }
}));

jest.mock('../models/CategoryRule', () => ({
  __esModule: true,
  default: { find: jest.fn() }
}));

jest.mock('../models/StatementSettings', () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

import Transaction from '../models/Transaction';
import CategoryRule from '../models/CategoryRule';
import { importPensionStatement } from './pensionImport.service';

const mockedFind = Transaction.find as unknown as jest.Mock;
const mockedBulkWrite = Transaction.bulkWrite as unknown as jest.Mock;
const mockedInsertMany = Transaction.insertMany as unknown as jest.Mock;
const mockedRuleFind = CategoryRule.find as unknown as jest.Mock;

/** The categorisation rules this owner has taught the app. */
const withRules = (
  rules: Array<{ pattern: string; category: string; type?: string; matchType?: string }>
) =>
  mockedRuleFind.mockReturnValue({ sort: jest.fn().mockResolvedValue(rules) });

beforeEach(() => {
  jest.clearAllMocks();
  withRules([]);
  mockedBulkWrite.mockResolvedValue({});
});

describe('importPensionStatement', () => {
  const PENSION_HEADER =
    'Väärtpaberi/ raha konto nimi,Sammas,Kande kuupäev,Põhjus,Kande liik,Kommentaar,' +
    'Valuuta,Hind,Kogus/ Summa,Saldo,Osaku puhasväärtus,NAV kuupäev';

  const contribution = (pillar: 'STEP_2' | 'STEP_3', date: string, price: string, units: string) =>
    `Fund,${pillar},${date},1,Osakute märkimine,,EUR,${price},${units},0,${price},2026-01-14`;

  const pensionFile = (...rows: string[]) => [PENSION_HEADER, ...rows].join('\r\n');
  /** 1.00 × 607 keeps the arithmetic out of the way of what is being tested. */
  const ii = (date = '15.01.2026', amount = '607') => contribution('STEP_2', date, '1.00', amount);
  const iii = (date = '05.01.2026', amount = '2000') => contribution('STEP_3', date, '1.00', amount);

  /** What the database already holds over the period the file covers. */
  const held = (rows: Array<Record<string, unknown>>) =>
    mockedFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) });

  const options = { userId: 'u1', userGroups: [] as string[] };

  beforeEach(() => {
    mockedInsertMany.mockResolvedValue([]);
    held([]);
  });

  it('writes a II pillar contribution as a pair', async () => {
    // It never touches a bank account, so the outgoing leg alone would show
    // money leaving somewhere that never received it
    await importPensionStatement(pensionFile(ii()), options);

    const written = mockedInsertMany.mock.calls[0][0];
    expect(written).toHaveLength(2);
    expect(written[0]).toMatchObject({ type: 'expense', category: 'Pension', amount: 607 });
    expect(written[1]).toMatchObject({ type: 'income', category: 'Salary', amount: 607 });
  });

  it('does not give a III pillar contribution a gross-pay leg', async () => {
    // It was paid out of money that already arrived as income
    await importPensionStatement(pensionFile(iii()), options);

    const written = mockedInsertMany.mock.calls[0][0];
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ type: 'expense', category: 'Pension' });
  });

  it('leaves a III pillar contribution alone when the bank transfer is already held', async () => {
    held([{ _id: 'a', type: 'expense', amount: 2000, date: new Date('2026-01-02'), externalId: 'RO1' }]);

    const result = await importPensionStatement(pensionFile(iii('05.01.2026', '2000')), options);

    expect(result.coveredByBank).toBe(1);
    expect(result.imported).toBe(0);
    expect(mockedInsertMany).not.toHaveBeenCalled();
  });

  it('imports a III pillar contribution the bank never saw', async () => {
    // Paid from an account the statements do not cover
    held([{ _id: 'a', type: 'expense', amount: 999, date: new Date('2026-01-02'), externalId: 'RO1' }]);

    const result = await importPensionStatement(pensionFile(iii()), options);

    expect(result.imported).toBe(1);
  });

  it('will not let one bank transfer excuse two contributions', async () => {
    held([{ _id: 'a', type: 'expense', amount: 2000, date: new Date('2026-01-05'), externalId: 'RO1' }]);

    const result = await importPensionStatement(
      pensionFile(iii('05.01.2026', '2000'), iii('06.01.2026', '2000')),
      options
    );

    expect(result.coveredByBank).toBe(1);
    expect(result.imported).toBe(1);
  });

  it('does not treat a transfer weeks away as the one that paid for it', async () => {
    held([{ _id: 'a', type: 'expense', amount: 2000, date: new Date('2025-11-01'), externalId: 'RO1' }]);

    const result = await importPensionStatement(pensionFile(iii()), options);

    expect(result.coveredByBank).toBe(0);
  });

  it('does not mistake an earlier pension import for the bank transfer', async () => {
    // A previously imported II pillar pair would otherwise make a III pillar
    // contribution of the same size look already paid
    held([
      { _id: 'a', type: 'expense', amount: 2000, date: new Date('2026-01-05'), externalId: 'pension:II:2026-01-05:2000' }
    ]);

    const result = await importPensionStatement(pensionFile(iii()), options);

    expect(result.coveredByBank).toBe(0);
    expect(result.imported).toBe(1);
  });

  it('recognises what it already imported instead of doubling it', async () => {
    held([{ _id: 'a', type: 'expense', amount: 607, date: new Date('2026-01-15'), externalId: 'pension:II:2026-01-15:607' }]);

    const result = await importPensionStatement(pensionFile(ii()), options);

    expect(result.duplicates).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('reports each pillar and what was done with it', async () => {
    const result = await importPensionStatement(pensionFile(ii(), iii()), options);

    expect(result.byPillar).toEqual([
      { pillar: 'II', count: 1, amount: 607, action: expect.stringContaining('never appears') },
      { pillar: 'III', count: 1, amount: 2000, action: expect.stringContaining('bank transfer') }
    ]);
  });

  it('reports the period the file covered', async () => {
    const result = await importPensionStatement(pensionFile(ii('15.01.2026'), ii('14.07.2026')), options);

    expect(result.period).toEqual({ from: '2026-01-15', to: '2026-07-14' });
  });

  it('refuses a statement with no contributions in it', async () => {
    await expect(importPensionStatement(pensionFile(), options)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('refuses to write into a group the caller is not in', async () => {
    await expect(
      importPensionStatement(pensionFile(ii()), { userId: 'u1', groupId: 'g9', userGroups: ['g1'] })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('stamps the group on what it writes', async () => {
    await importPensionStatement(pensionFile(ii()), {
      userId: 'u1', groupId: 'g1', userGroups: ['g1']
    });

    expect(mockedInsertMany.mock.calls[0][0][0]).toMatchObject({ userId: 'u1', groupId: 'g1' });
  });
});
