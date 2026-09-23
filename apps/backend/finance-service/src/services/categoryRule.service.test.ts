jest.mock('../models/CategoryRule', () => {
  const MockCategoryRule = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: 'new-rule-id', ...data })
  })) as jest.Mock & Record<string, jest.Mock>;
  MockCategoryRule.find = jest.fn();
  MockCategoryRule.findOne = jest.fn();
  MockCategoryRule.findById = jest.fn();
  MockCategoryRule.findByIdAndDelete = jest.fn();
  return { __esModule: true, default: MockCategoryRule };
});

jest.mock('../models/Transaction', () => ({
  __esModule: true,
  default: { find: jest.fn(), bulkWrite: jest.fn() }
}));

import CategoryRule from '../models/CategoryRule';
import Transaction from '../models/Transaction';
import {
  listRules,
  getCompiledRules,
  saveRule,
  updateRule,
  deleteRule,
  moveRule,
  applyRulesToExisting
} from './categoryRule.service';

const MockedCategoryRule = CategoryRule as unknown as jest.Mock;
const mockedFind = CategoryRule.find as unknown as jest.Mock;
const mockedFindOne = CategoryRule.findOne as unknown as jest.Mock;
const mockedFindById = CategoryRule.findById as unknown as jest.Mock;
const mockedFindByIdAndDelete = CategoryRule.findByIdAndDelete as unknown as jest.Mock;
const mockedTxFind = Transaction.find as unknown as jest.Mock;
const mockedBulkWrite = Transaction.bulkWrite as unknown as jest.Mock;

/** A stored rule with the `save()` a document would carry. */
const stored = (over: Record<string, unknown> = {}) => ({
  _id: 'r1',
  pattern: 'RIMI',
  category: 'Groceries',
  priority: 0,
  userId: 'u1',
  save: jest.fn().mockImplementation(function (this: unknown) {
    return Promise.resolve(this);
  }),
  ...over
});

/** `find()` used as a list (with `.sort()`) and as a plain await, as both occur. */
const findReturns = (rules: unknown[]) => {
  mockedFind.mockImplementation(() => {
    return Object.assign(Promise.resolve(rules), { sort: jest.fn().mockResolvedValue(rules) });
  });
};

const lastPriority = (priority: number | null) =>
  mockedFindOne.mockReturnValue({
    sort: () => ({ select: () => ({ lean: jest.fn().mockResolvedValue(priority === null ? null : { priority }) }) })
  });

beforeEach(() => {
  jest.clearAllMocks();
  findReturns([]);
  lastPriority(null);
  mockedBulkWrite.mockResolvedValue({});
});

describe('listRules', () => {
  it('scopes to the caller and runs them in order', async () => {
    const sort = jest.fn().mockResolvedValue([]);
    mockedFind.mockReturnValue({ sort });

    await listRules('u1');

    expect(mockedFind).toHaveBeenCalledWith({
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
    expect(sort).toHaveBeenCalledWith({ priority: 1, createdAt: 1 });
  });

  it('reads the group rules when working in a group', async () => {
    mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    await listRules('u1', ['g1']);

    expect(mockedFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });
});

describe('getCompiledRules', () => {
  it('folds and lowercases the pattern for matching', async () => {
    findReturns([stored({ pattern: ' Külapood ' })]);

    expect(await getCompiledRules('u1')).toEqual([
      { pattern: ' Külapood ', needle: 'kulapood', category: 'Groceries', type: undefined }
    ]);
  });

  it('drops a rule with nothing left to match on', async () => {
    findReturns([stored({ pattern: '   ' })]);

    expect(await getCompiledRules('u1')).toEqual([]);
  });

  it('compiles a migrated regex rule into an expression', async () => {
    findReturns([stored({ pattern: '\\bBOLT\\b(?! ?Food)', matchType: 'regex', category: 'Transport' })]);

    const [rule] = await getCompiledRules('u1');

    expect(rule.expression).toBeInstanceOf(RegExp);
    expect(rule.expression!.test('BOLT OU')).toBe(true);
    expect(rule.expression!.test('BOLT FOOD OU')).toBe(false);
  });
});

describe('saveRule', () => {
  it('writes a new rule at the end of the order', async () => {
    lastPriority(4);

    const { rule, replaced } = await saveRule({ pattern: ' VELOMARKET ', category: ' Bicycle ' }, 'u1');

    expect(replaced).toBe(false);
    expect(MockedCategoryRule).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: 'VELOMARKET', category: 'Bicycle', priority: 5, userId: 'u1' })
    );
    expect(rule).toMatchObject({ pattern: 'VELOMARKET' });
  });

  it('starts the order at zero when there is nothing yet', async () => {
    await saveRule({ pattern: 'VELOMARKET', category: 'Bicycle' }, 'u1');

    expect(MockedCategoryRule).toHaveBeenCalledWith(expect.objectContaining({ priority: 0 }));
  });

  it('replaces the rule already covering that text rather than adding a second', async () => {
    const existing = stored({ pattern: 'RIMI', category: 'Groceries' });
    findReturns([existing]);

    const { rule, replaced } = await saveRule({ pattern: ' rimi ', category: 'Household' }, 'u1');

    expect(replaced).toBe(true);
    expect(rule).toMatchObject({ category: 'Household' });
    expect(MockedCategoryRule).not.toHaveBeenCalled();
  });

  it('treats a rule for the other direction as a different rule', async () => {
    findReturns([stored({ pattern: 'NORDBANK', type: 'income' })]);

    const { replaced } = await saveRule(
      { pattern: 'NORDBANK', category: 'Savings', type: 'expense' },
      'u1'
    );

    expect(replaced).toBe(false);
  });

  it('stamps the group on a rule written in a group context', async () => {
    await saveRule({ pattern: 'RIMI', category: 'Groceries', groupId: 'g1' }, 'u1', ['g1']);

    expect(MockedCategoryRule).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      saveRule({ pattern: 'RIMI', category: 'Groceries', groupId: 'g9' }, 'u1', ['g1'])
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('refuses a pattern that is only whitespace', async () => {
    await expect(saveRule({ pattern: '   ', category: 'Groceries' }, 'u1')).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('defaults to a plain substring match', async () => {
    await saveRule({ pattern: 'RIMI', category: 'Groceries' }, 'u1');

    expect(MockedCategoryRule).toHaveBeenCalledWith(expect.objectContaining({ matchType: 'text' }));
  });

  it('keeps a regex rule and its note', async () => {
    await saveRule(
      { pattern: '\\bBOLT\\b(?! ?Food)', matchType: 'regex', category: 'Transport', note: 'why' },
      'u1'
    );

    expect(MockedCategoryRule).toHaveBeenCalledWith(
      expect.objectContaining({ matchType: 'regex', note: 'why' })
    );
  });

  it('refuses a regex that will not compile, where the owner can still see the field', async () => {
    await expect(
      saveRule({ pattern: '(unclosed', matchType: 'regex', category: 'Broken' }, 'u1')
    ).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(MockedCategoryRule).not.toHaveBeenCalled();
  });

  it('refuses a regex that repeats a repeating group, which can stall every import', async () => {
    await expect(
      saveRule({ pattern: '(A+)+$', matchType: 'regex', category: 'Slow' }, 'u1')
    ).rejects.toThrow(/repeats a group that itself repeats/);
    expect(MockedCategoryRule).not.toHaveBeenCalled();
  });

  it('does not read the same text as an existing rule of the other match type', async () => {
    findReturns([stored({ pattern: 'BOLT', matchType: 'regex' })]);

    const { replaced } = await saveRule({ pattern: 'BOLT', category: 'Transport' }, 'u1');

    expect(replaced).toBe(false);
  });
});

describe('updateRule', () => {
  it('renames the pattern and the category', async () => {
    const existing = stored();
    mockedFindById.mockResolvedValue(existing);

    const rule = await updateRule('r1', { pattern: ' RIMI EESTI ', category: ' Food ' }, 'u1');

    expect(rule).toMatchObject({ pattern: 'RIMI EESTI', category: 'Food' });
  });

  it('clears the direction restriction only when asked explicitly', async () => {
    const existing = stored({ type: 'income' });
    mockedFindById.mockResolvedValue(existing);

    expect(await updateRule('r1', { category: 'Wages' }, 'u1')).toMatchObject({ type: 'income' });
    expect(await updateRule('r1', { type: null }, 'u1')).toMatchObject({ type: undefined });
  });

  it('refuses to blank the pattern', async () => {
    mockedFindById.mockResolvedValue(stored());

    await expect(updateRule('r1', { pattern: '  ' }, 'u1')).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('is a 404 for a rule that does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(updateRule('r9', { category: 'X' }, 'u1')).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('refuses a rule belonging to somebody else', async () => {
    mockedFindById.mockResolvedValue(stored({ userId: 'u2' }));

    await expect(updateRule('r1', { category: 'X' }, 'u1')).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('refuses a rename that breaks a regex rule', async () => {
    const existing = stored({ matchType: 'regex', pattern: '\\bBOLT\\b' });
    mockedFindById.mockResolvedValue(existing);

    await expect(updateRule('r1', { pattern: '(unclosed' }, 'u1')).rejects.toMatchObject({
      name: 'BadRequestError'
    });
    expect(existing.save).not.toHaveBeenCalled();
  });

  it('lets a regex rule be renamed to another valid expression', async () => {
    mockedFindById.mockResolvedValue(stored({ matchType: 'regex', pattern: '\\bBOLT\\b' }));

    const rule = await updateRule('r1', { pattern: '\\bBOLT\\b(?! ?Food)' }, 'u1');

    expect(rule).toMatchObject({ pattern: '\\bBOLT\\b(?! ?Food)' });
  });

  it('refuses renaming a regex rule to one that repeats a repeating group', async () => {
    const existing = stored({ matchType: 'regex', pattern: '\\bBOLT\\b' });
    mockedFindById.mockResolvedValue(existing);

    await expect(updateRule('r1', { pattern: '(\\w+\\s?)+' }, 'u1')).rejects.toThrow(
      /repeats a group that itself repeats/
    );
    expect(existing.save).not.toHaveBeenCalled();
  });

  it('still lets a rule saved before the repetition check change category', async () => {
    mockedFindById.mockResolvedValue(stored({ matchType: 'regex', pattern: '(\\w+\\s?)+' }));

    expect(await updateRule('r1', { category: 'Food' }, 'u1')).toMatchObject({ category: 'Food' });
  });

  it('stores a note', async () => {
    mockedFindById.mockResolvedValue(stored());

    expect(await updateRule('r1', { note: 'why this exists' }, 'u1')).toMatchObject({
      note: 'why this exists'
    });
  });
});

describe('deleteRule', () => {
  it('deletes a rule the caller owns', async () => {
    mockedFindById.mockResolvedValue(stored());

    await deleteRule('r1', 'u1');

    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('r1');
  });

  it('refuses a rule belonging to somebody else', async () => {
    mockedFindById.mockResolvedValue(stored({ userId: 'u2' }));

    await expect(deleteRule('r1', 'u1')).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedFindByIdAndDelete).not.toHaveBeenCalled();
  });
});

describe('moveRule', () => {
  const three = () => [
    stored({ _id: 'r1', pattern: 'A', priority: 0 }),
    stored({ _id: 'r2', pattern: 'B', priority: 1 }),
    stored({ _id: 'r3', pattern: 'C', priority: 2 })
  ];

  it('moves a rule earlier, renumbering only what moved', async () => {
    const rules = three();
    mockedFindById.mockResolvedValue(rules[2]);
    findReturns(rules);

    await moveRule('r3', 'up', 'u1');

    expect(rules[1].priority).toBe(2);
    expect(rules[2].priority).toBe(1);
    expect(rules[0].save).not.toHaveBeenCalled();
  });

  it('moves a rule later', async () => {
    const rules = three();
    mockedFindById.mockResolvedValue(rules[0]);
    findReturns(rules);

    await moveRule('r1', 'down', 'u1');

    expect(rules[0].priority).toBe(1);
    expect(rules[1].priority).toBe(0);
  });

  it('does nothing when the rule is already first', async () => {
    const rules = three();
    mockedFindById.mockResolvedValue(rules[0]);
    findReturns(rules);

    await moveRule('r1', 'up', 'u1');

    rules.forEach((rule) => expect(rule.save).not.toHaveBeenCalled());
  });

  it('does nothing when the rule is already last', async () => {
    const rules = three();
    mockedFindById.mockResolvedValue(rules[2]);
    findReturns(rules);

    await moveRule('r3', 'down', 'u1');

    rules.forEach((rule) => expect(rule.save).not.toHaveBeenCalled());
  });

  it('still separates a pair that shares a priority', async () => {
    // Rules written before ordering existed, or restored from a backup.
    const rules = [
      stored({ _id: 'r1', pattern: 'A', priority: 0 }),
      stored({ _id: 'r2', pattern: 'B', priority: 0 })
    ];
    mockedFindById.mockResolvedValue(rules[1]);
    findReturns(rules);

    await moveRule('r2', 'up', 'u1');

    expect(rules[1].priority).toBe(0);
    expect(rules[0].priority).toBe(1);
  });
});

describe('applyRulesToExisting', () => {
  const transactions = (rows: unknown[]) =>
    mockedTxFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) });

  it('does nothing at all when there are no rules', async () => {
    const result = await applyRulesToExisting('u1');

    expect(result).toEqual({ updated: 0, examined: 0, categories: [] });
    expect(mockedTxFind).not.toHaveBeenCalled();
  });

  it('refiles the rows a rule claims', async () => {
    findReturns([stored({ pattern: 'VELOMARKET', category: 'Bicycle' })]);
    transactions([
      { _id: 't1', note: 'VELOMARKET OU · kaart', category: 'Uncategorised', type: 'expense' },
      { _id: 't2', note: 'RIMI · kaart', category: 'Uncategorised', type: 'expense' }
    ]);

    const result = await applyRulesToExisting('u1');

    expect(result).toEqual({
      updated: 1,
      examined: 2,
      categories: [{ category: 'Bicycle', count: 1 }]
    });
    expect(mockedBulkWrite).toHaveBeenCalledWith(
      [{ updateOne: { filter: { _id: 't1' }, update: { $set: { category: 'Bicycle' } } } }],
      { ordered: false }
    );
  });

  it('leaves alone a row already in the category the rule names', async () => {
    findReturns([stored({ pattern: 'RIMI', category: 'Groceries' })]);
    transactions([{ _id: 't1', note: 'RIMI · kaart', category: 'Groceries', type: 'expense' }]);

    const result = await applyRulesToExisting('u1', [], { onlyUncategorised: false });

    expect(result.updated).toBe(0);
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('only looks at unsorted rows by default', async () => {
    findReturns([stored()]);
    transactions([]);

    await applyRulesToExisting('u1');

    expect(mockedTxFind).toHaveBeenCalledWith(
      expect.objectContaining({ category: { $in: ['Other income', 'Uncategorised'] } }),
      expect.anything()
    );
  });

  it('reaches every row when explicitly asked to', async () => {
    findReturns([stored()]);
    transactions([]);

    await applyRulesToExisting('u1', [], { onlyUncategorised: false });

    expect(mockedTxFind.mock.calls[0][0]).not.toHaveProperty('category');
  });

  it('honours a rule restricted to one direction', async () => {
    findReturns([stored({ pattern: 'ACME', category: 'Consulting', type: 'income' })]);
    transactions([
      { _id: 't1', note: 'ACME OU · invoice', category: 'Uncategorised', type: 'expense' }
    ]);

    expect((await applyRulesToExisting('u1')).updated).toBe(0);
  });

  it('tolerates a row with no note', async () => {
    findReturns([stored()]);
    transactions([{ _id: 't1', category: 'Uncategorised', type: 'expense' }]);

    expect((await applyRulesToExisting('u1')).updated).toBe(0);
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(applyRulesToExisting('u1', ['g1'], { groupId: 'g9' })).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('orders the summary by how many rows each category took', async () => {
    findReturns([
      stored({ _id: 'r1', pattern: 'RIMI', category: 'Groceries' }),
      stored({ _id: 'r2', pattern: 'BOLT', category: 'Transport' })
    ]);
    transactions([
      { _id: 't1', note: 'BOLT · ride', category: 'Uncategorised', type: 'expense' },
      { _id: 't2', note: 'RIMI · kaart', category: 'Uncategorised', type: 'expense' },
      { _id: 't3', note: 'RIMI · kaart', category: 'Uncategorised', type: 'expense' }
    ]);

    const result = await applyRulesToExisting('u1');

    expect(result.categories).toEqual([
      { category: 'Groceries', count: 2 },
      { category: 'Transport', count: 1 }
    ]);
  });
});
