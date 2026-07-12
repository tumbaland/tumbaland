import { Request, Response } from 'express';
import { submitLogs, getLogsHealth } from './logController';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('submitLogs', () => {
  it('processes a single log entry, defaulting missing fields', async () => {
    const res = mockRes();

    await submitLogs({ body: { message: 'hello' } } as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'logged', count: 1 })
    );
  });

  it('processes an array of log entries', async () => {
    const res = mockRes();

    await submitLogs(
      { body: [{ message: 'a', service: 'album-front' }, { message: 'b', level: 'error' }] } as unknown as Request,
      res
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }));
  });
});

describe('getLogsHealth', () => {
  it('responds 200 with a healthy status', async () => {
    const res = mockRes();

    await getLogsHealth({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'healthy' }));
  });
});
