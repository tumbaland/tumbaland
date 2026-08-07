import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../services/statementSettings.service', () => ({
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  getOwnerNameTest: jest.fn()
}));

import * as service from '../services/statementSettings.service';
import app from '../app';

const mockedGet = service.getSettings as jest.Mock;
const mockedSave = service.saveSettings as jest.Mock;

function authCookie(groups: string[] = []) {
  const token = jwt.sign({ id: 'user-1', email: 'u@e.com', name: 'T', groups }, 'test-secret');
  return `access_token=${token}`;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ ownerNames: [] });
  mockedSave.mockImplementation((input: { ownerNames: string[] }) => Promise.resolve(input));
});

describe('GET /api/statement-settings', () => {
  it('rejects requests with no access token', async () => {
    expect((await request(app).get('/api/statement-settings')).status).toBe(401);
  });

  it('returns the owner names', async () => {
    mockedGet.mockResolvedValue({ ownerNames: ['ALEX SMITH'] });

    const res = await request(app).get('/api/statement-settings').set('Cookie', authCookie());

    expect(res.body).toEqual({ success: true, data: { ownerNames: ['ALEX SMITH'] } });
    expect(mockedGet).toHaveBeenCalledWith('user-1', []);
  });

  it('reads the group scope when working in a group', async () => {
    await request(app).get('/api/statement-settings?groupId=g1').set('Cookie', authCookie(['g1']));

    expect(mockedGet).toHaveBeenCalledWith('user-1', ['g1']);
  });

  it('refuses a group the caller does not belong to', async () => {
    const res = await request(app)
      .get('/api/statement-settings?groupId=g9')
      .set('Cookie', authCookie(['g1']));

    expect(res.status).toBe(403);
    expect(mockedGet).not.toHaveBeenCalled();
  });
});

describe('PUT /api/statement-settings', () => {
  it('saves the names', async () => {
    const res = await request(app)
      .put('/api/statement-settings')
      .set('Cookie', authCookie())
      .send({ ownerNames: ['ALEX SMITH', 'SMITH ALEX'] });

    expect(res.status).toBe(200);
    expect(mockedSave).toHaveBeenCalledWith(
      { ownerNames: ['ALEX SMITH', 'SMITH ALEX'], groupId: undefined },
      'user-1',
      []
    );
  });

  it('passes the group through', async () => {
    await request(app)
      .put('/api/statement-settings?groupId=g1')
      .set('Cookie', authCookie(['g1']))
      .send({ ownerNames: ['ALEX SMITH'] });

    expect(mockedSave).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g1' }),
      'user-1',
      ['g1']
    );
  });

  it('accepts an empty list, which turns name matching off', async () => {
    const res = await request(app)
      .put('/api/statement-settings')
      .set('Cookie', authCookie())
      .send({ ownerNames: [] });

    expect(res.status).toBe(200);
  });

  it('refuses a blank name, which would match every counterparty', async () => {
    const res = await request(app)
      .put('/api/statement-settings')
      .set('Cookie', authCookie())
      .send({ ownerNames: ['   '] });

    expect(res.status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('refuses a body with no names at all', async () => {
    const res = await request(app)
      .put('/api/statement-settings')
      .set('Cookie', authCookie())
      .send({});

    expect(res.status).toBe(400);
  });
});
