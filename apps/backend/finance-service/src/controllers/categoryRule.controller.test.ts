import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../services/categoryRule.service', () => ({
  listRules: jest.fn(),
  saveRule: jest.fn(),
  updateRule: jest.fn(),
  deleteRule: jest.fn(),
  moveRule: jest.fn(),
  applyRulesToExisting: jest.fn()
}));

import * as service from '../services/categoryRule.service';
import app from '../app';

const mockedList = service.listRules as jest.Mock;
const mockedSave = service.saveRule as jest.Mock;
const mockedUpdate = service.updateRule as jest.Mock;
const mockedDelete = service.deleteRule as jest.Mock;
const mockedMove = service.moveRule as jest.Mock;
const mockedApply = service.applyRulesToExisting as jest.Mock;

function authCookie(groups: string[] = []) {
  const token = jwt.sign(
    { id: 'user-1', email: 'user@example.com', name: 'Test User', groups },
    'test-secret'
  );
  return `access_token=${token}`;
}

const rule = { _id: 'r1', pattern: 'RIMI', category: 'Groceries', priority: 0 };

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/category-rules', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/category-rules');

    expect(res.status).toBe(401);
  });

  it('returns the personal rules when no group is given', async () => {
    mockedList.mockResolvedValue([rule]);

    const res = await request(app).get('/api/category-rules').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [rule] });
    expect(mockedList).toHaveBeenCalledWith('user-1', []);
  });

  it('returns the group rules when working in a group', async () => {
    mockedList.mockResolvedValue([]);

    await request(app)
      .get('/api/category-rules?groupId=g1')
      .set('Cookie', authCookie(['g1']));

    expect(mockedList).toHaveBeenCalledWith('user-1', ['g1']);
  });

  it('refuses a group the caller does not belong to', async () => {
    const res = await request(app)
      .get('/api/category-rules?groupId=g9')
      .set('Cookie', authCookie(['g1']));

    expect(res.status).toBe(403);
    expect(mockedList).not.toHaveBeenCalled();
  });
});

describe('POST /api/category-rules', () => {
  it('creates a rule and says what it will do', async () => {
    mockedSave.mockResolvedValue({ rule, replaced: false });

    const res = await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ pattern: 'RIMI', category: 'Groceries' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('RIMI will be filed as Groceries');
    expect(mockedSave).toHaveBeenCalledWith(
      { pattern: 'RIMI', matchType: 'text', category: 'Groceries', groupId: undefined },
      'user-1',
      []
    );
  });

  it('defaults a rule written from the UI to a plain substring match', async () => {
    mockedSave.mockResolvedValue({ rule, replaced: false });

    await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ pattern: 'BOLT', category: 'Transport' });

    expect(mockedSave).toHaveBeenCalledWith(
      expect.objectContaining({ matchType: 'text' }),
      'user-1',
      []
    );
  });

  it('accepts a regex rule, which is what the migrated ones are', async () => {
    mockedSave.mockResolvedValue({ rule, replaced: false });

    await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ pattern: '\\bBOLT\\b(?! ?Food)', matchType: 'regex', category: 'Transport' });

    expect(mockedSave).toHaveBeenCalledWith(
      expect.objectContaining({ matchType: 'regex' }),
      'user-1',
      []
    );
  });

  it('refuses a match type it does not understand', async () => {
    const res = await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ pattern: 'RIMI', category: 'Groceries', matchType: 'glob' });

    expect(res.status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('reports a replacement as an update rather than a creation', async () => {
    mockedSave.mockResolvedValue({ rule, replaced: true });

    const res = await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ pattern: 'RIMI', category: 'Household' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Rule for RIMI updated');
  });

  it('passes the group through', async () => {
    mockedSave.mockResolvedValue({ rule, replaced: false });

    await request(app)
      .post('/api/category-rules?groupId=g1')
      .set('Cookie', authCookie(['g1']))
      .send({ pattern: 'RIMI', category: 'Groceries' });

    expect(mockedSave).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g1' }),
      'user-1',
      ['g1']
    );
  });

  it('refuses a rule with no pattern', async () => {
    const res = await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ category: 'Groceries' });

    expect(res.status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('refuses a rule with a blank category', async () => {
    const res = await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ pattern: 'RIMI', category: '   ' });

    expect(res.status).toBe(400);
  });

  it('refuses a direction that is neither income nor expense', async () => {
    const res = await request(app)
      .post('/api/category-rules')
      .set('Cookie', authCookie())
      .send({ pattern: 'RIMI', category: 'Groceries', type: 'sideways' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/category-rules/:id', () => {
  it('updates a rule', async () => {
    mockedUpdate.mockResolvedValue({ ...rule, category: 'Household' });

    const res = await request(app)
      .put('/api/category-rules/r1')
      .set('Cookie', authCookie())
      .send({ category: 'Household' });

    expect(res.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith('r1', { category: 'Household' }, 'user-1', []);
  });

  it('lets the direction restriction be cleared', async () => {
    mockedUpdate.mockResolvedValue(rule);

    await request(app)
      .put('/api/category-rules/r1')
      .set('Cookie', authCookie())
      .send({ type: null });

    expect(mockedUpdate).toHaveBeenCalledWith('r1', { type: null }, 'user-1', []);
  });

  it('refuses a blank pattern', async () => {
    const res = await request(app)
      .put('/api/category-rules/r1')
      .set('Cookie', authCookie())
      .send({ pattern: '  ' });

    expect(res.status).toBe(400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});

describe('POST /api/category-rules/:id/move', () => {
  it('moves a rule and returns the new order', async () => {
    mockedMove.mockResolvedValue([rule]);

    const res = await request(app)
      .post('/api/category-rules/r1/move')
      .set('Cookie', authCookie())
      .send({ direction: 'up' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([rule]);
    expect(mockedMove).toHaveBeenCalledWith('r1', 'up', 'user-1', []);
  });

  it('refuses a direction it does not understand', async () => {
    const res = await request(app)
      .post('/api/category-rules/r1/move')
      .set('Cookie', authCookie())
      .send({ direction: 'sideways' });

    expect(res.status).toBe(400);
    expect(mockedMove).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/category-rules/:id', () => {
  it('deletes a rule', async () => {
    mockedDelete.mockResolvedValue(undefined);

    const res = await request(app).delete('/api/category-rules/r1').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(mockedDelete).toHaveBeenCalledWith('r1', 'user-1', []);
  });
});

describe('POST /api/category-rules/apply', () => {
  it('is not read as a rule id', async () => {
    mockedApply.mockResolvedValue({ updated: 3, examined: 40, categories: [] });

    const res = await request(app)
      .post('/api/category-rules/apply')
      .set('Cookie', authCookie())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Recategorised 3 transactions');
    expect(mockedMove).not.toHaveBeenCalled();
  });

  it('leaves sorted rows alone unless asked otherwise', async () => {
    mockedApply.mockResolvedValue({ updated: 0, examined: 0, categories: [] });

    await request(app).post('/api/category-rules/apply').set('Cookie', authCookie()).send({});

    expect(mockedApply).toHaveBeenCalledWith('user-1', [], {
      groupId: undefined,
      onlyUncategorised: true
    });
  });

  it('reaches every row when explicitly asked', async () => {
    mockedApply.mockResolvedValue({ updated: 0, examined: 0, categories: [] });

    await request(app)
      .post('/api/category-rules/apply')
      .set('Cookie', authCookie())
      .send({ onlyUncategorised: false });

    expect(mockedApply).toHaveBeenCalledWith(
      'user-1',
      [],
      expect.objectContaining({ onlyUncategorised: false })
    );
  });

  it('uses the singular for a single row', async () => {
    mockedApply.mockResolvedValue({ updated: 1, examined: 9, categories: [] });

    const res = await request(app)
      .post('/api/category-rules/apply')
      .set('Cookie', authCookie())
      .send({});

    expect(res.body.message).toBe('Recategorised 1 transaction');
  });

  it('says so when the rules had nothing left to do', async () => {
    mockedApply.mockResolvedValue({ updated: 0, examined: 12, categories: [] });

    const res = await request(app)
      .post('/api/category-rules/apply')
      .set('Cookie', authCookie())
      .send({});

    expect(res.body.message).toBe('Nothing left for these rules to change');
  });

  it('refuses a group the caller does not belong to', async () => {
    const res = await request(app)
      .post('/api/category-rules/apply?groupId=g9')
      .set('Cookie', authCookie(['g1']))
      .send({});

    expect(res.status).toBe(403);
    expect(mockedApply).not.toHaveBeenCalled();
  });
});
