import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CategoryRule } from '../../services/categoryRuleService';

const mockedCreate = vi.fn();
const mockedDelete = vi.fn();
const mockedMove = vi.fn();
const mockedApply = vi.fn();
const mockedSaveSettings = vi.fn();
let settingsState: { data?: { ownerNames: string[] } } = { data: { ownerNames: [] } };
let rulesState: { data: CategoryRule[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('../../hooks/useCategoryRules', () => ({
  useCategoryRules: () => rulesState,
  useCreateCategoryRule: () => ({ mutateAsync: mockedCreate, isPending: false }),
  useDeleteCategoryRule: () => ({ mutateAsync: mockedDelete, isPending: false }),
  useMoveCategoryRule: () => ({ mutateAsync: mockedMove, isPending: false }),
  useApplyCategoryRules: () => ({ mutateAsync: mockedApply, isPending: false })
}));

vi.mock('../../hooks/useStatementSettings', () => ({
  useStatementSettings: () => settingsState,
  useUpdateStatementSettings: () => ({ mutateAsync: mockedSaveSettings, isPending: false })
}));

import CategoryRulesDialog from './CategoryRulesDialog';

const rule = (over: Partial<CategoryRule> = {}): CategoryRule => ({
  _id: 'r1',
  pattern: 'RIMI',
  matchType: 'text',
  category: 'Groceries',
  priority: 0,
  ...over
});

const renderDialog = (props = {}) => {
  const notify = vi.fn();
  const onClose = vi.fn();
  render(
    <CategoryRulesDialog
      open
      onClose={onClose}
      categories={['Groceries', 'Transport']}
      notify={notify}
      {...props}
    />
  );
  return { notify, onClose };
};

const addRule = async (pattern: string, category: string) => {
  await userEvent.type(screen.getByLabelText('Text to look for'), pattern);
  await userEvent.type(screen.getByLabelText('File it as'), category);
  await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  rulesState = { data: [], isLoading: false };
  mockedCreate.mockResolvedValue({});
  mockedApply.mockResolvedValue({ updated: 0, examined: 0, categories: [] });
  mockedSaveSettings.mockResolvedValue({ ownerNames: [] });
  settingsState = { data: { ownerNames: [] } };
});

describe('the list', () => {
  it('explains that order decides the outcome', () => {
    renderDialog();

    expect(screen.getByText(/the first that matches wins/)).toBeInTheDocument();
  });

  it('says what an empty list means for an import', () => {
    renderDialog();

    expect(screen.getByText(/every import lands in Uncategorised/)).toBeInTheDocument();
  });

  it('lists the rules in running order', () => {
    rulesState = {
      data: [
        rule({ _id: 'r1', pattern: 'BOLT FOOD', category: 'Restaurants' }),
        rule({ _id: 'r2', pattern: 'BOLT', category: 'Transport' })
      ],
      isLoading: false
    };
    renderDialog();

    const rows = screen.getAllByRole('row').slice(1); // drop the header
    expect(within(rows[0]).getByText('BOLT FOOD')).toBeInTheDocument();
    expect(within(rows[1]).getByText('BOLT')).toBeInTheDocument();
  });

  it('marks a migrated regex rule as a pattern rather than literal text', () => {
    rulesState = {
      data: [rule({ pattern: '\\bBOLT\\b(?! ?Food)', matchType: 'regex' })],
      isLoading: false
    };
    renderDialog();

    expect(screen.getByText('regex')).toBeInTheDocument();
  });

  it('shows which direction a rule is restricted to', () => {
    rulesState = { data: [rule({ type: 'income' })], isLoading: false };
    renderDialog();

    expect(screen.getByText('Money in')).toBeInTheDocument();
  });

  it('shows a rule with no restriction as applying either way', () => {
    rulesState = { data: [rule()], isLoading: false };
    renderDialog();

    expect(screen.getByText('Either')).toBeInTheDocument();
  });

  it('waits rather than claiming there are no rules while they load', () => {
    rulesState = { data: [], isLoading: true };
    renderDialog();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/every import lands in Uncategorised/)).not.toBeInTheDocument();
  });
});

describe('adding a rule', () => {
  it('saves it and clears the form for the next one', async () => {
    const { notify } = renderDialog({ tenantGroupId: 'g1' });

    await addRule('VELOMARKET', 'Bicycle');

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith({
        pattern: 'VELOMARKET',
        category: 'Bicycle',
        groupId: 'g1'
      })
    );
    expect(notify).toHaveBeenCalledWith('VELOMARKET will be filed as Bicycle', 'success');
    expect(screen.getByLabelText('Text to look for')).toHaveValue('');
  });

  it('carries a direction restriction when one is picked', async () => {
    renderDialog();

    await userEvent.click(screen.getByLabelText('Applies to'));
    await userEvent.click(await screen.findByRole('option', { name: 'Money in' }));
    await addRule('ACME', 'Consulting');

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ type: 'income' }))
    );
  });

  it('refuses a rule with no text to match on', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('File it as'), 'Bicycle');
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    expect(screen.getByText(/A rule needs both/)).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('refuses a rule with no category', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Text to look for'), 'VELOMARKET');
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    expect(screen.getByText(/A rule needs both/)).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('surfaces a failure instead of clearing the form', async () => {
    mockedCreate.mockRejectedValue(new Error('nope'));
    renderDialog();

    await addRule('VELOMARKET', 'Bicycle');

    await waitFor(() => expect(screen.getByText('Failed to save the rule')).toBeInTheDocument());
    expect(screen.getByLabelText('Text to look for')).toHaveValue('VELOMARKET');
  });
});

describe('reordering', () => {
  beforeEach(() => {
    rulesState = {
      data: [rule({ _id: 'r1', pattern: 'BOLT FOOD' }), rule({ _id: 'r2', pattern: 'BOLT' })],
      isLoading: false
    };
  });

  it('moves a rule later', async () => {
    mockedMove.mockResolvedValue([]);
    renderDialog({ tenantGroupId: 'g1' });

    await userEvent.click(screen.getByLabelText('Move BOLT FOOD later'));

    await waitFor(() =>
      expect(mockedMove).toHaveBeenCalledWith({ id: 'r1', direction: 'down', groupId: 'g1' })
    );
  });

  it('moves a rule earlier', async () => {
    mockedMove.mockResolvedValue([]);
    renderDialog();

    await userEvent.click(screen.getByLabelText('Move BOLT earlier'));

    await waitFor(() =>
      expect(mockedMove).toHaveBeenCalledWith({ id: 'r2', direction: 'up', groupId: undefined })
    );
  });

  it('offers no way to move the first rule earlier or the last one later', () => {
    renderDialog();

    expect(screen.getByLabelText('Move BOLT FOOD earlier')).toBeDisabled();
    expect(screen.getByLabelText('Move BOLT later')).toBeDisabled();
  });

  it('reports a failure to reorder', async () => {
    mockedMove.mockRejectedValue(new Error('nope'));
    const { notify } = renderDialog();

    await userEvent.click(screen.getByLabelText('Move BOLT FOOD later'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to reorder the rules', 'error'));
  });
});

describe('deleting', () => {
  beforeEach(() => {
    rulesState = { data: [rule()], isLoading: false };
  });

  it('deletes a rule', async () => {
    mockedDelete.mockResolvedValue(undefined);
    const { notify } = renderDialog();

    await userEvent.click(screen.getByLabelText('Delete rule for RIMI'));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('r1'));
    expect(notify).toHaveBeenCalledWith('Rule for RIMI deleted', 'success');
  });

  it('reports a failed delete', async () => {
    mockedDelete.mockRejectedValue(new Error('nope'));
    const { notify } = renderDialog();

    await userEvent.click(screen.getByLabelText('Delete rule for RIMI'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to delete the rule', 'error'));
  });
});

describe('applying to what is already imported', () => {
  beforeEach(() => {
    rulesState = { data: [rule()], isLoading: false };
  });

  it('is not offered when there are no rules to apply', () => {
    rulesState = { data: [], isLoading: false };
    renderDialog();

    expect(screen.queryByRole('button', { name: /Apply now/ })).not.toBeInTheDocument();
  });

  it('leaves rows sorted by hand alone by default', async () => {
    mockedApply.mockResolvedValue({ updated: 40, examined: 120, categories: [] });
    const { notify } = renderDialog({ tenantGroupId: 'g1' });

    await userEvent.click(screen.getByRole('button', { name: /Apply now/ }));

    await waitFor(() =>
      expect(mockedApply).toHaveBeenCalledWith({ onlyUncategorised: true, groupId: 'g1' })
    );
    expect(notify).toHaveBeenCalledWith('Recategorised 40 of 120 transactions', 'success');
  });

  it('warns before it will touch rows sorted by hand', async () => {
    renderDialog();

    await userEvent.click(screen.getByLabelText('Only touch unsorted rows'));

    expect(screen.getByText(/also refiles rows you sorted by hand/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Apply now/ }));

    await waitFor(() =>
      expect(mockedApply).toHaveBeenCalledWith(expect.objectContaining({ onlyUncategorised: false }))
    );
  });

  it('says so when the rules had nothing left to change', async () => {
    mockedApply.mockResolvedValue({ updated: 0, examined: 12, categories: [] });
    const { notify } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: /Apply now/ }));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Nothing left for these rules to change', 'success')
    );
  });

  it('reports a failure', async () => {
    mockedApply.mockRejectedValue(new Error('nope'));
    const { notify } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: /Apply now/ }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to apply the rules', 'error'));
  });
});

it('closes on Done', async () => {
  const { onClose } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: 'Done' }));

  expect(onClose).toHaveBeenCalled();
});

describe('your name on statements', () => {
  it('explains why the name is needed at all', () => {
    renderDialog();

    expect(screen.getByText(/not income or spending/)).toBeInTheDocument();
  });

  it('says what happens while no name is recorded', () => {
    renderDialog();

    expect(screen.getByText(/only transfers between accounts the statement itself covers/i))
      .toBeInTheDocument();
  });

  it('adds a name', async () => {
    const { notify } = renderDialog({ tenantGroupId: 'g1' });

    await userEvent.type(screen.getByLabelText('Add a name'), 'ALEX SMITH');
    await userEvent.click(screen.getByRole('button', { name: 'Add name' }));

    await waitFor(() =>
      expect(mockedSaveSettings).toHaveBeenCalledWith({
        ownerNames: ['ALEX SMITH'],
        groupId: 'g1'
      })
    );
    expect(notify).toHaveBeenCalledWith('Transfers naming ALEX SMITH will be skipped', 'success');
  });

  it('keeps the name already recorded when adding the other ordering', async () => {
    settingsState = { data: { ownerNames: ['ALEX SMITH'] } };
    renderDialog();

    await userEvent.type(screen.getByLabelText('Add a name'), 'SMITH ALEX');
    await userEvent.click(screen.getByRole('button', { name: 'Add name' }));

    await waitFor(() =>
      expect(mockedSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ ownerNames: ['ALEX SMITH', 'SMITH ALEX'] })
      )
    );
  });

  it('will not add the same name twice', async () => {
    settingsState = { data: { ownerNames: ['ALEX SMITH'] } };
    renderDialog();

    await userEvent.type(screen.getByLabelText('Add a name'), 'ALEX SMITH');
    await userEvent.click(screen.getByRole('button', { name: 'Add name' }));

    expect(mockedSaveSettings).not.toHaveBeenCalled();
  });

  it('removes a name', async () => {
    settingsState = { data: { ownerNames: ['ALEX SMITH', 'SMITH ALEX'] } };
    const { notify } = renderDialog();

    await userEvent.click(screen.getAllByTestId('CancelIcon')[0]);

    await waitFor(() =>
      expect(mockedSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ ownerNames: ['SMITH ALEX'] })
      )
    );
    expect(notify).toHaveBeenCalledWith('ALEX SMITH removed', 'success');
  });

  it('reports a failure to save', async () => {
    mockedSaveSettings.mockRejectedValue(new Error('nope'));
    const { notify } = renderDialog();

    await userEvent.type(screen.getByLabelText('Add a name'), 'ALEX SMITH');
    await userEvent.click(screen.getByRole('button', { name: 'Add name' }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to save your name', 'error'));
  });
});
