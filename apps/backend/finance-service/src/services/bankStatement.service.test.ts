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
  compileRules,
  matchCustomRule,
  ownerNameTest,
  fold,
  FALLBACK_CATEGORIES
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

  // Built from names the way the import does, from the owner's settings. An
  // invented name, so this file puts no real person back into the repository.
  const ownerName = ownerNameTest(['SMITH ALEX', 'ALEX SMITH']);

  it('includes the accounts the statements are for', () => {
    expect(findOwnAccounts(rows([{ account: 'A' }, { account: 'B' }]))).toEqual(new Set(['A', 'B']));
  });

  it('adds a counterparty account addressed by the owner name', () => {
    const found = findOwnAccounts(
      rows([{ counterpartyAccount: 'C', counterparty: 'SMITH ALEX' }]),
      ownerName
    );
    expect(found.has('C')).toBe(true);
  });

  it('matches the owner name written in either order', () => {
    const found = findOwnAccounts(
      rows([{ counterpartyAccount: 'C', counterparty: 'ALEX SMITH' }]),
      ownerName
    );
    expect(found.has('C')).toBe(true);
  });

  it('leaves a third party out', () => {
    const found = findOwnAccounts(
      rows([{ counterpartyAccount: 'C', counterparty: 'A SUPERMARKET' }]),
      ownerName
    );
    expect(found.has('C')).toBe(false);
  });

  it('falls back to account numbers when no owner name is recorded', () => {
    const found = findOwnAccounts(
      rows([{ account: 'A' }, { counterpartyAccount: 'C', counterparty: 'SMITH ALEX' }]),
      null
    );
    expect(found).toEqual(new Set(['A']));
  });
});

describe('ownerNameTest', () => {
  it('is null when no names are recorded, so nothing is claimed as own', () => {
    expect(ownerNameTest([])).toBeNull();
    expect(ownerNameTest()).toBeNull();
  });

  it('is null when the names are all blank', () => {
    expect(ownerNameTest(['', '   '])).toBeNull();
  });

  it('ignores case and surrounding text', () => {
    const isOwner = ownerNameTest(['Alex Smith'])!;
    expect(isOwner('ALEX SMITH')).toBe(true);
    expect(isOwner('MR ALEX SMITH JR')).toBe(true);
    expect(isOwner('ALEXANDRA SMITHERS')).toBe(false);
  });

  it('tolerates however the bank spaced the name', () => {
    const isOwner = ownerNameTest(['ALEX SMITH'])!;
    expect(isOwner('ALEX   SMITH')).toBe(true);
    expect(isOwner('  ALEX SMITH  ')).toBe(true);
  });

  it('needs both orderings listed, because the bank writes it both ways', () => {
    const oneWay = ownerNameTest(['ALEX SMITH'])!;
    expect(oneWay('SMITH ALEX')).toBe(false);

    const bothWays = ownerNameTest(['ALEX SMITH', 'SMITH ALEX'])!;
    expect(bothWays('SMITH ALEX')).toBe(true);
  });

  it('matches a name written with accents against the transliterated form', () => {
    const isOwner = ownerNameTest(['Ülle Käär'])!;
    expect(isOwner('ULLE KAAR')).toBe(true);
  });

  it('leaves a third party alone', () => {
    expect(ownerNameTest(['ALEX SMITH'])!('A SUPERMARKET')).toBe(false);
  });
});


describe('classifyRow', () => {
  const rowsOf = (csv: string) => readStatement(csv);
  const own = new Set(['EE-OWN']);
  const ownerName = ownerNameTest(['SMITH ALEX', 'ALEX SMITH']);

  it('marks a transfer to an own account', () => {
    const [row] = rowsOf(statement(line({ cpAccount: 'EE-OWN' })));
    expect(classifyRow(row, own).kind).toBe('transfer');
  });

  it('marks a transfer by owner name even without an account', () => {
    const [row] = rowsOf(statement(line({ cp: 'ALEX SMITH' })));
    expect(classifyRow(row, new Set(), [], ownerName).kind).toBe('transfer');
  });

  it('treats a name as an ordinary counterparty when none is configured', () => {
    const [row] = rowsOf(statement(line({ cp: 'ALEX SMITH' })));
    expect(classifyRow(row, new Set(), [], null).kind).toBe('cashflow');
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

  it('treats everything else as cash flow, falling back when no rule claims it', () => {
    const [row] = rowsOf(statement(line()));
    expect(classifyRow(row, own)).toEqual({ kind: 'cashflow', category: 'Uncategorised' });
  });
});

describe('rules the owner wrote', () => {
  const row = (counterparty: string, direction: 'income' | 'expense' = 'expense'): StatementRow => ({
    account: 'A', date: new Date(), dateText: '', counterpartyAccount: '',
    counterparty, direction, amount: 1, externalId: 'x', description: '', currency: 'EUR'
  });

  describe('compileRules', () => {
    it('folds the diacritics off a pattern and lowercases it', () => {
      expect(compileRules([{ pattern: ' Külapood ', category: 'Health' }])).toEqual([
        { pattern: ' Külapood ', needle: 'kulapood', category: 'Health', type: undefined }
      ]);
    });

    it('drops a pattern with nothing to match on', () => {
      expect(compileRules([{ pattern: '   ', category: 'Health' }])).toEqual([]);
    });

    it('keeps the direction restriction', () => {
      expect(compileRules([{ pattern: 'ACME', category: 'X', type: 'income' }])[0].type).toBe('income');
    });
  });

  describe('matchCustomRule', () => {
    const rules = compileRules([
      { pattern: 'BOLT FOOD', category: 'Restaurants' },
      { pattern: 'BOLT', category: 'Transport' },
      { pattern: 'ACME', category: 'Consulting', type: 'income' }
    ]);

    it('returns the first rule that claims the text', () => {
      expect(matchCustomRule(rules, 'BOLT FOOD OU', 'expense')?.category).toBe('Restaurants');
      expect(matchCustomRule(rules, 'BOLT OU', 'expense')?.category).toBe('Transport');
    });

    it('ignores case', () => {
      expect(matchCustomRule(rules, 'bolt food ou', 'expense')?.category).toBe('Restaurants');
    });

    it('skips a rule written for the other direction', () => {
      expect(matchCustomRule(rules, 'ACME OU', 'expense')).toBeNull();
      expect(matchCustomRule(rules, 'ACME OU', 'income')?.category).toBe('Consulting');
    });

    it('is null when nothing matches', () => {
      expect(matchCustomRule(rules, 'SELVER', 'expense')).toBeNull();
    });

    it('is null when there are no rules', () => {
      expect(matchCustomRule([], 'BOLT', 'expense')).toBeNull();
    });
  });

  describe('categorize with rules', () => {
    it('files a merchant the owner has a rule for', () => {
      const rules = compileRules([{ pattern: 'VELOMARKET', category: 'Bicycle' }]);
      expect(categorize(row('VELOMARKET OU'), rules)).toBe('Bicycle');
    });

    it('matches however the terminal transliterated the name', () => {
      const rules = compileRules([{ pattern: 'Külapood', category: 'Groceries' }]);
      expect(categorize(row('KULAPOOD TARTU'), rules)).toBe('Groceries');
    });

    it('lets an earlier rule win over a later one that also matches', () => {
      // The whole reason order is the owner's to set
      const rules = compileRules([
        { pattern: 'GOOGLE CLOUD', category: 'Infrastructure' },
        { pattern: 'GOOGLE', category: 'Subscriptions' }
      ]);
      expect(categorize(row('GOOGLE CLOUD EMEA'), rules)).toBe('Infrastructure');
      expect(categorize(row('GOOGLE PLAY'), rules)).toBe('Subscriptions');
    });

    it('falls back when no rule claims the row', () => {
      const rules = compileRules([{ pattern: 'VELOMARKET', category: 'Bicycle' }]);
      expect(categorize(row('A SUPERMARKET'), rules)).toBe('Uncategorised');
    });

    it('has a separate fallback for money coming in', () => {
      expect(categorize(row('SOMETHING NEW', 'income'), [])).toBe('Other income');
    });

    it('files everything as unsorted when the owner has no rules at all', () => {
      // What a fresh install does. Nothing is guessed on a stranger's behalf.
      expect(categorize(row('A SUPERMARKET'))).toBe('Uncategorised');
    });

    it('reads a regex rule as a pattern rather than as literal text', () => {
      const rules = compileRules([
        { pattern: '\\bBOLT\\b(?! ?Food)', matchType: 'regex', category: 'Transport' }
      ]);
      expect(categorize(row('BOLT OU'), rules)).toBe('Transport');
      expect(categorize(row('BOLT FOOD OU'), rules)).toBe('Uncategorised');
    });

    it('skips a regex that will not compile rather than failing the import', () => {
      const rules = compileRules([
        { pattern: '(unclosed', matchType: 'regex', category: 'Broken' },
        { pattern: 'VELOMARKET', category: 'Bicycle' }
      ]);
      expect(rules).toHaveLength(1);
      expect(categorize(row('VELOMARKET OU'), rules)).toBe('Bicycle');
    });

    it('folds diacritics off a regex pattern too, so it matches a transliterated row', () => {
      const rules = compileRules([
        { pattern: 'K[üy]lapood|Muugikoht', matchType: 'regex', category: 'Groceries' }
      ]);
      expect(categorize(row('KULAPOOD TARTU'), rules)).toBe('Groceries');
      expect(categorize(row('KYLAPOOD TARTU'), rules)).toBe('Groceries');
    });
  });

  describe('classifyRow with rules', () => {
    const rowsOf = (csv: string) => readStatement(csv);

    it('applies a rule to an ordinary row', () => {
      const rules = compileRules([{ pattern: 'RIMI', category: 'Household' }]);
      const [row] = rowsOf(statement(line()));

      expect(classifyRow(row, new Set(), rules)).toEqual({ kind: 'cashflow', category: 'Household' });
    });

    it('cannot make a transfer between own accounts into spending', () => {
      const rules = compileRules([{ pattern: 'SMITH', category: 'Salary' }]);
      const [row] = rowsOf(statement(line({ cp: 'ALEX SMITH' })));

      expect(classifyRow(row, new Set(), rules, ownerNameTest(['ALEX SMITH'])).kind).toBe('transfer');
    });

    it('cannot reclassify a securities settlement', () => {
      const rules = compileRules([{ pattern: 'DL98687175', category: 'Groceries' }]);
      const [row] = rowsOf(statement(line({ desc: 'DL98687175/VUSA/35/72.8/Buy/ Saksamaa' })));

      expect(classifyRow(row, new Set(), rules)).toEqual({ kind: 'security', category: 'Investments' });
    });
  });

  describe('fold', () => {
    it('strips diacritics without touching anything else', () => {
      expect(fold('Külapood Ülemiste')).toBe('Kulapood Ulemiste');
    });
  });

  describe('FALLBACK_CATEGORIES', () => {
    it('is the pair a row lands in when nothing claimed it', () => {
      expect([...FALLBACK_CATEGORIES].sort()).toEqual(['Other income', 'Uncategorised']);
    });
  });
});
