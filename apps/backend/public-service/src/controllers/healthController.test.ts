import { Request, Response } from 'express';
import { healthCheck } from './healthController';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('healthCheck', () => {
  it('responds 200 with ok status', async () => {
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', service: 'public-service' }));
  });
});
