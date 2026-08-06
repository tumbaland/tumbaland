import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedImport = vi.fn();
vi.mock('../../hooks/useCashflow', () => ({
  useImportStatement: () => ({ mutateAsync: mockedImport, isPending: false })
}));

import ImportDialog from './ImportDialog';

const result = (over = {}) => ({
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

  await waitFor(() =>
    expect(mockedImport).toHaveBeenCalledWith({ csv: 'Kliendi konto;a\nrow-data', groupId: 'g1' })
  );
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
