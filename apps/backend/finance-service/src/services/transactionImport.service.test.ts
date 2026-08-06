jest.mock('../models/Transaction', () => ({
  __esModule: true,
  default: { find: jest.fn(), bulkWrite: jest.fn() }
}));

import Transaction from '../models/Transaction';
import { importStatement } from './transactionImport.service';

const mockedFind = Transaction.find as unknown as jest.Mock;
const mockedBulkWrite = Transaction.bulkWrite as unknown as jest.Mock;

const HEADER =
  'Kliendi konto;Dokumendi number;Kuupäev;Saaja/maksja konto;Saaja/maksja nimi;' +
  'Saaja panga kood;Tüüp;Deebet/Kreedit (D/C);Summa;Viitenumber;Arhiveerimistunnus;' +
  'Selgitus;Teenustasu;Valuuta;Isikukood';

const line = (over: Record<string, string> = {}) => {
  const f = {
    account: 'EE59', doc: 'D1', date: '05.08.2026', cpAccount: '', cp: 'RIMI',
    bank: 'X', type: 'MK', dc: 'D', amount: '15,59', ref: '', archive: 'RO1',
    desc: 'kaart', fee: '0', currency: 'EUR', code: '', ...over
  };
  return [f.account, f.doc, f.date, f.cpAccount, f.cp, f.bank, f.type, f.dc,
    f.amount, f.ref, f.archive, f.desc, f.fee, f.currency, f.code].join(';');
};
const statement = (...rows: string[]) => [HEADER, ...rows].join('\n');

/** Which archive references the database already holds. */
const alreadyHeld = (ids: string[]) =>
  mockedFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(ids.map((externalId) => ({ externalId }))) });

beforeEach(() => {
  jest.clearAllMocks();
  alreadyHeld([]);
  mockedBulkWrite.mockResolvedValue({});
});

describe('rejecting bad input', () => {
  it('refuses an empty file', async () => {
    await expect(importStatement('', { userId: 'u1' })).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('refuses a file that is not an account statement', async () => {
    await expect(importStatement('name,value\nfoo,1', { userId: 'u1' })).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('refuses a statement with a header but no rows', async () => {
    await expect(importStatement(HEADER, { userId: 'u1' })).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      importStatement(statement(line()), { userId: 'u1', groupId: 'g9', userGroups: ['g1'] })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });
});

describe('importing', () => {
  it('writes the rows that are new', async () => {
    const result = await importStatement(statement(line(), line({ archive: 'RO2', cp: 'Circle K' })), {
      userId: 'u1'
    });

    expect(result.imported).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(mockedBulkWrite).toHaveBeenCalled();
  });

  it('stamps the owner and group onto each row', async () => {
    await importStatement(statement(line()), { userId: 'u1', groupId: 'g1', userGroups: ['g1'] });

    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations[0].updateOne.update.$set).toMatchObject({ userId: 'u1', groupId: 'g1' });
  });

  it('upserts on the archive reference, so a race cannot abort the batch', async () => {
    await importStatement(statement(line()), { userId: 'u1' });

    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations[0].updateOne).toMatchObject({
      filter: { userId: 'u1', externalId: 'RO1' },
      upsert: true
    });
  });

  it('reports the period the file covered', async () => {
    const result = await importStatement(
      statement(line({ date: '01.03.2026' }), line({ date: '28.03.2026', archive: 'RO2' })),
      { userId: 'u1' }
    );

    expect(result.period).toEqual({ from: '2026-03-01', to: '2026-03-28' });
  });

  it('groups what it imported by category', async () => {
    const result = await importStatement(
      statement(line(), line({ archive: 'RO2', cp: 'Circle K', amount: '40,00' })),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([
      { category: 'Transport', count: 1, amount: 40 },
      { category: 'Groceries', count: 1, amount: 15.59 }
    ]);
  });
});

describe('overlapping imports', () => {
  it('skips rows already held rather than duplicating them', async () => {
    alreadyHeld(['RO1']);

    const result = await importStatement(statement(line(), line({ archive: 'RO2' })), { userId: 'u1' });

    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(1);
    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations).toHaveLength(1);
    expect(operations[0].updateOne.filter.externalId).toBe('RO2');
  });

  it('writes nothing at all when the whole file is already held', async () => {
    alreadyHeld(['RO1']);

    const result = await importStatement(statement(line()), { userId: 'u1' });

    expect(result).toMatchObject({ imported: 0, duplicates: 1 });
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('looks the references up in one query rather than per row', async () => {
    await importStatement(statement(line(), line({ archive: 'RO2' }), line({ archive: 'RO3' })), {
      userId: 'u1'
    });

    expect(mockedFind).toHaveBeenCalledTimes(1);
    expect(mockedFind.mock.calls[0][0].externalId).toEqual({ $in: ['RO1', 'RO2', 'RO3'] });
  });
});

describe('rows left out', () => {
  it('skips a transfer between own accounts', async () => {
    const result = await importStatement(statement(line({ cp: 'TAHVES TOOMAS' })), { userId: 'u1' });

    expect(result.imported).toBe(0);
    expect(result.skipped['Transfer between your own accounts']).toBe(1);
  });

  it('skips a securities settlement', async () => {
    const result = await importStatement(
      statement(line({ desc: 'DL98687175/VUSA/35/72.8/Buy/ x' })),
      { userId: 'u1' }
    );

    expect(result.skipped['Securities settlement (belongs in the trade log)']).toBe(1);
  });

  it('skips a dividend', async () => {
    const result = await importStatement(
      statement(line({ desc: 'Vanguard,IE00B3XXRP09,dividendimakse,.28,15.12.23,IE' })),
      { userId: 'u1' }
    );

    expect(result.skipped['Dividend (belongs in the trade log)']).toBe(1);
  });

  it('skips a pension contribution', async () => {
    const result = await importStatement(statement(line({ cp: 'PENSIONIKESKUS AS' })), { userId: 'u1' });

    expect(result.skipped['Pension contribution (buys a fund unit, not spending)']).toBe(1);
  });

  it('skips a row with no archive reference, which could not be de-duplicated', async () => {
    const result = await importStatement(statement(line({ archive: '' })), { userId: 'u1' });

    expect(result.skipped['No archive reference — cannot be de-duplicated']).toBe(1);
  });

  it('skips a non-EUR row', async () => {
    const result = await importStatement(statement(line({ currency: 'USD' })), { userId: 'u1' });

    expect(result.skipped['Not in EUR (USD)']).toBe(1);
  });

  it('skips an unreadable amount', async () => {
    const result = await importStatement(statement(line({ amount: 'lots' })), { userId: 'u1' });

    expect(result.skipped['Unreadable or zero amount']).toBe(1);
  });

  it('skips an unreadable date', async () => {
    const result = await importStatement(statement(line({ date: 'yesterday' })), { userId: 'u1' });

    expect(result.skipped['Unreadable date "yesterday"']).toBe(1);
  });

  it('returns early, without querying, when nothing survives', async () => {
    const result = await importStatement(statement(line({ cp: 'TAHVES TOOMAS' })), { userId: 'u1' });

    expect(mockedFind).not.toHaveBeenCalled();
    expect(result.categories).toEqual([]);
  });
});
