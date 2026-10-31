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

jest.mock('./tradeImport.service', () => ({
  importTrades: jest.fn().mockResolvedValue({ imported: 0, alreadyRecorded: 0, unmatched: [], holdingsLeftAlone: [] }),
  EMPTY_TRADE_IMPORT: { imported: 0, alreadyRecorded: 0, unmatched: [], holdingsLeftAlone: [] }
}));

import Transaction from '../models/Transaction';
import { importTrades } from './tradeImport.service';
import CategoryRule from '../models/CategoryRule';
import StatementSettings from '../models/StatementSettings';
import { importStatement, detectFormat } from './transactionImport.service';

const mockedFind = Transaction.find as unknown as jest.Mock;
const mockedBulkWrite = Transaction.bulkWrite as unknown as jest.Mock;
const mockedRuleFind = CategoryRule.find as unknown as jest.Mock;
const mockedSettingsFind = StatementSettings.findOne as unknown as jest.Mock;

/** How this owner's name appears on their statements. */
const withOwnerNames = (ownerNames: string[]) =>
  mockedSettingsFind.mockReturnValue({ lean: jest.fn().mockResolvedValue({ ownerNames }) });

/** The categorisation rules this owner has taught the app. */
const withRules = (
  rules: Array<{ pattern: string; category: string; type?: string; matchType?: string }>
) =>
  mockedRuleFind.mockReturnValue({ sort: jest.fn().mockResolvedValue(rules) });

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
  withRules([]);
  withOwnerNames(['ALEX SMITH', 'SMITH ALEX']);
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
    expect(operations[0].updateOne.update.$setOnInsert).toMatchObject({ userId: 'u1', groupId: 'g1' });
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
    withRules([
      { pattern: 'RIMI', category: 'Groceries' },
      { pattern: 'Circle K', category: 'Transport' }
    ]);

    const result = await importStatement(
      statement(line(), line({ archive: 'RO2', cp: 'Circle K', amount: '40,00' })),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([
      { category: 'Transport', count: 1, amount: 40 },
      { category: 'Groceries', count: 1, amount: 15.59 }
    ]);
  });

  it('files a row no rule claims as unsorted, ready to be picked up later', async () => {
    const result = await importStatement(statement(line()), { userId: 'u1' });

    expect(result.categories).toEqual([{ category: 'Uncategorised', count: 1, amount: 15.59 }]);
  });
});

describe('the owner\'s own rules', () => {
  it('files a merchant the owner has a rule for', async () => {
    withRules([{ pattern: 'VELOMARKET', category: 'Bicycle' }]);

    const result = await importStatement(
      statement(line({ cp: 'VELOMARKET OU', amount: '89,00' })),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([{ category: 'Bicycle', count: 1, amount: 89 }]);
  });

  it('reads a regex rule as a pattern rather than as literal text', async () => {
    withRules([
      { pattern: '\\bBOLT\\b(?! ?Food)', matchType: 'regex', category: 'Transport' }
    ]);

    const result = await importStatement(
      statement(
        line({ cp: 'BOLT OU', amount: '9,00' }),
        line({ archive: 'RO2', cp: 'BOLT FOOD OU', amount: '18,00' })
      ),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([
      { category: 'Uncategorised', count: 1, amount: 18 },
      { category: 'Transport', count: 1, amount: 9 }
    ]);
  });

  it('matches however the terminal spelled the name', async () => {
    withRules([{ pattern: 'Külapood', category: 'Groceries' }]);

    const result = await importStatement(
      statement(line({ cp: 'KULAPOOD TARTU', amount: '9,00' })),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([{ category: 'Groceries', count: 1, amount: 9 }]);
  });

  it('honours a rule restricted to one direction', async () => {
    withRules([{ pattern: 'ACME', category: 'Consulting', type: 'income' }]);

    const result = await importStatement(
      statement(
        line({ cp: 'ACME OU', amount: '100,00', dc: 'C' }),
        line({ archive: 'RO2', cp: 'ACME OU', amount: '20,00', dc: 'D' })
      ),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([
      { category: 'Consulting', count: 1, amount: 100 },
      { category: 'Uncategorised', count: 1, amount: 20 }
    ]);
  });

  it('runs the earlier rule first, so a specific one can beat a broad one', async () => {
    withRules([
      { pattern: 'BOLT FOOD', category: 'Restaurants' },
      { pattern: 'BOLT', category: 'Transport' }
    ]);

    const result = await importStatement(
      statement(line({ cp: 'BOLT FOOD OU', amount: '18,00' })),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([{ category: 'Restaurants', count: 1, amount: 18 }]);
  });

  it('cannot turn a transfer between own accounts into a transaction', async () => {
    withRules([{ pattern: 'SMITH', category: 'Salary' }]);

    const result = await importStatement(
      statement(line({ cp: 'ALEX SMITH' })),
      { userId: 'u1' }
    );

    expect(result.imported).toBe(0);
    expect(result.skipped['Transfer between your own accounts']).toBe(1);
  });

  it('reads the rules for the group being imported into', async () => {
    await importStatement(statement(line()), { userId: 'u1', groupId: 'g1', userGroups: ['g1'] });

    expect(mockedRuleFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
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

  it('does not move rows imported under personal finances into a group', async () => {
    // Imported personally last month; now the same statement, into the group.
    mockedFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ externalId: 'RO1', groupId: null }]) });

    const result = await importStatement(statement(line(), line({ archive: 'RO2' })), {
      userId: 'u1',
      groupId: 'g1',
      userGroups: ['g1']
    });

    expect(result).toMatchObject({ imported: 1, duplicates: 0 });
    expect(result.skipped).toEqual({ 'Already imported under your personal finances': 1 });
    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations.map((op: { updateOne: { filter: { externalId: string } } }) => op.updateOne.filter.externalId)).toEqual(['RO2']);
  });

  it('says so, rather than claiming an import, when the rows are held in a group', async () => {
    mockedFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ externalId: 'RO1', groupId: 'g1' }]) });

    const result = await importStatement(statement(line()), { userId: 'u1' });

    expect(result).toMatchObject({ imported: 0, duplicates: 0 });
    expect(result.skipped).toEqual({ 'Already imported under a group': 1 });
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('never overwrites a row that slipped in between the check and the write', async () => {
    await importStatement(statement(line()), { userId: 'u1' });

    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations[0].updateOne.update).not.toHaveProperty('$set');
    expect(operations[0].updateOne.update.$setOnInsert).toBeDefined();
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
    const result = await importStatement(statement(line({ cp: 'ALEX SMITH' })), { userId: 'u1' });

    expect(result.imported).toBe(0);
    expect(result.skipped['Transfer between your own accounts']).toBe(1);
  });

  it('imports a securities settlement as capital, not as spending', async () => {
    // The money really did leave the account; leaving it out made the invested
    // figure report a fraction of the truth
    const result = await importStatement(
      statement(line({ desc: 'DL98687175/VUSA/35/72.8/Buy/ x', amount: '2548,00' })),
      { userId: 'u1' }
    );

    expect(result.imported).toBe(1);
    expect(result.categories).toEqual([{ category: 'Investments', count: 1, amount: 2548 }]);
  });

  it('records a dividend as income of its own, and hands it to the trade log as well', async () => {
    const result = await importStatement(
      statement(line({ dc: 'C', amount: '0,28', desc: 'Vanguard,IE00B3XXRP09,dividendimakse,.28,15.12.23,IE' })),
      { userId: 'u1' }
    );

    expect(result.imported).toBe(1);
    expect(result.categories).toEqual([{ category: 'Dividends', count: 1, amount: 0.28 }]);
    expect(Object.keys(result.skipped)).toEqual([]);
    expect(importTrades).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'dividend', row: expect.objectContaining({ amount: 0.28 }) })],
      { userId: 'u1' }
    );
  });

  it('hands a settlement to the trade log as well as keeping its cash row', async () => {
    const result = await importStatement(
      statement(line({ desc: 'DLA1164839/EXUS GY/100/39.7/Ost/ Saksamaa', amount: '3970,00' })),
      { userId: 'u1' }
    );

    expect(result.imported).toBe(1);
    expect(importTrades).toHaveBeenCalledWith([expect.objectContaining({ kind: 'security' })], { userId: 'u1' });
  });

  it('imports a pension contribution as capital, not as spending', async () => {
    const result = await importStatement(statement(line({ cp: 'PENSIONIKESKUS AS' })), { userId: 'u1' });

    expect(result.imported).toBe(1);
    expect(result.categories[0].category).toBe('Pension');
  });

  it('keeps own-account transfers out of the transactions but not dividends', async () => {
    const result = await importStatement(
      statement(
        line({ cp: 'ALEX SMITH' }),
        line({ archive: 'RO2', desc: 'Vanguard,IE00B3XXRP09,dividendimakse,.28,15.12.23,IE' })
      ),
      { userId: 'u1' }
    );

    expect(result.imported).toBe(1);
    expect(result.categories[0].category).toBe('Dividends');
    expect(result.skipped['Transfer between your own accounts']).toBe(1);
    expect(Object.keys(result.skipped)).toEqual(['Transfer between your own accounts']);
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
    const result = await importStatement(statement(line({ cp: 'ALEX SMITH' })), { userId: 'u1' });

    expect(mockedFind).not.toHaveBeenCalled();
    expect(result.categories).toEqual([]);
  });
});

describe('format detection', () => {
  it('recognises a bank statement', () => {
    expect(detectFormat(statement(line()))).toBe('seb');
  });

  it('recognises one of this app\'s own exports', () => {
    expect(detectFormat('id;date;type;amount;category;note\nabc;2026-01-01;expense;1,00;Rent;x')).toBe('tumbaland');
  });

  it('tolerates a BOM on either', () => {
    expect(detectFormat('﻿id;category\nabc;Rent')).toBe('tumbaland');
    expect(detectFormat('﻿' + statement(line()))).toBe('seb');
  });

  it('is null for anything else', () => {
    expect(detectFormat('name,value\nfoo,1')).toBeNull();
    expect(detectFormat('')).toBeNull();
  });
});

describe('detectFormat with pensions', () => {
  it('recognises a Pensionikeskus statement', () => {
    const text = 'Väärtpaberi/ raha konto nimi,Sammas,Kande kuupäev,Põhjus,Kande liik\r\nF,STEP_2,15.01.2026,1,Osakute märkimine';
    expect(detectFormat(text)).toBe('pensionikeskus');
  });
});
