import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedImport = vi.fn();
vi.mock('../../hooks/useCashflow', () => ({
  useImportStatement: () => ({ mutateAsync: mockedImport, isPending: false })
}));

import ImportDialog from './ImportDialog';

const result = (over = {}) => ({
  format: 'seb' as const,
  imported: 3,
  duplicates: 0,
  skipped: {},
  period: { from: '2026-08-01', to: '2026-08-31' },
  rows: 5,
  categories: [{ category: 'Groceries', count: 3, amount: 45 }],
  ...over
});

const upload = async (contents = 'Kliendi konto;x\nrow') => {
  const file = new File([contents], 'august.csv', { type: 'text/csv' });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, file);
};

const renderDialog = (props = {}) =>
  render(<ImportDialog open onClose={vi.fn()} {...props} />);

beforeEach(() => vi.clearAllMocks());

it('explains that re-importing an overlapping period is safe', () => {
  renderDialog();

  expect(screen.getByText(/skipped rather than duplicated/i)).toBeInTheDocument();
});

it('sends the file contents and shows what came in', async () => {
  mockedImport.mockResolvedValue(result());
  renderDialog({ tenantGroupId: 'g1' });

  await upload('Kliendi konto;a\nrow-data');

  // Sent as bytes, not text: decoding client-side would corrupt a Latin-1 file
  await waitFor(() =>
    expect(mockedImport).toHaveBeenCalledWith({ csv: expect.any(ArrayBuffer), groupId: 'g1' })
  );
  const sent = mockedImport.mock.calls[0][0].csv as ArrayBuffer;
  expect(new TextDecoder().decode(sent)).toBe('Kliendi konto;a\nrow-data');
  expect(await screen.findByText('3 transactions imported')).toBeInTheDocument();
  expect(screen.getByText(/2026-08-01 → 2026-08-31/)).toBeInTheDocument();
});

it('names the file that was chosen', async () => {
  mockedImport.mockResolvedValue(result());
  renderDialog();

  await upload();

  expect(await screen.findByText('august.csv')).toBeInTheDocument();
});

it('reports rows already held from an overlapping import', async () => {
  mockedImport.mockResolvedValue(result({ imported: 2, duplicates: 12 }));
  renderDialog();

  await upload();

  expect(await screen.findByText(/12 rows were already held/i)).toBeInTheDocument();
});

it('says so plainly when the whole file was already imported', async () => {
  mockedImport.mockResolvedValue(result({ imported: 0, duplicates: 20, categories: [] }));
  renderDialog();

  await upload();

  expect(await screen.findByText('Nothing new to import')).toBeInTheDocument();
});

it('uses the singular for one duplicate', async () => {
  mockedImport.mockResolvedValue(result({ imported: 1, duplicates: 1 }));
  renderDialog();

  await upload();

  expect(await screen.findByText(/1 row was already held/i)).toBeInTheDocument();
});

it('lists what was deliberately left out', async () => {
  mockedImport.mockResolvedValue(
    result({ skipped: { 'Transfer between your own accounts': 8, 'Dividend (belongs in the trade log)': 2 } })
  );
  renderDialog();

  await upload();

  expect(await screen.findByText('Transfer between your own accounts')).toBeInTheDocument();
  expect(screen.getByText('8')).toBeInTheDocument();
});

it('surfaces a rejection from the server', async () => {
  mockedImport.mockRejectedValue(new Error('This does not look like a SEB account statement'));
  renderDialog();

  await upload('name,value\nfoo,1');

  expect(await screen.findByText(/does not look like a SEB account statement/)).toBeInTheDocument();
});

it('clears the result so another file can be imported', async () => {
  mockedImport.mockResolvedValue(result());
  renderDialog();

  await upload();
  await userEvent.click(await screen.findByRole('button', { name: /import another/i }));

  expect(screen.queryByText('3 transactions imported')).not.toBeInTheDocument();
  expect(screen.getByText('Choose a CSV file')).toBeInTheDocument();
});

it('resets when closed, so a stale result is not waiting next time', async () => {
  mockedImport.mockResolvedValue(result());
  const onClose = vi.fn();
  render(<ImportDialog open onClose={onClose} />);

  await upload();
  await userEvent.click(await screen.findByRole('button', { name: 'Done' }));

  expect(onClose).toHaveBeenCalled();
  expect(screen.queryByText('3 transactions imported')).not.toBeInTheDocument();
});

it('says which format it read the file as', async () => {
  mockedImport.mockResolvedValue(result());
  renderDialog();

  await upload();

  expect(await screen.findByText('Read as: SEB account statement')).toBeInTheDocument();
});

it('explains that both a statement and an edited export are accepted', () => {
  renderDialog();

  expect(screen.getByText(/A SEB account statement\./)).toBeInTheDocument();
  expect(screen.getByText(/with the categories edited/)).toBeInTheDocument();
});

describe('an edited export coming back', () => {
  const categoryResult = (over = {}) => ({
    format: 'tumbaland' as const,
    kind: 'categories' as const,
    updated: 12,
    unchanged: 3,
    notFound: 0,
    malformed: 0,
    categories: [{ category: 'Groceries', count: 12 }],
    ...over
  });

  it('reports what it recategorised, not what it imported', async () => {
    mockedImport.mockResolvedValue(categoryResult());
    renderDialog();

    await upload('id;category\nabc;Groceries');

    expect(await screen.findByText('12 transactions recategorised')).toBeInTheDocument();
    expect(screen.getByText('Read as: Tumbaland export')).toBeInTheDocument();
    // The statement panel's own heading, not the standing help text above it
    expect(screen.queryByText(/transactions imported/)).not.toBeInTheDocument();
  });

  it('lists what rows moved into', async () => {
    mockedImport.mockResolvedValue(categoryResult());
    renderDialog();

    await upload();

    expect(await screen.findByText('Groceries: 12')).toBeInTheDocument();
  });

  it('notes rows that were already in that category', async () => {
    mockedImport.mockResolvedValue(categoryResult());
    renderDialog();

    await upload();

    expect(await screen.findByText(/3 rows were already in the category/)).toBeInTheDocument();
  });

  it('flags ids that match nothing here', async () => {
    mockedImport.mockResolvedValue(categoryResult({ notFound: 2 }));
    renderDialog();

    await upload();

    expect(await screen.findByText(/2 ids in the file do not match/)).toBeInTheDocument();
  });

  it('flags rows it could not read', async () => {
    mockedImport.mockResolvedValue(categoryResult({ malformed: 5 }));
    renderDialog();

    await upload();

    expect(await screen.findByText(/5 rows had no usable id or category/)).toBeInTheDocument();
  });

  it('says plainly when nothing changed', async () => {
    mockedImport.mockResolvedValue(categoryResult({ updated: 0, categories: [] }));
    renderDialog();

    await upload();

    expect(await screen.findByText('No categories changed')).toBeInTheDocument();
  });
});

describe('a Pensionikeskus statement', () => {
  const pensionResult = (over = {}) => ({
    format: 'pensionikeskus' as const,
    kind: 'pension' as const,
    imported: 7,
    duplicates: 0,
    coveredByBank: 3,
    contributions: 10,
    skipped: {},
    period: { from: '2026-01-05', to: '2026-07-14' },
    funds: ['LHV Pensionifond Indeks III', 'SEB pensionifond indeks'],
    byPillar: [
      { pillar: 'II' as const, count: 7, amount: 4249, action: 'Imported — never appears on a bank statement' },
      { pillar: 'III' as const, count: 3, amount: 6000, action: 'Already paid by bank transfer; only unmatched ones imported' }
    ],
    ...over
  });

  it('reports contributions rather than transactions', async () => {
    mockedImport.mockResolvedValue(pensionResult());
    renderDialog();

    await upload();

    expect(await screen.findByText('7 contributions imported')).toBeInTheDocument();
    expect(screen.getAllByText('Read as: Pensionikeskus account statement').length).toBeGreaterThan(0);
  });

  it('breaks the result down by pillar, since the two are handled oppositely', async () => {
    mockedImport.mockResolvedValue(pensionResult());
    renderDialog();

    await upload();

    // Exact strings: /II pillar/ as a regex also matches "III pillar"
    expect(await screen.findByText('II pillar')).toBeInTheDocument();
    expect(screen.getByText('III pillar')).toBeInTheDocument();
    expect(screen.getByText(/never appears on a bank statement/)).toBeInTheDocument();
    expect(screen.getByText(/only unmatched ones imported/)).toBeInTheDocument();
  });

  it('explains why the III pillar ones were left alone', async () => {
    // Otherwise "10 in the file, 7 imported" reads as three going missing
    mockedImport.mockResolvedValue(pensionResult());
    renderDialog();

    await upload();

    expect(await screen.findByText(/Counting them here would double them/)).toBeInTheDocument();
  });

  it('says plainly when a re-import adds nothing', async () => {
    mockedImport.mockResolvedValue(pensionResult({ imported: 0, duplicates: 7 }));
    renderDialog();

    await upload();

    expect(await screen.findByText('Nothing new to import')).toBeInTheDocument();
    expect(screen.getByText(/7 already imported from an earlier statement/)).toBeInTheDocument();
  });

  it('names the funds it saw', async () => {
    mockedImport.mockResolvedValue(pensionResult());
    renderDialog();

    await upload();

    expect(
      await screen.findByText(/LHV Pensionifond Indeks III, SEB pensionifond indeks/)
    ).toBeInTheDocument();
  });

  it('tells the reader a pension statement is accepted at all', () => {
    renderDialog();

    expect(screen.getByText(/A Pensionikeskus account statement\./)).toBeInTheDocument();
  });
});

describe('choosing the file type', () => {
  const pickFormat = async (label: string) => {
    await userEvent.click(screen.getByLabelText('File type'));
    await userEvent.click(await screen.findByRole('option', { name: label }));
  };

  it('detects the format by default, asserting nothing', async () => {
    mockedImport.mockResolvedValue(result());
    renderDialog();

    await upload();

    expect(mockedImport).toHaveBeenCalledWith(expect.objectContaining({ format: undefined }));
  });

  it('says the format will be worked out when nothing is chosen', () => {
    renderDialog();

    expect(screen.getByText(/Worked out from the file/)).toBeInTheDocument();
  });

  it('offers every format the importer reads', async () => {
    renderDialog();
    await userEvent.click(screen.getByLabelText('File type'));

    for (const label of [
      'Detect automatically',
      'SEB account statement',
      'Pensionikeskus account statement',
      'Tumbaland export'
    ]) {
      expect(await screen.findByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('sends the chosen format so the server can check it', async () => {
    mockedImport.mockResolvedValue(result());
    renderDialog();

    await pickFormat('Pensionikeskus account statement');
    await upload();

    expect(mockedImport).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'pensionikeskus' })
    );
  });

  it('warns that a mismatched file will be refused', async () => {
    renderDialog();

    await pickFormat('SEB account statement');

    expect(
      screen.getByText('The file will be refused if it is not a SEB account statement.')
    ).toBeInTheDocument();
  });

  it('surfaces the server refusing a file of the wrong type', async () => {
    // Reading a statement as a category list would silently do nothing
    mockedImport.mockRejectedValue(
      new Error('This looks like a SEB account statement, not a Tumbaland export.')
    );
    renderDialog();

    await pickFormat('Tumbaland export');
    await upload();

    expect(
      await screen.findByText(/This looks like a SEB account statement/)
    ).toBeInTheDocument();
  });

  it('keeps the choice between files, for uploading several of a kind', async () => {
    mockedImport.mockResolvedValue(result());
    renderDialog();

    await pickFormat('SEB account statement');
    await upload();
    await upload();

    expect(mockedImport).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'seb' }));
  });
});
