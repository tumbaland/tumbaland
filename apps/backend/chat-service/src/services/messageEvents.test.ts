import { Types } from 'mongoose';
import type { IConversation } from '../models/Conversation';
import { publishRead, publishTyping } from './messageEvents';
import { publishToGroup } from './streamHub';

jest.mock('./streamHub', () => ({ publishToGroup: jest.fn() }));

const conversation = { _id: new Types.ObjectId(), groupId: 'g1' } as unknown as IConversation;
const person = { id: 'u1', name: 'Tom' } as never;

beforeEach(() => jest.clearAllMocks());

it('announces a read cursor to the group, with who read and how far', () => {
  publishRead(conversation, person, 'm9');

  expect(publishToGroup).toHaveBeenCalledWith(
    'g1',
    expect.objectContaining({
      type: 'read',
      conversationId: conversation._id.toString(),
      payload: expect.objectContaining({ userId: 'u1', name: 'Tom', lastReadMessageId: 'm9' })
    })
  );
});

it('says the cursor is null when no message was named', () => {
  publishRead(conversation, person);

  const [, event] = (publishToGroup as jest.Mock).mock.calls[0];
  expect(event.payload.lastReadMessageId).toBeNull();
});

it('fans typing out to everyone but the person typing', () => {
  publishTyping(conversation, person);

  expect(publishToGroup).toHaveBeenCalledWith(
    'g1',
    expect.objectContaining({ type: 'typing', payload: { userId: 'u1', name: 'Tom' } }),
    'u1'
  );
});
