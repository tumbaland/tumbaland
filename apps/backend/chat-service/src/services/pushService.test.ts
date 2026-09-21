const sendNotification = jest.fn();
const setVapidDetails = jest.fn();

jest.mock('web-push', () => ({
  __esModule: true,
  default: { sendNotification, setVapidDetails }
}));

jest.mock('../models/PushSubscription', () => ({
  PushSubscription: {
    find: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn()
  }
}));

import { PushSubscription } from '../models/PushSubscription';
import { isPushConfigured, removeSubscription, resetPushConfig, saveSubscription, sendToUsers } from './pushService';

const mocked = PushSubscription as unknown as {
  find: jest.Mock;
  updateOne: jest.Mock;
  deleteOne: jest.Mock;
};

const subscription = (overrides: Record<string, unknown> = {}) => ({
  _id: 'sub-1',
  userId: 'u-irja',
  endpoint: 'https://push.example/abc',
  keys: { p256dh: 'p', auth: 'a' },
  failureCount: 0,
  ...overrides
});

beforeEach(() => {
  resetPushConfig();
  process.env.VAPID_PUBLIC_KEY = 'public';
  process.env.VAPID_PRIVATE_KEY = 'private';
  process.env.VAPID_SUBJECT = 'mailto:hello@example.com';
  mocked.find.mockResolvedValue([]);
  mocked.updateOne.mockResolvedValue({});
  mocked.deleteOne.mockResolvedValue({});
});

afterEach(() => jest.clearAllMocks());

describe('configuration', () => {
  it('configures web-push once when the keys are present', () => {
    expect(isPushConfigured()).toBe(true);
    expect(isPushConfigured()).toBe(true);

    expect(setVapidDetails).toHaveBeenCalledTimes(1);
  });

  it.each(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])(
    'reports unconfigured, rather than throwing, when %s is missing',
    (key) => {
      delete process.env[key];
      resetPushConfig();

      // A deployment with no keys is a chat without notifications, not a
      // broken service.
      expect(isPushConfigured()).toBe(false);
    }
  );

  it('sends nothing at all when unconfigured', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    resetPushConfig();

    expect(await sendToUsers(['u-irja'], payload())).toBe(0);
    expect(mocked.find).not.toHaveBeenCalled();
  });
});

const payload = () => ({ title: 'Tom', body: 'hello', tag: 'c1', url: '/chat/c1' });

describe('saveSubscription', () => {
  it('upserts on the endpoint and clears past failures', async () => {
    await saveSubscription('u-irja', { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }, 'UA');

    const [filter, update, options] = mocked.updateOne.mock.calls[0]!;
    expect(filter).toEqual({ endpoint: 'https://push.example/abc' });
    expect(update.$set).toMatchObject({ userId: 'u-irja', failureCount: 0, userAgent: 'UA' });
    expect(options).toEqual({ upsert: true });
  });

  it('reassigns the endpoint when a shared device switches account', async () => {
    await saveSubscription('u-tom', { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } });

    // userId is in $set, not $setOnInsert, or the row would keep pushing this
    // conversation to whoever signed in first.
    expect(mocked.updateOne.mock.calls[0]![1].$set.userId).toBe('u-tom');
  });
});

describe('removeSubscription', () => {
  it('deletes only the caller’s own endpoint', async () => {
    await removeSubscription('u-irja', 'https://push.example/abc');

    expect(mocked.deleteOne).toHaveBeenCalledWith({ endpoint: 'https://push.example/abc', userId: 'u-irja' });
  });
});

describe('sendToUsers', () => {
  it('sends to every registered device', async () => {
    mocked.find.mockResolvedValue([subscription(), subscription({ _id: 'sub-2', endpoint: 'https://push.example/def' })]);
    sendNotification.mockResolvedValue({});

    expect(await sendToUsers(['u-irja'], payload())).toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it('serialises the payload as JSON the worker can read', async () => {
    mocked.find.mockResolvedValue([subscription()]);
    sendNotification.mockResolvedValue({});

    await sendToUsers(['u-irja'], payload());

    expect(JSON.parse(sendNotification.mock.calls[0]![1])).toEqual(payload());
  });

  it('does nothing when the recipient has no devices', async () => {
    expect(await sendToUsers(['u-irja'], payload())).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('returns early for an empty recipient list', async () => {
    expect(await sendToUsers([], payload())).toBe(0);
    expect(mocked.find).not.toHaveBeenCalled();
  });

  it.each([404, 410])('drops an endpoint the push service reports gone (%s)', async (statusCode) => {
    mocked.find.mockResolvedValue([subscription()]);
    sendNotification.mockRejectedValue(Object.assign(new Error('gone'), { statusCode }));

    expect(await sendToUsers(['u-irja'], payload())).toBe(0);
    expect(mocked.deleteOne).toHaveBeenCalledWith({ _id: 'sub-1' });
  });

  it('counts a transient failure rather than dropping the device', async () => {
    mocked.find.mockResolvedValue([subscription({ failureCount: 0 })]);
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));

    await sendToUsers(['u-irja'], payload());

    expect(mocked.deleteOne).not.toHaveBeenCalled();
    expect(mocked.updateOne).toHaveBeenCalledWith({ _id: 'sub-1' }, { $set: { failureCount: 1 } });
  });

  it('drops a device that has failed too many times', async () => {
    mocked.find.mockResolvedValue([subscription({ failureCount: 2 })]);
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));

    await sendToUsers(['u-irja'], payload());

    expect(mocked.deleteOne).toHaveBeenCalledWith({ _id: 'sub-1' });
  });

  it('keeps delivering to the healthy devices when one fails', async () => {
    mocked.find.mockResolvedValue([
      subscription(),
      subscription({ _id: 'sub-2', endpoint: 'https://push.example/def' })
    ]);
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({});

    expect(await sendToUsers(['u-irja'], payload())).toBe(1);
  });
});
