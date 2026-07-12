import { Response } from 'express';
import { createApiResponse, sendSuccess, sendError } from './response';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('createApiResponse', () => {
  it('omits undefined optional fields', () => {
    expect(createApiResponse(true)).toEqual({ success: true });
  });

  it('includes provided fields', () => {
    expect(createApiResponse(true, { id: 1 }, 'ok', undefined, 'corr-1')).toEqual({
      success: true,
      data: { id: 1 },
      message: 'ok',
      correlationId: 'corr-1'
    });
  });

  it('keeps data even when falsy but defined (e.g. 0 or empty array)', () => {
    expect(createApiResponse(true, 0)).toEqual({ success: true, data: 0 });
    expect(createApiResponse(true, [])).toEqual({ success: true, data: [] });
  });
});

describe('sendSuccess', () => {
  it('defaults to status 200 with a success envelope', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 }, 'created');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1 }, message: 'created' });
  });

  it('honors a custom status code', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 }, 'created', 201);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('sendError', () => {
  it('defaults to status 500 with an error envelope', () => {
    const res = mockRes();
    sendError(res, 'Something broke');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Something broke' });
  });

  it('honors a custom status code and error code', () => {
    const res = mockRes();
    sendError(res, 'Not found', 404, 'NOT_FOUND');

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Not found', error: 'NOT_FOUND' });
  });
});
