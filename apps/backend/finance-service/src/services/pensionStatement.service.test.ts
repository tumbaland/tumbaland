import {
  readPensionStatement,
  isPensionStatement,
  decodeStatement
} from './pensionStatement.service';

const HEADER =
  'Väärtpaberi/ raha konto nimi,Sammas,Kande kuupäev,Põhjus,Kande liik,Kommentaar,' +
  'Valuuta,Hind,Kogus/ Summa,Saldo,Osaku puhasväärtus,NAV kuupäev';

const subscription = (over: Partial<Record<string, string>> = {}) => {
  const c = {
    fund: 'SEB pensionifond indeks',
    pillar: 'STEP_2',
    date: '15.01.2026',
    type: 'Osakute märkimine',
    currency: 'EUR',
    price: '1.61326',
    units: '376.257',
    ...over
  };
  return `${c.fund},${c.pillar},${c.date},1,${c.type},,${c.currency},${c.price},${c.units},0,${c.price},2026-01-14`;
};

const statement = (...rows: string[]) => [HEADER, ...rows].join('\r\n');

describe('isPensionStatement', () => {
  it('recognises a Pensionikeskus export by its pillar column', () => {
    expect(isPensionStatement(statement(subscription()))).toBe(true);
  });

  it('does not claim a bank statement', () => {
    expect(isPensionStatement('Kliendi konto;Kuupäev;Summa\nEE59;01.01.2026;5,00')).toBe(false);
  });

  it('does not claim an empty file', () => {
    expect(isPensionStatement('')).toBe(false);
  });
});

describe('decodeStatement', () => {
  it('reads a UTF-8 statement', () => {
    expect(decodeStatement(Buffer.from('Osakute märkimine', 'utf8'))).toBe('Osakute märkimine');
  });

  it('reads the Latin-1 that Pensionikeskus actually sends', () => {
    // The row name is what selects contributions, so mojibake here means the
    // import finds nothing and cheerfully reports success
    expect(decodeStatement(Buffer.from('Osakute märkimine', 'latin1'))).toBe('Osakute märkimine');
  });

  it('passes a string through untouched', () => {
    expect(decodeStatement('already text')).toBe('already text');
  });
});

describe('readPensionStatement', () => {
  it('works out the euros from price times units', () => {
    // The file states neither the amount nor anything that rounds to it
    const { contributions } = readPensionStatement(statement(subscription()));

    expect(contributions).toHaveLength(1);
    expect(contributions[0].amount).toBe(607);
  });

  it('rounds to the cent rather than carrying the float', () => {
    // 1.61326 × 376.257 is 606.99999... before rounding
    const { contributions } = readPensionStatement(statement(subscription()));

    expect(Number.isInteger(contributions[0].amount * 100)).toBe(true);
  });

  it('takes the pillar from the file instead of guessing at the fund name', () => {
    const { contributions } = readPensionStatement(
      statement(subscription(), subscription({ pillar: 'STEP_3', fund: 'LHV Pensionifond Indeks III' }))
    );

    expect(contributions.map((c) => c.pillar).sort()).toEqual(['II', 'III']);
  });

  it('counts a contribution once, not three times', () => {
    // Each one appears as cash arriving, cash leaving for the fund, and units
    // bought — only the units are the contribution
    const text = statement(
      subscription(),
      subscription({ type: 'Raha juriidilise isiku nimekirja alusel isikule', price: '', units: '607.00' }),
      subscription({ type: 'Rahad investorilt fondile', price: '', units: '-607.00' })
    );

    const { contributions } = readPensionStatement(text);

    expect(contributions).toHaveLength(1);
  });

  it('says what it passed over rather than dropping it silently', () => {
    const { skipped } = readPensionStatement(
      statement(subscription({ type: 'Rahad investorilt fondile', price: '', units: '-607.00' }))
    );

    expect(Object.keys(skipped)[0]).toContain('Rahad investorilt fondile');
  });

  it('survives the header repeating, which is how a paged statement arrives', () => {
    const text = [HEADER, subscription(), HEADER, subscription({ date: '13.02.2026' })].join('\r\n');

    const { contributions, skipped } = readPensionStatement(text);

    expect(contributions).toHaveLength(2);
    expect(skipped['header or blank row']).toBe(1);
  });

  it('orders contributions oldest first whatever order the file used', () => {
    const { contributions } = readPensionStatement(
      statement(subscription({ date: '14.07.2026' }), subscription({ date: '15.01.2026' }))
    );

    expect(contributions.map((c) => c.date.toISOString().slice(0, 10))).toEqual([
      '2026-01-15',
      '2026-07-14'
    ]);
  });

  it('skips a row it cannot price', () => {
    const { contributions, skipped } = readPensionStatement(statement(subscription({ price: '0' })));

    expect(contributions).toHaveLength(0);
    expect(skipped['unusable row (date, price or units)']).toBe(1);
  });

  it('skips an unreadable date', () => {
    const { skipped } = readPensionStatement(statement(subscription({ date: 'not a date' })));

    expect(skipped['unusable row (date, price or units)']).toBe(1);
  });

  it('skips a pillar it does not know', () => {
    const { skipped } = readPensionStatement(statement(subscription({ pillar: 'STEP_9' })));

    expect(skipped['unknown pillar "STEP_9"']).toBe(1);
  });

  it('skips a currency it cannot total', () => {
    const { skipped } = readPensionStatement(statement(subscription({ currency: 'USD' })));

    expect(skipped['currency USD']).toBe(1);
  });

  it('lists the funds it saw', () => {
    const { funds } = readPensionStatement(
      statement(subscription(), subscription({ fund: 'LHV Pensionifond Indeks III', pillar: 'STEP_3' }))
    );

    expect(funds).toEqual(['LHV Pensionifond Indeks III', 'SEB pensionifond indeks']);
  });

  it('returns empty structures for a file with no header', () => {
    expect(readPensionStatement('')).toEqual({
      contributions: [],
      skipped: {},
      funds: [],
      pillars: []
    });
  });
});
