import { vi } from 'vite-plus/test';
import {
  getCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  moveCategoryRule,
  applyCategoryRules
} from './categoryRuleService';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body
  } as Response);
}

const lastCall = () => (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];

const rule = {
  _id: 'r1',
  pattern: 'RIMI',
  matchType: 'text',
  category: 'Groceries',
  priority: 0
};

describe('getCategoryRules', () => {
  it('unwraps the envelope', async () => {
    mockFetchOnce({ success: true, data: [rule] });

    expect(await getCategoryRules()).toEqual([rule]);
    expect(String(lastCall()[0])).toContain('/category-rules');
  });

  it('scopes to a group when one is given', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getCategoryRules('g1');

    expect(String(lastCall()[0])).toContain('groupId=g1');
  });
});

describe('createCategoryRule', () => {
  it('posts the rule and returns what was written', async () => {
    mockFetchOnce({ success: true, data: rule });

    const result = await createCategoryRule({ pattern: 'RIMI', category: 'Groceries' });

    expect(result).toEqual(rule);
    const [url, init] = lastCall();
    expect(String(url)).toContain('/category-rules');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ pattern: 'RIMI', category: 'Groceries' })
    });
  });

  it('does not put the group in the body, where it would be read as a field', async () => {
    mockFetchOnce({ success: true, data: rule });

    await createCategoryRule({ pattern: 'RIMI', category: 'Groceries' }, 'g1');

    const [url, init] = lastCall();
    expect(String(url)).toContain('groupId=g1');
    expect(String((init as RequestInit).body)).not.toContain('groupId');
  });
});

describe('updateCategoryRule', () => {
  it('updates via PUT', async () => {
    mockFetchOnce({ success: true, data: { ...rule, category: 'Household' } });

    const result = await updateCategoryRule('r1', { category: 'Household' });

    expect(result.category).toBe('Household');
    const [url, init] = lastCall();
    expect(String(url)).toContain('/category-rules/r1');
    expect(init).toMatchObject({ method: 'PUT' });
  });

  it('sends an explicit null to clear the direction restriction', async () => {
    mockFetchOnce({ success: true, data: rule });

    await updateCategoryRule('r1', { type: null });

    expect(String((lastCall()[1] as RequestInit).body)).toContain('"type":null');
  });
});

describe('deleteCategoryRule', () => {
  it('deletes by id', async () => {
    mockFetchOnce({ success: true });

    await deleteCategoryRule('r1');

    const [url, init] = lastCall();
    expect(String(url)).toContain('/category-rules/r1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });
});

describe('moveCategoryRule', () => {
  it('posts the direction and returns the new order', async () => {
    mockFetchOnce({ success: true, data: [rule] });

    const result = await moveCategoryRule('r1', 'up');

    expect(result).toEqual([rule]);
    const [url, init] = lastCall();
    expect(String(url)).toContain('/category-rules/r1/move');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ direction: 'up' }) });
  });
});

describe('applyCategoryRules', () => {
  it('returns what changed', async () => {
    mockFetchOnce({
      success: true,
      data: { updated: 40, examined: 120, categories: [{ category: 'Groceries', count: 40 }] }
    });

    const result = await applyCategoryRules({ onlyUncategorised: true });

    expect(result.updated).toBe(40);
    const [url, init] = lastCall();
    expect(String(url)).toContain('/category-rules/apply');
    expect(init).toMatchObject({ body: JSON.stringify({ onlyUncategorised: true }) });
  });

  it('keeps the group out of the body and in the query', async () => {
    mockFetchOnce({ success: true, data: { updated: 0, examined: 0, categories: [] } });

    await applyCategoryRules({ onlyUncategorised: false, groupId: 'g1' });

    const [url, init] = lastCall();
    expect(String(url)).toContain('groupId=g1');
    expect(String((init as RequestInit).body)).not.toContain('groupId');
  });
});
