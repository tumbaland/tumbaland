import {
  parseCsv,
  parseAmount,
  parseStatementDate,
  readStatement,
  isAccountStatement,
  findOwnAccounts,
  classifyRow,
  categorize,
  StatementRow,
  isInvestmentCategory
} from './bankStatement.service';

const HEADER =
  'Kliendi konto;Dokumendi number;Kuupäev;Saaja/maksja konto;Saaja/maksja nimi;' +
  'Saaja panga kood;Tüüp;Deebet/Kreedit (D/C);Summa;Viitenumber;Arhiveerimistunnus;' +
  'Selgitus;Teenustasu;Valuuta;Isikukood';

const line = (over: Partial<Record<string, string>> = {}) => {
  const f = {
    account: 'EE59', doc: 'D1', date: '05.08.2026', cpAccount: '', cp: 'RIMI',
    bank: 'X', type: 'MK', dc: 'D', amount: '15,59', ref: '', archive: 'RO1',
    desc: 'kaart', fee: '0', currency: 'EUR', code: '',
    ...over
  };
  return [f.account, f.doc, f.date, f.cpAccount, f.cp, f.bank, f.type, f.dc,
    f.amount, f.ref, f.archive, f.desc, f.fee, f.currency, f.code].join(';');
};

const statement = (...rows: string[]) => [HEADER, ...rows].join('\n');

describe('parseCsv', () => {
  it('keeps a quoted field containing the delimiter intact', () => {
    const rows = parseCsv('a;b\n"one;two";three');
    expect(rows[1]).toEqual(['one;two', 'three']);
  });

  it('unescapes a doubled quote', () => {
    expect(parseCsv('"say ""hi"""')[0]).toEqual(['say "hi"']);
  });

  it('drops blank lines', () => {
    expect(parseCsv('a;b\n\n\nc;d')).toHaveLength(2);
  });

  it('tolerates CRLF line endings', () => {
    expect(parseCsv('a;b\r\nc;d')[1]).toEqual(['c', 'd']);
  });
});

describe('parseAmount', () => {
  it('reads a comma decimal separator', () => {
    expect(parseAmount('15,59')).toBe(15.59);
  });

  it('reads a thousands separator alongside it', () => {
    expect(parseAmount('1 234,56')).toBe(1234.56);
    expect(parseAmount('12.504,15')).toBe(12504.15);
  });

  it('is NaN for something unparseable', () => {
    expect(parseAmount('lots')).toBeNaN();
  });
});

describe('parseStatementDate', () => {
  it('reads DD.MM.YYYY at UTC midnight, so no timezone shifts the day', () => {
    expect(parseStatementDate('05.08.2026')?.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });

  it('is null for a malformed date', () => {
    expect(parseStatementDate('yesterday')).toBeNull();
  });
});

describe('isAccountStatement', () => {
  it('recognises the account-statement header', () => {
    expect(isAccountStatement(statement(line()))).toBe(true);
  });

  it('tolerates a UTF-8 BOM', () => {
    expect(isAccountStatement('﻿' + statement(line()))).toBe(true);
  });

  it('rejects some other CSV', () => {
    expect(isAccountStatement('name,value\nfoo,1')).toBe(false);
  });

  it('rejects a pension statement, which is tab separated', () => {
    expect(isAccountStatement('SEB fond\n14.07.2026\tOsakute märkimine\t1,8 EUR')).toBe(false);
  });
});

describe('readStatement', () => {
  it('maps a row onto the normalized shape', () => {
    const [row] = readStatement(statement(line()));

    expect(row).toMatchObject({
      account: 'EE59',
      counterparty: 'RIMI',
      direction: 'expense',
      amount: 15.59,
      externalId: 'RO1',
      currency: 'EUR'
    });
    expect(row.date?.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });

  it('reads a credit as income', () => {
    expect(readStatement(statement(line({ dc: 'C' })))[0].direction).toBe('income');
  });

  it('returns nothing for a file that is not a statement', () => {
    expect(readStatement('a,b\n1,2')).toEqual([]);
  });

  it('returns nothing for empty input', () => {
    expect(readStatement('')).toEqual([]);
  });
});

describe('findOwnAccounts', () => {
  const rows = (over: Partial<StatementRow>[]) =>
    over.map((o) => ({
      account: 'A', date: new Date(), dateText: '', counterpartyAccount: '',
      counterparty: '', direction: 'expense' as const, amount: 1, externalId: 'x',
      description: '', currency: 'EUR', ...o
    }));

  it('includes the accounts the statements are for', () => {
    expect(findOwnAccounts(rows([{ account: 'A' }, { account: 'B' }]))).toEqual(new Set(['A', 'B']));
  });

  it('adds a counterparty account addressed by the owner name', () => {
    const found = findOwnAccounts(rows([{ counterpartyAccount: 'C', counterparty: 'TAHVES TOOMAS' }]));
    expect(found.has('C')).toBe(true);
  });

  it('matches the owner name written in either order', () => {
    const found = findOwnAccounts(rows([{ counterpartyAccount: 'C', counterparty: 'TOOMAS TAHVES' }]));
    expect(found.has('C')).toBe(true);
  });

  it('leaves a third party out', () => {
    const found = findOwnAccounts(rows([{ counterpartyAccount: 'C', counterparty: 'RIMI' }]));
    expect(found.has('C')).toBe(false);
  });
});

describe('categorize', () => {
  const row = (counterparty: string, direction: 'income' | 'expense' = 'expense'): StatementRow => ({
    account: 'A', date: new Date(), dateText: '', counterpartyAccount: '',
    counterparty, direction, amount: 1, externalId: 'x', description: '', currency: 'EUR'
  });

  it('matches a merchant rule', () => {
    expect(categorize(row('RIMI'))).toBe('Groceries');
  });

  it('will not let an income rule claim a debit', () => {
    // Freelance income shaped as a payment out is not freelance income
    expect(categorize(row('Brainbase', 'expense'))).toBe('Uncategorised');
    expect(categorize(row('Brainbase', 'income'))).toBe('Freelance');
  });

  it('reads the university as pay coming in and tuition going out', () => {
    expect(categorize(row('TALLINNA TEHNIKAÜLIKOOL', 'income'))).toBe('Salary');
    expect(categorize(row('TALLINNA TEHNIKAÜLIKOOL', 'expense'))).toBe('Education');
  });

  describe('however the bank spelled it', () => {
    // Card terminals transliterate: Südameapteek arrives as SUDAMEAPTEEK from
    // one and SYDAMEAPTEEK from another, while a transfer keeps the diacritic
    it.each([['Südameapteek'], ['SUDAMEAPTEEK ULEMISTE'], ['SYDAMEAPTEEK YLEMISTE']])(
      '%s is the same pharmacy',
      (name) => expect(categorize(row(name))).toBe('Health')
    );

    it('matches a rule written in correct Estonian against a stripped name', () => {
      expect(categorize(row('UHISTEENUSED AS'))).toBe('Housing');
    });
  });

  describe('rules that used to catch the wrong rows', () => {
    it('does not read any word ending in -ku as an apartment association', () => {
      // KÜ folds to KU, which matched "Masku", "Kesku", "Lasnamäe kaupluku"…
      expect(categorize(row('Masku Baltic OÜ'))).toBe('Home');
      expect(categorize(row('K/Ü Järvevana tee 3'))).toBe('Housing');
      expect(categorize(row('KÜ Sõpruse 201'))).toBe('Housing');
    });

    it('keeps the card fee out of housing', () => {
      // "hooldustasu" is any maintenance fee, the bank's included
      expect(categorize({ ...row('SEB'), description: 'Kaardi ...015522 hooldustasu kuus (12/2021)' }))
        .toBe('Bank fees');
      expect(categorize({ ...row('K/Ü Järvevana tee 3'), description: 'hooldustasu' })).toBe('Housing');
    });

    it('separates a Bolt ride from a Bolt Food order', () => {
      expect(categorize(row('BOLT.EU/O/2503151203'))).toBe('Transport');
      expect(categorize(row('Bolt Food'))).toBe('Restaurants');
    });

    it('reads ATAC as Rome transit rather than the French grocer', () => {
      expect(categorize(row('ATAC TAP&GO'))).toBe('Transport');
    });
  });

  it('treats an IBKR deposit through Citibank as capital, not a bank payment', () => {
    expect(categorize({ ...row('CITIBANK EUROPE PLC, GERMANY BRANCH'), description: 'U4360253 / Toomas Tahves' }))
      .toBe('Investments');
  });

  it('does not count a returned order as earnings', () => {
    expect(categorize({ ...row('DLB TRADING OÜ', 'income'), description: 'Tag. tell. nr. 27190040' }))
      .toBe('Refund');
  });

  it('falls back per direction', () => {
    expect(categorize(row('Nobody'))).toBe('Uncategorised');
    expect(categorize(row('Nobody', 'income'))).toBe('Other income');
  });
});

describe('classifyRow', () => {
  const rowsOf = (csv: string) => readStatement(csv);
  const own = new Set(['EE-OWN']);

  it('marks a transfer to an own account', () => {
    const [row] = rowsOf(statement(line({ cpAccount: 'EE-OWN' })));
    expect(classifyRow(row, own).kind).toBe('transfer');
  });

  it('marks a transfer by owner name even without an account', () => {
    const [row] = rowsOf(statement(line({ cp: 'TAHVES TOOMAS' })));
    expect(classifyRow(row, new Set()).kind).toBe('transfer');
  });

  it('marks a securities settlement', () => {
    const [row] = rowsOf(statement(line({ desc: 'DL98687175/VUSA/35/72.8/Buy/ Saksamaa' })));
    expect(classifyRow(row, own).kind).toBe('security');
  });

  it('marks a settlement whose reference carries a letter', () => {
    const [row] = rowsOf(statement(line({ desc: 'DLA0465999/H410 GY/200/12.172/Buy/ Saksamaa' })));
    expect(classifyRow(row, own).kind).toBe('security');
  });

  it('marks a dividend', () => {
    const [row] = rowsOf(statement(line({ desc: 'Vanguard,IE00B3XXRP09,dividendimakse,.28,15.12.23,IE' })));
    expect(classifyRow(row, own).kind).toBe('dividend');
  });

  it('marks a pension contribution', () => {
    const [row] = rowsOf(statement(line({ cp: 'PENSIONIKESKUS AS' })));
    expect(classifyRow(row, own).kind).toBe('pension');
  });

  it('treats everything else as cash flow, with a category', () => {
    const [row] = rowsOf(statement(line()));
    expect(classifyRow(row, own)).toEqual({ kind: 'cashflow', category: 'Groceries' });
  });
});

describe('investment categories', () => {
  const row = (counterparty: string): StatementRow => ({
    account: 'A', date: new Date(), dateText: '', counterpartyAccount: '',
    counterparty, direction: 'expense', amount: 1, externalId: 'x', description: '', currency: 'EUR'
  });

  it('recognises a crypto exchange as investing, not spending', () => {
    expect(categorize(row('Binance'))).toBe('Investments');
    expect(categorize(row('COINBASE VCKKPA9JJ'))).toBe('Investments');
  });

  it('recognises a deposit bank as saving', () => {
    expect(categorize(row('Bigbank AS'))).toBe('Savings');
  });

  it('marks those categories as non-consumption', () => {
    expect(isInvestmentCategory('Investments')).toBe(true);
    expect(isInvestmentCategory('Savings')).toBe(true);
    expect(isInvestmentCategory('Groceries')).toBe(false);
  });

  it('categorises tax paid out, without claiming the refund coming in', () => {
    expect(categorize(row('RAHANDUSMINISTEERIUM'))).toBe('Tax');
    expect(categorize({ ...row('RAHANDUSMINISTEERIUM'), direction: 'income' })).toBe('Tax refund');
  });

  it('catches the securities custody fee', () => {
    expect(categorize({ ...row('SEB'), description: 'VP H.TASU 12.2023' })).toBe('Bank fees');
  });
});
