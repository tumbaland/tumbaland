jest.mock('./pushService', () => ({ sendToUsers: jest.fn(async () => 1), isPushConfigured: () => true }));
jest.mock('timers/promises', () => ({ setTimeout: jest.fn(async () => undefined) }));
jest.mock('./streamHub', () => ({ onlineInGroup: jest.fn(() => new Set<string>()) }));
jest.mock('../models/ReadState', () => ({ ReadState: { find: jest.fn(async () => []) } }));

import { ReadState } from '../models/ReadState';
import { IConversation } from '../models/Conversation';
import { Caller } from './accessService';
import { MessageView } from './messageView';
import { notifyNewMessage, recipientsFor } from './notificationService';
import { sendToUsers } from './pushService';
import { onlineInGroup } from './streamHub';

const TOM: Caller = { id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] };

const conversation = (members = [member('u-tom', 'Tom'), member('u-irja', 'Irja')]) =>
  ({
    _id: { toString: () => 'c1' },
    groupId: 'g1',
    members
  }) as unknown as IConversation;

function member(userId: string, name: string) {
  return { userId, email: `${name.toLowerCase()}@example.com`, name, joinedAt: new Date() };
}

const message = (overrides: Partial<MessageView> = {}) =>
  ({ id: 'm1', body: 'hello', attachments: [], createdAt: new Date(), ...overrides }) as MessageView;

beforeEach(() => {
  (onlineInGroup as jest.Mock).mockReturnValue(new Set<string>());
  (ReadState.find as jest.Mock).mockResolvedValue([]);
});

afterEach(() => jest.clearAllMocks());

describe('recipientsFor', () => {
  it('is everyone on the roster except the sender', async () => {
    expect(await recipientsFor(conversation(), TOM, new Date())).toEqual([{ userId: 'u-irja', name: 'Irja' }]);
  });

  it('notifies connected users who have not read this message', async () => {
    (onlineInGroup as jest.Mock).mockReturnValue(new Set(['u-irja']));

    expect(await recipientsFor(conversation(), TOM, new Date())).toEqual([{ userId: 'u-irja', name: 'Irja' }]);
  });

  it('skips only recipients who have read this message', async () => {
    // Two people typing at each other should not buzz each other's phones.
    (ReadState.find as jest.Mock).mockResolvedValue([{ userId: 'u-irja' }]);

    expect(await recipientsFor(conversation(), TOM, new Date())).toEqual([]);
  });

  it('still notifies someone whose last read was long ago', async () => {
    (ReadState.find as jest.Mock).mockResolvedValue([]);

    expect(await recipientsFor(conversation(), TOM, new Date())).toHaveLength(1);
  });

  it('is empty when the sender is the only person on the roster', async () => {
    expect(await recipientsFor(conversation([member('u-tom', 'Tom')]), TOM, new Date())).toEqual([]);
  });

  it('checks this message receipt even if someone has a stream open', async () => {
    (onlineInGroup as jest.Mock).mockReturnValue(new Set(['u-irja']));

    await recipientsFor(conversation(), TOM, new Date());

    expect(ReadState.find).toHaveBeenCalledWith(expect.objectContaining({ lastReadAt: { $gte: expect.any(Date) } }));
  });
});

describe('notifyNewMessage', () => {
  it('sends with the sender as the title and the conversation as the tag', async () => {
    await notifyNewMessage(conversation(), TOM, message());

    expect(sendToUsers).toHaveBeenCalledWith(['u-irja'], {
      title: 'Tom',
      body: 'hello',
      // One notification per conversation, not one per message.
      tag: 'c1',
      url: '/chat/c1',
      conversationId: 'c1',
      sentAt: expect.any(Number)
    }, { topic: 'c1' });
  });

  it('describes an attachment instead of showing an empty body', async () => {
    await notifyNewMessage(
      conversation(),
      TOM,
      message({ body: '', attachments: [{ fileId: 'f', mimetype: 'image/jpeg', sizeBytes: 1 }] })
    );

    expect((sendToUsers as jest.Mock).mock.calls[0]![1].body).toBe('Sent a photo');
  });

  it('names a video as a video', async () => {
    await notifyNewMessage(
      conversation(),
      TOM,
      message({ body: '', attachments: [{ fileId: 'f', mimetype: 'video/mp4', sizeBytes: 1 }] })
    );

    expect((sendToUsers as jest.Mock).mock.calls[0]![1].body).toBe('Sent a video');
  });

  it('counts several attachments', async () => {
    await notifyNewMessage(
      conversation(),
      TOM,
      message({
        body: '',
        attachments: [
          { fileId: 'a', mimetype: 'image/jpeg', sizeBytes: 1 },
          { fileId: 'b', mimetype: 'image/jpeg', sizeBytes: 1 }
        ]
      })
    );

    expect((sendToUsers as jest.Mock).mock.calls[0]![1].body).toBe('Sent 2 attachments');
  });

  it('truncates a long message rather than pushing the whole thing', async () => {
    await notifyNewMessage(conversation(), TOM, message({ body: 'x'.repeat(500) }));

    expect((sendToUsers as jest.Mock).mock.calls[0]![1].body).toHaveLength(140);
  });

  it('sends nothing when the recipient has already read it', async () => {
    (ReadState.find as jest.Mock).mockResolvedValue([{ userId: 'u-irja' }]);

    await notifyNewMessage(conversation(), TOM, message());

    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('swallows a push failure: the message is already stored', async () => {
    (sendToUsers as jest.Mock).mockRejectedValue(new Error('push service down'));

    await expect(notifyNewMessage(conversation(), TOM, message())).resolves.toBeUndefined();
  });
});
