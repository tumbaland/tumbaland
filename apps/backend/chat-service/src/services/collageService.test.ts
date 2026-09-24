const sendToUsers = jest.fn(async () => 1);
jest.mock('./pushService', () => ({
  isPushConfigured: () => true,
  sendToUsers: (...args: unknown[]) => sendToUsers(...(args as []))
}));

const findOne = jest.fn();
jest.mock('../models/Conversation', () => ({ Conversation: { findOne: (...args: unknown[]) => findOne(...args) } }));

import { collageActivity } from './collageService';

const CONVERSATION_ID = '64b7f0c2a1b2c3d4e5f60718';
const member = (userId: string) => ({ userId, email: `${userId}@example.com`, name: userId });
const activity = (presentUserIds: string[]) => ({
  conversationId: CONVERSATION_ID,
  collageId: '64b7f0c2a1b2c3d4e5f60719',
  title: 'Rome',
  userId: 'u-tom',
  name: 'Tom',
  presentUserIds
});

afterEach(() => jest.clearAllMocks());

describe('collageActivity', () => {
  it('tells the others in the chat who are not in the collage, and opens the collage', async () => {
    findOne.mockResolvedValue({ members: [member('u-tom'), member('u-irja'), member('u-mari')] });

    await collageActivity(activity(['u-tom', 'u-mari']));

    expect(sendToUsers).toHaveBeenCalledWith(
      ['u-irja'],
      expect.objectContaining({
        title: 'Tom',
        body: 'Tom is working on your collage “Rome”',
        url: '/album/collages/64b7f0c2a1b2c3d4e5f60719'
      }),
      expect.anything()
    );
    // Not a message push: the worker must not ask whether a conversation is unread.
    expect((sendToUsers.mock.calls[0] as unknown[])[1]).not.toHaveProperty('conversationId');
  });

  it('never tells the person who opened it', async () => {
    findOne.mockResolvedValue({ members: [member('u-tom')] });

    expect(await collageActivity(activity([]))).toBe(0);
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('does nothing for a chat that is gone', async () => {
    findOne.mockResolvedValue(null);

    expect(await collageActivity(activity([]))).toBe(0);
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('does not throw when push fails', async () => {
    findOne.mockResolvedValue({ members: [member('u-tom'), member('u-irja')] });
    sendToUsers.mockRejectedValueOnce(new Error('push service down'));

    await expect(collageActivity(activity([]))).resolves.toBe(0);
  });
});
