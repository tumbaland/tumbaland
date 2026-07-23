import { Request, Response } from 'express';
import { healthCheck } from './healthController';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('healthCheck', () => {
  it('responds 200 with ok status and no database dependency (public has no DB)', async () => {
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'public-service',
        type: 'backend',
        description: 'Public API endpoints service'
      })
    );
    expect(body).not.toHaveProperty('dependencies');
  });
});
