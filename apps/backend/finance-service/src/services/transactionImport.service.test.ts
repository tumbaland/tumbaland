jest.mock('../models/Transaction', () => ({
  __esModule: true,
  default: { find: jest.fn(), bulkWrite: jest.fn(), insertMany: jest.fn() }
}));

import Transaction from '../models/Transaction';
import {
  importStatement,
  importCategories,
  importPensionStatement,
  detectFormat
} from './transactionImport.service';

const mockedFind = Transaction.find as unknown as jest.Mock;
const mockedBulkWrite = Transaction.bulkWrite as unknown as jest.Mock;
const mockedInsertMany = Transaction.insertMany as unknown as jest.Mock;

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

  it('skips a dividend', async () => {
    const result = await importStatement(
      statement(line({ desc: 'Vanguard,IE00B3XXRP09,dividendimakse,.28,15.12.23,IE' })),
      { userId: 'u1' }
    );

    expect(result.skipped['Dividend (belongs in the trade log)']).toBe(1);
  });

  it('imports a pension contribution as capital, not as spending', async () => {
    const result = await importStatement(statement(line({ cp: 'PENSIONIKESKUS AS' })), { userId: 'u1' });

    expect(result.imported).toBe(1);
    expect(result.categories[0].category).toBe('Pension');
  });

  it('still keeps dividends and own-account transfers out', async () => {
    const result = await importStatement(
      statement(
        line({ cp: 'TAHVES TOOMAS' }),
        line({ archive: 'RO2', desc: 'Vanguard,IE00B3XXRP09,dividendimakse,.28,15.12.23,IE' })
      ),
      { userId: 'u1' }
    );

    expect(result.imported).toBe(0);
    expect(result.skipped['Transfer between your own accounts']).toBe(1);
    expect(result.skipped['Dividend (belongs in the trade log)']).toBe(1);
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

describe('importCategories', () => {
  const ids = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'];
  const file = (...rows: string[]) => ['id;date;type;amount;category;note', ...rows].join('\n');

  /** What the database currently holds for the ids the file names. */
  const held = (rows: Array<{ _id: string; category: string }>) =>
    mockedFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) });

  beforeEach(() => {
    held([]);
    mockedBulkWrite.mockResolvedValue({});
  });

  it('applies a changed category', async () => {
    held([{ _id: ids[0], category: 'Uncategorised' }]);

    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;Groceries;RIMI`), {
      userId: 'u1'
    });

    expect(result).toMatchObject({ format: 'tumbaland', updated: 1, unchanged: 0 });
    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations[0].updateOne.update).toEqual({ $set: { category: 'Groceries' } });
  });

  it('leaves a row already in that category alone', async () => {
    held([{ _id: ids[0], category: 'Groceries' }]);

    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;Groceries;x`), {
      userId: 'u1'
    });

    expect(result).toMatchObject({ updated: 0, unchanged: 1 });
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('reports ids that belong to nobody here rather than creating them', async () => {
    held([]);

    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;Groceries;x`), {
      userId: 'u1'
    });

    expect(result).toMatchObject({ updated: 0, notFound: 1 });
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('skips a row with no usable id, rather than throwing on the lookup', async () => {
    const result = await importCategories(
      file('not-an-id;2026-01-01;expense;1,00;Groceries;x', 'also-bad;d;expense;1,00;Rent;y'),
      { userId: 'u1' }
    );

    expect(result.malformed).toBe(2);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('ignores a blank line rather than counting it as malformed', async () => {
    // A trailing newline is normal in a spreadsheet export
    const result = await importCategories(file(';;;;;', ''), { userId: 'u1' });

    expect(result.malformed).toBe(0);
  });

  it('skips a row with an id but no category', async () => {
    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;;x`), { userId: 'u1' });

    expect(result.malformed).toBe(1);
  });

  it('reads only the category, ignoring reformatted dates and amounts', async () => {
    // A spreadsheet will have rewritten these to the local locale
    held([{ _id: ids[0], category: 'Uncategorised' }]);

    await importCategories(file(`${ids[0]};06/07/2026;expense;15.59 €;Groceries;x`), { userId: 'u1' });

    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations[0].updateOne.update.$set).toEqual({ category: 'Groceries' });
  });

  it('groups what it moved by category', async () => {
    held([
      { _id: ids[0], category: 'Uncategorised' },
      { _id: ids[1], category: 'Uncategorised' }
    ]);

    const result = await importCategories(
      file(`${ids[0]};d;expense;1,00;Groceries;x`, `${ids[1]};d;expense;1,00;Groceries;y`),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([{ category: 'Groceries', count: 2 }]);
  });

  it('scopes the lookup to the caller, so ids cannot reach another owner', async () => {
    await importCategories(file(`${ids[0]};d;expense;1,00;Groceries;x`), {
      userId: 'u1',
      groupId: 'g1',
      userGroups: ['g1']
    });

    expect(mockedFind.mock.calls[0][0]).toMatchObject({ groupId: { $in: ['g1'] } });
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      importCategories(file(`${ids[0]};d;expense;1,00;X;x`), {
        userId: 'u1',
        groupId: 'g9',
        userGroups: ['g1']
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('refuses a file with no category column', async () => {
    await expect(
      importCategories('id;date\nabc;2026-01-01', { userId: 'u1' })
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('does nothing at all for a file with no usable rows', async () => {
    const result = await importCategories(file(), { userId: 'u1' });

    expect(result).toMatchObject({ updated: 0, malformed: 0 });
    expect(mockedFind).not.toHaveBeenCalled();
  });
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

describe('detectFormat with pensions', () => {
  it('recognises a Pensionikeskus statement', () => {
    const text = 'Väärtpaberi/ raha konto nimi,Sammas,Kande kuupäev,Põhjus,Kande liik\r\nF,STEP_2,15.01.2026,1,Osakute märkimine';
    expect(detectFormat(text)).toBe('pensionikeskus');
  });
});
