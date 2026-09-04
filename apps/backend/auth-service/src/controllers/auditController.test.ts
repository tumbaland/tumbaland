import { Request, Response } from 'express';

jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  listAuditEvents: jest.fn(),
  sendSuccess: jest.fn()
}));

import { listAuditEvents, sendSuccess } from '@tumbaland/backend-core';
import { getAuditTrail } from './auditController';

const listed = listAuditEvents as jest.Mock;
const sent = sendSuccess as jest.Mock;

const req = (over: Partial<Request> = {}): Request =>
  ({ user: { id: 'u1', email: 'a@b.c', name: 'Tom' }, query: {}, ...over }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
  listed.mockResolvedValue({ events: [], total: 0, page: 1, totalPages: 0 });
});

describe('getAuditTrail', () => {
  it('reads only the caller’s own trail', async () => {
    // Scoped by the query and never by a parameter: the trail carries old values
    // and the content of deleted records.
    await getAuditTrail(req({ query: { userId: 'someone-else' } } as Partial<Request>), {} as Response);

    expect(listed).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });

  it('passes the filters through, and nothing that was not asked for', async () => {
    await getAuditTrail(
      req({ query: { actorKind: 'assistant', service: 'album-service' } } as Partial<Request>),
      {} as Response
    );

    expect(listed).toHaveBeenCalledWith(
      expect.objectContaining({ actorKind: 'assistant', service: 'album-service', action: undefined })
    );
  });

  it('defaults the paging rather than asking for everything', async () => {
    await getAuditTrail(req(), {} as Response);
    expect(listed).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
  });

  it('answers with the page it was given', async () => {
    listed.mockResolvedValue({ events: [{ id: 'e1' }], total: 1, page: 1, totalPages: 1 });
    const res = {} as Response;

    await getAuditTrail(req(), res);

    expect(sent).toHaveBeenCalledWith(res, expect.objectContaining({ total: 1 }));
  });
});
