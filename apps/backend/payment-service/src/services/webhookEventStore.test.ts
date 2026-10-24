jest.mock('../models/WebhookEvent', () => ({
  WebhookEvent: {
    exists: jest.fn(),
    updateOne: jest.fn()
  }
}));

import { WebhookEvent } from '../models/WebhookEvent';
import { ensureEventStore } from './webhookEventStore';

const exists = WebhookEvent.exists as jest.Mock;
const updateOne = WebhookEvent.updateOne as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ensureEventStore', () => {
  it('reports an unseen id as not processed', async () => {
    exists.mockResolvedValue(null);

    await expect(ensureEventStore().has('evt_unseen')).resolves.toBe(false);
    expect(exists).toHaveBeenCalledWith({ eventId: 'evt_unseen' });
  });

  it('reports a recorded id as processed', async () => {
    exists.mockResolvedValue({ _id: 'x' });

    await expect(ensureEventStore().has('evt_1')).resolves.toBe(true);
  });

  it('records an id with an upsert, so a repeated add is harmless', async () => {
    updateOne.mockResolvedValue({});

    await ensureEventStore().add('evt_1');
    await ensureEventStore().add('evt_1');

    expect(updateOne).toHaveBeenCalledTimes(2);
    expect(updateOne).toHaveBeenCalledWith(
      { eventId: 'evt_1' },
      { $setOnInsert: { eventId: 'evt_1' } },
      { upsert: true }
    );
  });
});
